import { ProfissionalService } from './profissional.service.js'

export const ProfissionalController = {
    async getAllProfissionais(req, reply) {
        const { tenantId } = req.user
        const profissionais = await ProfissionalService.findAll(tenantId)
        return reply.send({ data: profissionais })
    },

    async getProfissionalById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const profissional = await ProfissionalService.findById(id, tenantId)
        return reply.send({ data: profissional })
    },

    async createProfissional(req, reply) {
        const { tenantId } = req.user
        const profissional = await ProfissionalService.createProfissional(req.body, tenantId)
        return reply.code(201).send({ data: profissional, message: 'Profissional cadastrado com sucesso' })
    },

    async updateProfissional(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const profissional = await ProfissionalService.updateProfissional(id, tenantId, req.body)
        return reply.send({ data: profissional, message: 'Profissional atualizado com sucesso' })
    },

    async deleteProfissional(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await ProfissionalService.deleteProfissional(id, tenantId)
        return reply.send({ data: null, message: 'Profissional removido com sucesso' })
    },
}