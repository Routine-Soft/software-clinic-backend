import mongoose from 'mongoose'
import AssinaturaModel from './assinatura.model.js'
import PagamentoModel from './pagamento.model.js'
import PlanoModel from '../plano/plano.model.js'
import UserModel from '../user/user.model.js'
import { getStripe, stripeConfigurado } from '../../config/stripe.js'
import { ehBrasil } from '../shared/utils/pais.js'
import { exigirCabeNoIndividual } from '../plano/plano.limites.js'
import AppError from '../../errors/AppError.js'

// Stripe: assinatura no cartão (em dólar) das clínicas de fora do Brasil. As do Brasil continuam no Mercado Pago.

// Frontend usa HashRouter: as rotas de retorno ficam depois do "#".
function urlDoApp(rota) {
    const base = (process.env.APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    return `${base}/#${rota}`
}

function exigirStripe() {
    if (!stripeConfigurado()) {
        throw new AppError('Pagamento com cartão internacional ainda não está configurado. Fale com o suporte.', 503)
    }
}

function erroDoStripe(error) {
    if (error instanceof AppError) return error
    return new AppError(`Não foi possível falar com o Stripe: ${error?.message ?? 'erro desconhecido'}`, 502)
}

// Nas versões novas da API do Stripe o fim do período fica nos itens da assinatura; nas antigas, na própria assinatura.
export function fimDoPeriodo(sub) {
    const segundos = sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end
    return segundos ? new Date(segundos * 1000) : null
}

// Estado da assinatura no Stripe → estado interno. Sem banco nem rede (testável).
export function aplicarStatusStripe(assinatura, sub) {
    assinatura.stripeSubscriptionId = sub.id
    if (sub.customer) assinatura.stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

    switch (sub.status) {
        case 'active':
        case 'trialing':
            assinatura.cobranca = 'stripe'
            assinatura.inadimplenteDesde = null
            assinatura.proximaCobranca = fimDoPeriodo(sub)
            // Cancelada "ao fim do período": continua com acesso até lá, sem renovar.
            assinatura.status = sub.cancel_at_period_end || sub.cancel_at ? 'cancelada' : 'ativa'
            return 'ok'
        case 'past_due':
        case 'unpaid':
            if (assinatura.status !== 'inadimplente') assinatura.inadimplenteDesde = new Date()
            assinatura.status = 'inadimplente'
            return 'ok'
        case 'canceled':
            assinatura.stripeSubscriptionId = null
            if (assinatura.proximaCobranca) {
                assinatura.status = 'cancelada'
                return 'ok'
            }
            return 'voltar-ao-gratuito'
        // incomplete / incomplete_expired / paused: a primeira cobrança ainda não passou.
        default:
            return 'sem-mudanca'
    }
}

async function voltarAoGratuito(assinatura) {
    const gratis = await PlanoModel.findOne({ tipo: 'gratis' })
    const testeVigente = !!assinatura.dataFimTrial && assinatura.dataFimTrial > new Date()
    assinatura.status = testeVigente ? 'trial' : 'expirada'
    assinatura.inadimplenteDesde = null
    if (gratis) assinatura.planoId = gratis._id
}

async function planoDaSubscription(sub) {
    const planoId = sub?.metadata?.planoId
    if (planoId && mongoose.isValidObjectId(planoId)) {
        const plano = await PlanoModel.findById(planoId)
        if (plano) return plano
    }
    const priceId = sub?.items?.data?.[0]?.price?.id
    return priceId ? await PlanoModel.findOne({ stripePriceId: priceId }) : null
}

// Configuração do Portal do cliente criada pelo próprio sistema (não depende de ligar no painel do Stripe).
// Fica marcada com metadata.sistema = 'sonelia' para não misturar com outros sistemas na mesma conta.
let _configPortalId = null

async function configuracaoDoPortal(stripe) {
    if (_configPortalId) return _configPortalId
    const existentes = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
    const nossa = existentes.data.find((c) => c.metadata?.sistema === 'sonelia')
    if (nossa) {
        _configPortalId = nossa.id
        return nossa.id
    }
    const nova = await stripe.billingPortal.configurations.create({
        metadata: { sistema: 'sonelia' },
        business_profile: { headline: 'Sonelia: manage your subscription' },
        default_return_url: urlDoApp('/assinaturas'),
        features: {
            customer_update: { enabled: true, allowed_updates: ['email', 'address', 'tax_id'] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: 'at_period_end' },
        },
    })
    _configPortalId = nova.id
    return nova.id
}

async function assinaturaAtual(tenantId) {
    return await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
}

export const StripeService = {
    async iniciarCheckout(tenantId, planoId, idioma) {
        exigirStripe()
        const dono = await UserModel.findById(tenantId)
        if (!dono) throw new AppError('Clínica não encontrada', 404)
        if (ehBrasil(dono.pais)) throw new AppError('No Brasil o pagamento é pelo Mercado Pago (cartão ou Pix).', 400)

        const assinatura = await assinaturaAtual(tenantId)
        if (!assinatura) throw new AppError('Assinatura não encontrada', 404)
        if (assinatura.status === 'ativa' && assinatura.cobranca === 'stripe') {
            throw new AppError('Você já tem uma assinatura ativa no cartão. Para trocar de plano ou de cartão, use "Gerenciar assinatura".', 409)
        }

        const plano = mongoose.isValidObjectId(planoId) ? await PlanoModel.findOne({ _id: planoId, tipo: 'pago', ativo: true, moeda: 'USD' }) : null
        if (!plano) throw new AppError('Plano não encontrado ou indisponível para assinatura', 404)
        if (!plano.stripePriceId) throw new AppError('Este plano ainda não está disponível no cartão internacional.', 400)
        if (plano.individual) await exigirCabeNoIndividual(tenantId, plano)

        const stripe = getStripe()
        try {
            if (!assinatura.stripeCustomerId) {
                const cliente = await stripe.customers.create({ email: dono.email, name: dono.nomeEmpresa, metadata: { tenantId: String(tenantId) } })
                assinatura.stripeCustomerId = cliente.id
                await assinatura.save()
            }
            const sessao = await stripe.checkout.sessions.create({
                mode: 'subscription',
                customer: assinatura.stripeCustomerId,
                client_reference_id: String(tenantId),
                line_items: [{ price: plano.stripePriceId, quantity: 1 }],
                subscription_data: { metadata: { tenantId: String(tenantId), planoId: String(plano._id) } },
                locale: idioma === 'en' ? 'en' : 'pt-BR',
                allow_promotion_codes: true,
                success_url: `${urlDoApp('/assinatura/retorno')}?stripe_session={CHECKOUT_SESSION_ID}`,
                cancel_url: urlDoApp('/assinaturas'),
            })
            return { url: sessao.url }
        } catch (error) {
            throw erroDoStripe(error)
        }
    },

    // Portal do Stripe: trocar o cartão, ver as faturas, trocar de plano ou cancelar.
    async abrirPortal(tenantId, idioma) {
        exigirStripe()
        const assinatura = await assinaturaAtual(tenantId)
        if (!assinatura?.stripeCustomerId) throw new AppError('Você ainda não tem assinatura no cartão internacional.', 400)
        try {
            const stripe = getStripe()
            const sessao = await stripe.billingPortal.sessions.create({
                customer: assinatura.stripeCustomerId,
                configuration: await configuracaoDoPortal(stripe),
                locale: idioma === 'en' ? 'en' : 'pt-BR',
                return_url: urlDoApp('/assinaturas'),
            })
            return { url: sessao.url }
        } catch (error) {
            throw erroDoStripe(error)
        }
    },

    // Aplica uma assinatura do Stripe à da clínica. A clínica vem do banco (cliente do Stripe), nunca do navegador.
    async aplicarSubscription(sub) {
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        let assinatura = await AssinaturaModel.findOne({ stripeSubscriptionId: sub.id })
            ?? (customerId ? await AssinaturaModel.findOne({ stripeCustomerId: customerId }).sort({ createdAt: -1 }) : null)
        if (!assinatura && mongoose.isValidObjectId(sub.metadata?.tenantId)) assinatura = await assinaturaAtual(sub.metadata.tenantId)
        if (!assinatura) return null

        // Uma assinatura antiga cancelada não mexe na assinatura nova da mesma clínica.
        if (assinatura.stripeSubscriptionId && assinatura.stripeSubscriptionId !== sub.id && sub.status === 'canceled') return assinatura

        const resultado = aplicarStatusStripe(assinatura, sub)
        if (resultado === 'voltar-ao-gratuito') await voltarAoGratuito(assinatura)
        if (['ativa', 'cancelada', 'inadimplente'].includes(assinatura.status)) {
            const plano = await planoDaSubscription(sub)
            if (plano) assinatura.planoId = plano._id
        }
        await assinatura.save()
        return assinatura
    },

    // Volta do checkout: confere a sessão no Stripe e já ativa, sem esperar o aviso (webhook).
    async sincronizar(tenantId, sessionId) {
        exigirStripe()
        const stripe = getStripe()
        const assinatura = await assinaturaAtual(tenantId)
        try {
            let subId = assinatura?.stripeSubscriptionId
            if (sessionId) {
                const sessao = await stripe.checkout.sessions.retrieve(String(sessionId))
                if (sessao.client_reference_id !== String(tenantId)) throw new AppError('Este pagamento não pertence à sua clínica', 403)
                subId = typeof sessao.subscription === 'string' ? sessao.subscription : sessao.subscription?.id
            }
            if (subId) await this.aplicarSubscription(await stripe.subscriptions.retrieve(subId))
        } catch (error) {
            throw erroDoStripe(error)
        }
    },

    // Cancelar pelo botão do sistema: o Stripe para de renovar e o acesso segue até o fim do período pago.
    async cancelar(assinatura) {
        exigirStripe()
        if (!assinatura.stripeSubscriptionId) throw new AppError('Não há uma assinatura paga para cancelar', 400)
        try {
            const sub = await getStripe().subscriptions.update(assinatura.stripeSubscriptionId, { cancel_at_period_end: true })
            await this.aplicarSubscription(sub)
        } catch (error) {
            throw erroDoStripe(error)
        }
    },

    // Clínica excluída pelo super_admin: para de cobrar no cartão antes de apagar.
    async encerrar(tenantId) {
        if (!stripeConfigurado()) return
        for (const assinatura of await AssinaturaModel.find({ tenantId, stripeSubscriptionId: { $ne: null } })) {
            await getStripe().subscriptions.cancel(assinatura.stripeSubscriptionId).catch(() => null)
        }
    },

    async registrarFatura(fatura, aprovada) {
        const customerId = typeof fatura.customer === 'string' ? fatura.customer : fatura.customer?.id
        const assinatura = customerId ? await AssinaturaModel.findOne({ stripeCustomerId: customerId }).sort({ createdAt: -1 }) : null
        if (!assinatura) return

        if (aprovada) {
            if (!fatura.amount_paid) return
            // O Stripe pode reenviar o mesmo aviso: cada fatura conta uma vez só.
            await PagamentoModel.findOneAndUpdate(
                { stripeInvoiceId: fatura.id },
                {
                    $setOnInsert: {
                        tenantId: assinatura.tenantId,
                        assinaturaId: assinatura._id,
                        planoId: assinatura.planoId,
                        metodo: 'stripe',
                        status: 'aprovado',
                        valor: fatura.amount_paid / 100,
                        moeda: String(fatura.currency ?? 'usd').toUpperCase() === 'BRL' ? 'BRL' : 'USD',
                        aprovadoEm: new Date(),
                    },
                },
                { upsert: true }
            )
        } else if (assinatura.status === 'ativa') {
            assinatura.status = 'inadimplente'
            assinatura.inadimplenteDesde = new Date()
            await assinatura.save()
        }
    },

    async processarEvento(evento) {
        const objeto = evento.data?.object
        switch (evento.type) {
            case 'checkout.session.completed': {
                if (objeto.mode !== 'subscription' || !objeto.subscription) return
                if (mongoose.isValidObjectId(objeto.client_reference_id) && objeto.customer) {
                    await AssinaturaModel.findOneAndUpdate(
                        { tenantId: objeto.client_reference_id },
                        { $set: { stripeCustomerId: objeto.customer } },
                        { sort: { createdAt: -1 } }
                    )
                }
                const subId = typeof objeto.subscription === 'string' ? objeto.subscription : objeto.subscription.id
                await this.aplicarSubscription(await getStripe().subscriptions.retrieve(subId))
                return
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                await this.aplicarSubscription(objeto)
                return
            case 'invoice.paid':
                await this.registrarFatura(objeto, true)
                return
            case 'invoice.payment_failed':
                await this.registrarFatura(objeto, false)
                return
            default:
        }
    },
}
