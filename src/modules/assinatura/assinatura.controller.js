import crypto from 'node:crypto'
import { AssinaturaService, avaliarAcesso } from './assinatura.service.js'
import { StripeService } from './assinatura.stripe.js'
import { getStripe, stripeConfigurado } from '../../config/stripe.js'
import { idiomaDaRequisicao } from '../shared/utils/idioma.js'
import { gatewayDoPais, moedaDoPais } from '../shared/utils/pais.js'
import UserModel from '../user/user.model.js'

// Confere a assinatura que o Mercado Pago envia no cabeçalho x-signature (HMAC-SHA256 do "manifest").
function assinaturaDoWebhookValida(req, dataId) {
    const xSignature = req.headers['x-signature']
    const xRequestId = req.headers['x-request-id']
    if (!xSignature) return false

    const partes = Object.fromEntries(
        xSignature.split(',').map((p) => p.trim().split('=').map((s) => s.trim()))
    )
    if (!partes.ts || !partes.v1) return false

    const manifest = `id:${String(dataId).toLowerCase()};request-id:${xRequestId};ts:${partes.ts};`
    const esperado = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex')

    const a = Buffer.from(esperado)
    const b = Buffer.from(partes.v1)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// A assinatura sempre vai acompanhada do estado de acesso, que o frontend usa para bloquear as telas,
// e de como a clínica paga (pelo país dela): Mercado Pago em reais ou Stripe em dólar.
async function comAcesso(assinatura) {
    const dono = await UserModel.findById(assinatura.tenantId, 'pais')
    const pais = dono?.pais ?? 'BR'
    return { ...assinatura.toJSON(), acesso: avaliarAcesso(assinatura), pais, moeda: moedaDoPais(pais), gateway: gatewayDoPais(pais) }
}

export const AssinaturaController = {
    async getAtual(req, reply) {
        const { tenantId } = req.user
        // Quem pagou um Pix e fechou a janela é liberado assim que a tela consulta a assinatura (falha do Mercado Pago não impede a consulta).
        await AssinaturaService.confirmarPixPendente(tenantId).catch(() => null)
        const assinatura = await AssinaturaService.obterAssinaturaAtual(tenantId)
        return reply.send({ data: await comAcesso(assinatura) })
    },

    async checkout(req, reply) {
        const { tenantId } = req.user
        const result = await AssinaturaService.iniciarCheckoutPago(tenantId, req.body?.planoId)
        return reply.send({ data: result, message: 'Checkout de assinatura criado com sucesso' })
    },

    async pix(req, reply) {
        const { tenantId } = req.user
        const { planoId, documento } = req.body ?? {}
        const pagamento = await AssinaturaService.iniciarPagamentoPix(tenantId, planoId, documento)
        return reply.send({ data: pagamento, message: 'Pix gerado com sucesso' })
    },

    async sincronizarPix(req, reply) {
        const { tenantId } = req.user
        const { pagamento, assinatura } = await AssinaturaService.sincronizarPix(tenantId)
        return reply.send({ data: { pagamento, assinatura: await comAcesso(assinatura) } })
    },

    async sincronizar(req, reply) {
        const { tenantId } = req.user
        const assinatura = await AssinaturaService.sincronizarAssinatura(tenantId)
        return reply.send({ data: await comAcesso(assinatura), message: 'Assinatura atualizada' })
    },

    async cancelar(req, reply) {
        const { tenantId } = req.user
        const assinatura = await AssinaturaService.cancelarAssinatura(tenantId)
        return reply.send({ data: await comAcesso(assinatura), message: 'Assinatura cancelada' })
    },

    // Stripe: abrir o pagamento, abrir o portal (cartão, faturas, cancelar) e conferir a volta do pagamento.
    async checkoutStripe(req, reply) {
        const result = await StripeService.iniciarCheckout(req.user.tenantId, req.body?.planoId, idiomaDaRequisicao(req))
        return reply.send({ data: result })
    },

    async portalStripe(req, reply) {
        const result = await StripeService.abrirPortal(req.user.tenantId, idiomaDaRequisicao(req))
        return reply.send({ data: result })
    },

    async sincronizarStripe(req, reply) {
        await StripeService.sincronizar(req.user.tenantId, req.body?.sessionId)
        const assinatura = await AssinaturaService.obterAssinaturaAtual(req.user.tenantId)
        return reply.send({ data: await comAcesso(assinatura), message: 'Assinatura atualizada' })
    },

    // Avisos do Stripe, conferidos pela assinatura do corpo (STRIPE_WEBHOOK_SECRET).
    async webhookStripe(req, reply) {
        if (!stripeConfigurado() || !process.env.STRIPE_WEBHOOK_SECRET) return reply.code(503).send({ success: false, message: 'Stripe não configurado' })
        let evento
        try {
            evento = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
        } catch {
            return reply.code(400).send({ success: false, message: 'Webhook inválido' })
        }
        try {
            await StripeService.processarEvento(evento)
        } catch (erro) {
            // Erro aqui faz o Stripe tentar de novo mais tarde, o que é o certo (ex.: banco fora do ar).
            req.log.error(erro, 'Falha ao processar aviso do Stripe')
            return reply.code(500).send({ success: false, message: 'Erro ao processar o aviso' })
        }
        return reply.send({ received: true })
    },

    async webhook(req, reply) {
        const dataId = req.query['data.id'] || req.body?.data?.id

        // Com o segredo configurado, toda chamada precisa vir assinada (sem cabeçalho = recusada).
        if (process.env.MP_WEBHOOK_SECRET && !assinaturaDoWebhookValida(req, dataId)) {
            return reply.code(401).send({ message: 'Webhook inválido' })
        }

        const type = req.body?.type ?? req.query.type

        if (type === 'subscription_preapproval' && dataId) {
            await AssinaturaService.processarWebhookPreapproval(dataId)
        }

        if (type === 'payment' && dataId) {
            await AssinaturaService.processarWebhookPayment(dataId)
        }

        return reply.send({ received: true })
    },
}
