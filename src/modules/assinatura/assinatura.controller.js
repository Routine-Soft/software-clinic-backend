import crypto from 'node:crypto'
import { AssinaturaService, avaliarAcesso } from './assinatura.service.js'

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

// A assinatura sempre vai acompanhada do estado de acesso, que o frontend usa para bloquear as telas.
function comAcesso(assinatura) {
    return { ...assinatura.toJSON(), acesso: avaliarAcesso(assinatura) }
}

export const AssinaturaController = {
    async getAtual(req, reply) {
        const { tenantId } = req.user
        // Quem pagou um Pix e fechou a janela é liberado assim que a tela consulta a assinatura (falha do Mercado Pago não impede a consulta).
        await AssinaturaService.confirmarPixPendente(tenantId).catch(() => null)
        const assinatura = await AssinaturaService.obterAssinaturaAtual(tenantId)
        return reply.send({ data: comAcesso(assinatura) })
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
        return reply.send({ data: { pagamento, assinatura: comAcesso(assinatura) } })
    },

    async sincronizar(req, reply) {
        const { tenantId } = req.user
        const assinatura = await AssinaturaService.sincronizarAssinatura(tenantId)
        return reply.send({ data: comAcesso(assinatura), message: 'Assinatura atualizada' })
    },

    async cancelar(req, reply) {
        const { tenantId } = req.user
        const assinatura = await AssinaturaService.cancelarAssinatura(tenantId)
        return reply.send({ data: comAcesso(assinatura), message: 'Assinatura cancelada' })
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
