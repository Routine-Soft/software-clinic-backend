import PacienteModel from './paciente.model.js'
import { createPacienteDTO, updatePacienteDTO } from './paciente.dto.js'
import ProntuarioModel from '../prontuario/prontuario.model.js'
import AppError from '../../errors/AppError.js'

export const PacienteService = {
    async findAll(tenantId) {
        return await PacienteModel.find({ tenantId }).populate('convenioId').populate('empresaId')
    },

    async findById(id, tenantId) {
        const paciente = await PacienteModel.findOne({ _id: id, tenantId }).populate('convenioId').populate('empresaId')
        if (!paciente) {
            throw new AppError('Paciente não encontrado', 404)
        }
        return paciente
    },

    async createPaciente(body, tenantId) {
        const pacienteDTO = createPacienteDTO(body)
        try {
            return await PacienteModel.create({ ...pacienteDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um paciente com este CPF nesta clínica', 409)
            }
            throw error
        }
    },

    async updatePaciente(id, tenantId, body) {
        const pacienteDTO = updatePacienteDTO(body)
        const paciente = await PacienteModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: pacienteDTO },
            { new: true, runValidators: true }
        )

        if (!paciente) {
            throw new AppError('Paciente não encontrado', 404)
        }

        return paciente
    },

    async deletePaciente(id, tenantId) {
        // O prontuário deve ser guardado por no mínimo 20 anos (Lei 13.787/2018): paciente com atendimento fica.
        if (await ProntuarioModel.exists({ tenantId, pacienteId: id })) {
            throw new AppError('Este paciente tem prontuário registrado e não pode ser excluído: o prontuário deve ser guardado por no mínimo 20 anos.', 409)
        }
        const paciente = await PacienteModel.findOneAndDelete({ _id: id, tenantId })
        if (!paciente) {
            throw new AppError('Paciente não encontrado', 404)
        }
        return null
    },
}