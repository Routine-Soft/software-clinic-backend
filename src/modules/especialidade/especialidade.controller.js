import { EspecialidadeService } from './especialidade.service.js'

export const EspecialidadeController = {
    async getAllEspecialidades(req, reply) {
        const { tenantId } = req.user
        const especialidades = await EspecialidadeService.findAll(tenantId)
        return reply.send({ data: especialidades })
    },

    async getEspecialidadeById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const especialidade = await EspecialidadeService.findById(id, tenantId)
        return reply.send({ data: especialidade })
    },

    async createEspecialidade(req, reply) {
        const { tenantId } = req.user
        const especialidade = await EspecialidadeService.createEspecialidade(req.body, tenantId)
        return reply.code(201).send({ data: especialidade, message: 'Especialidade cadastrada com sucesso' })
    },

    async updateEspecialidade(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const especialidade = await EspecialidadeService.updateEspecialidade(id, tenantId, req.body)
        return reply.send({ data: especialidade, message: 'Especialidade atualizada com sucesso' })
    },

    async deleteEspecialidade(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await EspecialidadeService.deleteEspecialidade(id, tenantId)
        return reply.send({ data: null, message: 'Especialidade removida com sucesso' })
    },
}