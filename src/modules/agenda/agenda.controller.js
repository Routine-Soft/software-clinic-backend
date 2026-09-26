import { AgendaService } from './agenda.service.js'

export const AgendaController = {
    async getAllAgendas(req, reply) {
        const { tenantId } = req.user
        const { profissionalId, dataInicio, dataFim } = req.query
        const agendas = await AgendaService.findAll(tenantId, { profissionalId, dataInicio, dataFim })
        return reply.send({ data: agendas })
    },

    async getAgendaById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const agenda = await AgendaService.findById(id, tenantId)
        return reply.send({ data: agenda })
    },

    async createAgenda(req, reply) {
        const { tenantId } = req.user
        const agenda = await AgendaService.createAgenda(req.body, tenantId)
        return reply.code(201).send({ data: agenda, message: 'Agendamento criado com sucesso' })
    },

    async updateAgenda(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const agenda = await AgendaService.updateAgenda(id, tenantId, req.body)
        return reply.send({ data: agenda, message: 'Agendamento atualizado com sucesso' })
    },

    async cancelarAgenda(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const agenda = await AgendaService.cancelarAgenda(id, tenantId)
        return reply.send({ data: agenda, message: 'Agendamento cancelado com sucesso' })
    },

    async cancelarGrupoRecorrencia(req, reply) {
        const { grupoRecorrenciaId } = req.params
        const { tenantId } = req.user
        await AgendaService.cancelarGrupoRecorrencia(grupoRecorrenciaId, tenantId)
        return reply.send({ data: null, message: 'Agendamentos recorrentes cancelados com sucesso' })
    },

    async deleteAgenda(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await AgendaService.deleteAgenda(id, tenantId)
        return reply.send({ data: null, message: 'Agendamento removido com sucesso' })
    },
}