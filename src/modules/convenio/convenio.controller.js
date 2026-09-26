import { ConvenioService } from './convenio.service.js'

export const ConvenioController = {
    async getAllConvenios(req, reply) {
        const { tenantId } = req.user
        const convenios = await ConvenioService.findAll(tenantId)
        return reply.send({ data: convenios })
    },

    async getConvenioById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const convenio = await ConvenioService.findById(id, tenantId)
        return reply.send({ data: convenio })
    },

    async createConvenio(req, reply) {
        const { tenantId } = req.user
        const convenio = await ConvenioService.createConvenio(req.body, tenantId)
        return reply.code(201).send({ data: convenio, message: 'Convênio cadastrado com sucesso' })
    },

    async updateConvenio(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const convenio = await ConvenioService.updateConvenio(id, tenantId, req.body)
        return reply.send({ data: convenio, message: 'Convênio atualizado com sucesso' })
    },

    async deleteConvenio(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await ConvenioService.deleteConvenio(id, tenantId)
        return reply.send({ data: null, message: 'Convênio removido com sucesso' })
    },
}