import ProntuarioModel from './prontuario.model.js'
import { createProntuarioDTO, updateProntuarioDTO } from './prontuario.dto.js'
import AppError from '../../errors/AppError.js'

export const ProntuarioService = {
    async findAll(tenantId, filtros = {}) {
        const query = { tenantId }

        if (filtros.pacienteId) {
            query.pacienteId = filtros.pacienteId
        }

        return await ProntuarioModel.find(query)
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('convenioId')
            .sort({ createdAt: -1 })
    },

    async findById(id, tenantId) {
        const prontuario = await ProntuarioModel.findOne({ _id: id, tenantId })
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('convenioId')

        if (!prontuario) {
            throw new AppError('Prontuário não encontrado', 404)
        }
        return prontuario
    },

    async createProntuario(body, tenantId) {
        const prontuarioDTO = createProntuarioDTO(body)
        return await ProntuarioModel.create({
            ...prontuarioDTO,
            tenantId,
            atendimentoIniciadoEm: new Date(),
        })
    },

    async updateProntuario(id, tenantId, body) {
        const prontuarioDTO = updateProntuarioDTO(body)
        const prontuario = await ProntuarioModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: prontuarioDTO },
            { new: true, runValidators: true }
        )

        if (!prontuario) {
            throw new AppError('Prontuário não encontrado', 404)
        }

        return prontuario
    },

    async finalizarAtendimento(id, tenantId, body) {
        const prontuarioDTO = updateProntuarioDTO(body)
        const prontuario = await ProntuarioModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { ...prontuarioDTO, atendimentoFinalizadoEm: new Date() } },
            { new: true, runValidators: true }
        )

        if (!prontuario) {
            throw new AppError('Prontuário não encontrado', 404)
        }

        return prontuario
    },

    async deleteProntuario(id, tenantId) {
        const prontuario = await ProntuarioModel.findOneAndDelete({ _id: id, tenantId })
        if (!prontuario) {
            throw new AppError('Prontuário não encontrado', 404)
        }
        return null
    },
}