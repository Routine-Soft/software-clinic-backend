import mongoose from 'mongoose'
import { PreApproval } from 'mercadopago'
import { getMpClient } from '../../config/mercadopago.js'
import AssinaturaModel from './assinatura.model.js'
import PlanoModel from '../plano/plano.model.js'
import UserModel from '../user/user.model.js'
import AppError from '../../errors/AppError.js'

const MP_API = 'https://api.mercadopago.com'

// Frontend usa HashRouter: a rota de retorno fica depois do "#".
// O Mercado Pago acrescenta "?preapproval_id=..." ao final dessa URL.
// Atenção: ele recusa "localhost" como back_url, mas aceita 127.0.0.1 (por isso o padrão de desenvolvimento).
function urlDeRetorno() {
    const base = (process.env.APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    return `${base}/#/assinatura/retorno`
}

// Erros do Mercado Pago chegam com mensagens técnicas em inglês; troca as mais comuns por algo acionável.
function traduzirErroMercadoPago(error) {
    const mensagem = error?.message ?? ''

    if (mensagem.includes('payer and collector must be real or test users')) {
        const dica = process.env.NODE_ENV === 'production'
            ? ''
            : ' No ambiente de teste, defina MP_TEST_PAYER_EMAIL no .env com o e-mail de um usuário comprador de teste.'
        return new AppError(`O e-mail do pagador não corresponde a uma conta do Mercado Pago.${dica}`, 400)
    }

    if (mensagem.includes('back_url')) {
        return new AppError('URL de retorno do Mercado Pago inválida. Confira a variável APP_URL no .env.', 500)
    }

    return new AppError(`Não foi possível iniciar o pagamento no Mercado Pago: ${mensagem || 'erro desconhecido'}`, 502)
}

async function buscarNoMercadoPago(caminho) {
    const response = await fetch(`${MP_API}${caminho}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    if (!response.ok) {
        throw new AppError(`Não foi possível consultar o Mercado Pago (${response.status})`, 502)
    }

    return await response.json()
}

// Dias de tolerância para quem está com o pagamento em atraso antes de perder o acesso.
export const DIAS_DE_TOLERANCIA_INADIMPLENTE = 5

const DIA_EM_MS = 24 * 60 * 60 * 1000

// Regra de bloqueio do sistema. Só olha datas e status, sem gravar nada.
//  - trial: acesso até o fim do teste
//  - pendente: quem clicou em "assinar" durante o teste continua no teste até ele acabar
//  - ativa: acesso liberado
//  - cancelada: acesso até o fim do período que já foi pago (proximaCobranca)
//  - inadimplente: tolerância de alguns dias a partir do atraso
//  - expirada: bloqueado
export function avaliarAcesso(assinatura, agora = new Date()) {
    if (!assinatura) {
        return { liberado: false, motivo: 'Esta clínica não possui assinatura. Entre em contato com o suporte.', ate: null }
    }

    const noFuturo = (data) => !!data && new Date(data) > agora

    switch (assinatura.status) {
        case 'ativa':
            return { liberado: true, motivo: null, ate: null }

        case 'trial':
            return noFuturo(assinatura.dataFimTrial)
                ? { liberado: true, motivo: null, ate: assinatura.dataFimTrial }
                : { liberado: false, motivo: 'O período de teste terminou. Assine um plano para continuar usando o sistema.', ate: null }

        case 'pendente':
            return noFuturo(assinatura.dataFimTrial)
                ? { liberado: true, motivo: null, ate: assinatura.dataFimTrial }
                : { liberado: false, motivo: 'Estamos aguardando a confirmação do seu pagamento. O acesso é liberado assim que ele for aprovado.', ate: null }

        case 'cancelada':
            return noFuturo(assinatura.proximaCobranca)
                ? { liberado: true, motivo: null, ate: assinatura.proximaCobranca }
                : { liberado: false, motivo: 'A assinatura foi cancelada. Assine novamente para voltar a usar o sistema.', ate: null }

        case 'inadimplente': {
            const desde = assinatura.inadimplenteDesde ?? assinatura.updatedAt ?? agora
            const limite = new Date(new Date(desde).getTime() + DIAS_DE_TOLERANCIA_INADIMPLENTE * DIA_EM_MS)
            return limite > agora
                ? { liberado: true, motivo: null, ate: limite }
                : { liberado: false, motivo: 'Não conseguimos processar o pagamento da assinatura. Regularize para voltar a usar o sistema.', ate: null }
        }

        default:
            return { liberado: false, motivo: 'A assinatura está inativa. Assine um plano para continuar usando o sistema.', ate: null }
    }
}

// Traduz o estado da assinatura recorrente do Mercado Pago para o estado interno.
// "pending" (aguardando o pagador concluir) mantém "pendente".
export function aplicarStatusPreapproval(assinatura, preapproval) {
    if (preapproval.status === 'authorized') {
        assinatura.status = 'ativa'
        assinatura.inadimplenteDesde = null
        if (preapproval.next_payment_date) assinatura.proximaCobranca = new Date(preapproval.next_payment_date)
    } else if (preapproval.status === 'cancelled') {
        // Mantém proximaCobranca: é até quando o cliente já pagou e ainda tem acesso.
        assinatura.status = 'cancelada'
    } else if (preapproval.status === 'paused') {
        if (assinatura.status !== 'inadimplente') assinatura.inadimplenteDesde = new Date()
        assinatura.status = 'inadimplente'
    }

    return assinatura
}

export const AssinaturaService = {

    async criarAssinaturaTrial(tenantId) {
        const planoGratis = await PlanoModel.findOne({ tipo: 'gratis', ativo: true })
        if (!planoGratis) {
            throw new AppError('Plano gratuito não configurado', 500)
        }

        const dataInicio = new Date()
        const dataFimTrial = new Date(dataInicio)
        dataFimTrial.setDate(dataFimTrial.getDate() + (planoGratis.duracaoDiasTrial || 15))

        return await AssinaturaModel.create({
            tenantId,
            planoId: planoGratis._id,
            status: 'trial',
            dataInicio,
            dataFimTrial,
        })
    },

    async obterAssinaturaAtual(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 }).populate('planoId')
        if (!assinatura) {
            throw new AppError('Assinatura não encontrada', 404)
        }

        // Teste que passou do prazo vira "expirada" na primeira consulta depois do vencimento.
        if (assinatura.status === 'trial' && assinatura.dataFimTrial && assinatura.dataFimTrial < new Date()) {
            assinatura.status = 'expirada'
            await assinatura.save()
        }

        return assinatura
    },

    async verificarAcesso(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
        return avaliarAcesso(assinatura)
    },

    // Cancela a cobrança recorrente no Mercado Pago. O cliente mantém o acesso até o fim do período já pago.
    // Se ainda não tinha pago nada (checkout pendente), volta ao teste em vez de ficar sem nada.
    async cancelarAssinatura(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
        if (!assinatura || !['ativa', 'pendente', 'inadimplente'].includes(assinatura.status) || !assinatura.mercadoPagoPreapprovalId) {
            throw new AppError('Não há uma assinatura paga para cancelar', 400)
        }

        try {
            await new PreApproval(getMpClient()).update({ id: assinatura.mercadoPagoPreapprovalId, body: { status: 'cancelled' } })
        } catch (error) {
            throw traduzirErroMercadoPago(error)
        }

        if (assinatura.status === 'pendente') {
            const planoGratis = await PlanoModel.findOne({ tipo: 'gratis', ativo: true })
            const testeVigente = assinatura.dataFimTrial && assinatura.dataFimTrial > new Date()
            assinatura.status = testeVigente ? 'trial' : 'expirada'
            if (planoGratis) assinatura.planoId = planoGratis._id
            assinatura.mercadoPagoPreapprovalId = null
        } else {
            assinatura.status = 'cancelada'
            assinatura.inadimplenteDesde = null
        }

        await assinatura.save()
        return await this.obterAssinaturaAtual(tenantId)
    },

    async iniciarCheckoutPago(tenantId) {
        const planoPago = await PlanoModel.findOne({ tipo: 'pago', ativo: true })
        if (!planoPago) {
            throw new AppError('Plano pago não configurado', 500)
        }

        const admin = await UserModel.findById(tenantId)
        if (!admin) {
            throw new AppError('Clínica não encontrada', 404)
        }

        const assinatura = await this.obterAssinaturaAtual(tenantId)
        if (assinatura.status === 'ativa') {
            throw new AppError('Esta clínica já possui uma assinatura ativa', 409)
        }

        const body = {
            reason: `Assinatura SoftwareClinic - ${planoPago.nome}`,
            external_reference: assinatura._id.toString(),
            // No ambiente de teste do Mercado Pago o pagador precisa ser um usuário de teste (comprador).
            // MP_TEST_PAYER_EMAIL permite testar sem mudar o e-mail da clínica; em produção fica vazio.
            payer_email: process.env.MP_TEST_PAYER_EMAIL || admin.email,
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: planoPago.preco,
                currency_id: 'BRL',
            },
            back_url: urlDeRetorno(),
        }

        // Só há como o Mercado Pago avisar (webhook) se o backend estiver em uma URL pública.
        if (process.env.APP_URL_BACKEND) {
            body.notification_url = `${process.env.APP_URL_BACKEND.replace(/\/+$/, '')}/api/assinaturas/webhook`
        }

        let result
        try {
            result = await new PreApproval(getMpClient()).create({ body })
        } catch (error) {
            throw traduzirErroMercadoPago(error)
        }

        assinatura.planoId = planoPago._id
        assinatura.status = 'pendente'
        assinatura.mercadoPagoPreapprovalId = result.id
        await assinatura.save()

        return { url: result.init_point }
    },

    // Consulta o Mercado Pago e atualiza o status. Usa o id guardado no banco (nunca um id vindo do cliente),
    // então serve tanto para a volta do checkout quanto para o botão "verificar pagamento".
    async sincronizarAssinatura(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
        if (!assinatura) {
            throw new AppError('Assinatura não encontrada', 404)
        }

        if (assinatura.mercadoPagoPreapprovalId) {
            const preapproval = await buscarNoMercadoPago(`/preapproval/${assinatura.mercadoPagoPreapprovalId}`)
            aplicarStatusPreapproval(assinatura, preapproval)
            await assinatura.save()
        }

        return await this.obterAssinaturaAtual(tenantId)
    },

    async processarWebhookPreapproval(preapprovalId) {
        const assinatura = await AssinaturaModel.findOne({ mercadoPagoPreapprovalId: preapprovalId })
        if (!assinatura) return

        const preapproval = await buscarNoMercadoPago(`/preapproval/${preapprovalId}`)
        aplicarStatusPreapproval(assinatura, preapproval)
        await assinatura.save()
    },

    async processarWebhookPayment(paymentId) {
        const payment = await buscarNoMercadoPago(`/v1/payments/${paymentId}`)

        if (!payment.external_reference || !mongoose.isValidObjectId(payment.external_reference)) return

        const assinatura = await AssinaturaModel.findById(payment.external_reference)
        if (!assinatura) return

        if (payment.status === 'approved') {
            assinatura.status = 'ativa'
            assinatura.inadimplenteDesde = null
            const proxima = new Date()
            proxima.setMonth(proxima.getMonth() + 1)
            assinatura.proximaCobranca = proxima
        } else if (['rejected', 'cancelled'].includes(payment.status)) {
            if (assinatura.status !== 'inadimplente') assinatura.inadimplenteDesde = new Date()
            assinatura.status = 'inadimplente'
        }

        await assinatura.save()
    },
}
