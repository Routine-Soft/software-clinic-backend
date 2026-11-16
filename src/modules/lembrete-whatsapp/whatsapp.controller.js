import { WhatsappService } from './whatsapp.service.js'

export const WhatsappController = {
    async situacao(req, reply) {
        return reply.send({ data: await WhatsappService.situacao(req.user.tenantId) })
    },

    async conectar(req, reply) {
        return reply.send({ data: await WhatsappService.conectar(req.user.tenantId) })
    },

    async desconectar(req, reply) {
        return reply.send({ data: await WhatsappService.desconectar(req.user.tenantId), message: 'WhatsApp desconectado' })
    },

    async atualizar(req, reply) {
        return reply.send({ data: await WhatsappService.atualizar(req.user.tenantId, req.body), message: 'Lembretes atualizados' })
    },

    async enviarTeste(req, reply) {
        await WhatsappService.enviarTeste(req.user.tenantId, req.body?.telefone)
        return reply.send({ data: null, message: 'Mensagem de teste enviada' })
    },
}
