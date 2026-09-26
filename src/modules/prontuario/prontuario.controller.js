import { ProntuarioService } from './prontuario.service.js'

export const ProntuarioController = {
    async getAllProntuarios(req, reply) {
        const { tenantId } = req.user
        const { pacienteId } = req.query
        const prontuarios = await ProntuarioService.findAll(tenantId, { pacienteId })
        return reply.send({ data: prontuarios })
    },

    async getProntuarioById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const prontuario = await ProntuarioService.findById(id, tenantId)
        return reply.send({ data: prontuario })
    },

    async createProntuario(req, reply) {
        const { tenantId } = req.user
        const prontuario = await ProntuarioService.createProntuario(req.body, tenantId)
        return reply.code(201).send({ data: prontuario, message: 'Prontuário registrado com sucesso' })
    },

    async updateProntuario(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const prontuario = await ProntuarioService.updateProntuario(id, tenantId, req.body)
        return reply.send({ data: prontuario, message: 'Prontuário atualizado com sucesso' })
    },

    async finalizarAtendimento(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const prontuario = await ProntuarioService.finalizarAtendimento(id, tenantId, req.body)
        return reply.send({ data: prontuario, message: 'Atendimento finalizado com sucesso' })
    },

    async deleteProntuario(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await ProntuarioService.deleteProntuario(id, tenantId)
        return reply.send({ data: null, message: 'Prontuário removido com sucesso' })
    },
}