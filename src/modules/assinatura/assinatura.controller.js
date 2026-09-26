import crypto from 'node:crypto'
import { AssinaturaService } from './assinatura.service.js'

export const AssinaturaController = {
    async getAtual(req, reply) {
        const { tenantId } = req.user
        const assinatura = await AssinaturaService.obterAssinaturaAtual(tenantId)
        return reply.send({ data: assinatura })
    },

    async checkout(req, reply) {
        const { tenantId } = req.user
        const result = await AssinaturaService.iniciarCheckoutPago(tenantId)
        return reply.send({ data: result, message: 'Checkout de assinatura criado com sucesso' })
    },

    async webhook(req, reply) {
        const xSignature = req.headers['x-signature']
        const xRequestId = req.headers['x-request-id']
        const dataId = req.query['data.id'] || req.body?.data?.id

        if (process.env.MP_WEBHOOK_SECRET && xSignature) {
            const parts = Object.fromEntries(
                xSignature.split(',').map((p) => p.trim().split('=').map((s) => s.trim()))
            )

            const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`
            const expectedHash = crypto
                .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
                .update(manifest)
                .digest('hex')

            if (expectedHash !== parts.v1) {
                return reply.code(401).send({ message: 'Webhook inválido' })
            }
        }

        const { type } = req.body

        if (type === 'subscription_preapproval') {
            await AssinaturaService.processarWebhookPreapproval(dataId)
        }

        if (type === 'payment') {
            await AssinaturaService.processarWebhookPayment(dataId)
        }

        return reply.send({ received: true })
    },
}