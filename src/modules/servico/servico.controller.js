import { ServicoService } from './servico.service.js'

export const ServicoController = {
    async getAllServicos(req, reply) {
        const { tenantId } = req.user
        const servicos = await ServicoService.findAll(tenantId)
        return reply.send({ data: servicos })
    },

    async getServicoById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const servico = await ServicoService.findById(id, tenantId)
        return reply.send({ data: servico })
    },

    async createServico(req, reply) {
        const { tenantId } = req.user
        const servico = await ServicoService.createServico(req.body, tenantId)
        return reply.code(201).send({ data: servico, message: 'Serviço cadastrado com sucesso' })
    },

    async updateServico(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const servico = await ServicoService.updateServico(id, tenantId, req.body)
        return reply.send({ data: servico, message: 'Serviço atualizado com sucesso' })
    },

    async deleteServico(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await ServicoService.deleteServico(id, tenantId)
        return reply.send({ data: null, message: 'Serviço removido com sucesso' })
    },
}