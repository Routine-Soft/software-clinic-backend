import { PlanoService } from './plano.service.js'

export const PlanoController = {
    async getAllPlanos(req, reply) {
        const planos = await PlanoService.findAll()
        return reply.send({ data: planos })
    },

    async getPlanoById(req, reply) {
        const { id } = req.params
        const plano = await PlanoService.findById(id)
        return reply.send({ data: plano })
    },

    async createPlano(req, reply) {
        const plano = await PlanoService.createPlano(req.body)
        return reply.code(201).send({ data: plano, message: 'Plano criado com sucesso' })
    },

    async updatePlano(req, reply) {
        const { id } = req.params
        const plano = await PlanoService.updatePlano(id, req.body)
        return reply.send({ data: plano, message: 'Plano atualizado com sucesso' })
    },

    async deletePlano(req, reply) {
        const { id } = req.params
        await PlanoService.deletePlano(id)
        return reply.send({ data: null, message: 'Plano removido com sucesso' })
    },
}