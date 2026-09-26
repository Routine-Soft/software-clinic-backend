import { SalaService } from './sala.service.js'

export const SalaController = {
    async getAllSalas(req, reply) {
        const { tenantId } = req.user
        const salas = await SalaService.findAll(tenantId)
        return reply.send({ data: salas })
    },

    async getSalaById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const sala = await SalaService.findById(id, tenantId)
        return reply.send({ data: sala })
    },

    async createSala(req, reply) {
        const { tenantId } = req.user
        const sala = await SalaService.createSala(req.body, tenantId)
        return reply.code(201).send({ data: sala, message: 'Sala cadastrada com sucesso' })
    },

    async updateSala(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const sala = await SalaService.updateSala(id, tenantId, req.body)
        return reply.send({ data: sala, message: 'Sala atualizada com sucesso' })
    },

    async deleteSala(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await SalaService.deleteSala(id, tenantId)
        return reply.send({ data: null, message: 'Sala removida com sucesso' })
    },
}