import { ReuniaoService } from './reuniao.service.js'

const MENSAGEM_STATUS = {
    aguardando: 'Reunião reaberta',
    realizado: 'Reunião marcada como realizada',
    cancelado: 'Reunião cancelada',
}

export const ReuniaoController = {
    async getAllReunioes(req, reply) {
        const { tenantId } = req.user
        const { dataInicio, dataFim } = req.query
        const reunioes = await ReuniaoService.findAll(tenantId, { dataInicio, dataFim })
        return reply.send({ data: reunioes })
    },

    async getReuniaoById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const reuniao = await ReuniaoService.findById(id, tenantId)
        return reply.send({ data: reuniao })
    },

    async createReuniao(req, reply) {
        const { tenantId } = req.user
        const reuniao = await ReuniaoService.createReuniao(req.body, tenantId)
        return reply.code(201).send({ data: reuniao, message: 'Reunião agendada com sucesso' })
    },

    async updateReuniao(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const reuniao = await ReuniaoService.updateReuniao(id, tenantId, req.body)
        const mensagem = Object.keys(req.body ?? {}).join() === 'status' ? MENSAGEM_STATUS[reuniao.status] : 'Reunião atualizada com sucesso'
        return reply.send({ data: reuniao, message: mensagem })
    },

    async deleteReuniao(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await ReuniaoService.deleteReuniao(id, tenantId)
        return reply.send({ data: null, message: 'Reunião excluída com sucesso' })
    },
}
