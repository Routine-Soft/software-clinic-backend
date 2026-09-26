import { ListaEsperaService } from './lista-espera.service.js'

export const ListaEsperaController = {
    async getAllListaEspera(req, reply) {
        const { tenantId } = req.user
        const { especialidadeId, status } = req.query
        const itens = await ListaEsperaService.findAll(tenantId, { especialidadeId, status })
        return reply.send({ data: itens })
    },

    async getListaEsperaById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const item = await ListaEsperaService.findById(id, tenantId)
        return reply.send({ data: item })
    },

    async createListaEspera(req, reply) {
        const { tenantId } = req.user
        const item = await ListaEsperaService.createListaEspera(req.body, tenantId)
        return reply.code(201).send({ data: item, message: 'Paciente adicionado à lista de espera' })
    },

    async updateListaEspera(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const item = await ListaEsperaService.updateListaEspera(id, tenantId, req.body)
        return reply.send({ data: item, message: 'Item da lista de espera atualizado' })
    },

    async deleteListaEspera(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await ListaEsperaService.deleteListaEspera(id, tenantId)
        return reply.send({ data: null, message: 'Item removido da lista de espera' })
    },
}