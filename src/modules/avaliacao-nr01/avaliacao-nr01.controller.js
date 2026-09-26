import { AvaliacaoNr01Service } from './avaliacao-nr01.service.js'

export const AvaliacaoNr01Controller = {
    async getAllAvaliacoes(req, reply) {
        const { tenantId } = req.user
        const { empresaId } = req.query
        const avaliacoes = await AvaliacaoNr01Service.findAll(tenantId, { empresaId })
        return reply.send({ data: avaliacoes })
    },

    async getAvaliacaoById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const avaliacao = await AvaliacaoNr01Service.findById(id, tenantId)
        return reply.send({ data: avaliacao })
    },

    async createAvaliacao(req, reply) {
        const { tenantId } = req.user
        const avaliacao = await AvaliacaoNr01Service.createAvaliacao(req.body, tenantId)
        return reply.code(201).send({ data: avaliacao, message: 'Avaliação NR-01 cadastrada com sucesso' })
    },

    async updateAvaliacao(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const avaliacao = await AvaliacaoNr01Service.updateAvaliacao(id, tenantId, req.body)
        return reply.send({ data: avaliacao, message: 'Avaliação NR-01 atualizada com sucesso' })
    },

    async deleteAvaliacao(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await AvaliacaoNr01Service.deleteAvaliacao(id, tenantId)
        return reply.send({ data: null, message: 'Avaliação NR-01 removida com sucesso' })
    },
}
