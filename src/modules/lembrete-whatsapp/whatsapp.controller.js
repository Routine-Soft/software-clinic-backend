import { WhatsappService } from './whatsapp.service.js'

// Lembretes por mês do plano da clínica (null = sem limite; o super admin não tem `req.acesso`).
const limiteMes = (req) => req.acesso?.limites?.lembretesMes ?? null

export const WhatsappController = {
    async situacao(req, reply) {
        return reply.send({ data: await WhatsappService.situacao(req.user.tenantId, limiteMes(req)) })
    },

    async conectar(req, reply) {
        return reply.send({ data: await WhatsappService.conectar(req.user.tenantId) })
    },

    async desconectar(req, reply) {
        return reply.send({ data: await WhatsappService.desconectar(req.user.tenantId), message: 'WhatsApp desconectado' })
    },

    async atualizar(req, reply) {
        return reply.send({ data: await WhatsappService.atualizar(req.user.tenantId, req.body, limiteMes(req)), message: 'Lembretes atualizados' })
    },

    async enviarTeste(req, reply) {
        await WhatsappService.enviarTeste(req.user.tenantId, req.body?.telefone)
        return reply.send({ data: null, message: 'Mensagem de teste enviada' })
    },
}
