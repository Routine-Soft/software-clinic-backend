import { PacienteService } from './paciente.service.js'

export const PacienteController = {
    async getAllPacientes(req, reply) {
        const { tenantId } = req.user
        const pacientes = await PacienteService.findAll(tenantId)
        return reply.send({ data: pacientes })
    },

    async getPacienteById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const paciente = await PacienteService.findById(id, tenantId)
        return reply.send({ data: paciente })
    },

    async createPaciente(req, reply) {
        const { tenantId } = req.user
        const paciente = await PacienteService.createPaciente(req.body, tenantId)
        return reply.code(201).send({ data: paciente, message: 'Paciente cadastrado com sucesso' })
    },

    async updatePaciente(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const paciente = await PacienteService.updatePaciente(id, tenantId, req.body)
        return reply.send({ data: paciente, message: 'Paciente atualizado com sucesso' })
    },

    async deletePaciente(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await PacienteService.deletePaciente(id, tenantId)
        return reply.send({ data: null, message: 'Paciente removido com sucesso' })
    },
}