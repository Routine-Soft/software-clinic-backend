import AvaliacaoNr01Model from './avaliacao-nr01.model.js'
import { createAvaliacaoNr01DTO, updateAvaliacaoNr01DTO } from './avaliacao-nr01.dto.js'
import { validarServicoDoModulo } from '../servico/servico.modulo.js'
import AppError from '../../errors/AppError.js'

export const AvaliacaoNr01Service = {
    async findAll(tenantId, filtros = {}) {
        const query = { tenantId }

        if (filtros.empresaId) {
            query.empresaId = filtros.empresaId
        }

        return await AvaliacaoNr01Model.find(query)
            .populate('empresaId')
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('servicoId', 'nome')
            .sort({ data: -1 })
    },

    async findById(id, tenantId) {
        const avaliacao = await AvaliacaoNr01Model.findOne({ _id: id, tenantId })
            .populate('empresaId')
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('servicoId', 'nome')

        if (!avaliacao) {
            throw new AppError('Avaliação NR-01 não encontrada', 404)
        }
        return avaliacao
    },

    async createAvaliacao(body, tenantId) {
        const avaliacaoDTO = createAvaliacaoNr01DTO(body)
        await validarServicoDoModulo(avaliacaoDTO.servicoId, tenantId, 'nr01')
        return await AvaliacaoNr01Model.create({ ...avaliacaoDTO, tenantId })
    },

    async updateAvaliacao(id, tenantId, body) {
        const avaliacaoDTO = updateAvaliacaoNr01DTO(body)
        await validarServicoDoModulo(avaliacaoDTO.servicoId, tenantId, 'nr01')
        const avaliacao = await AvaliacaoNr01Model.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: avaliacaoDTO },
            { new: true, runValidators: true }
        )

        if (!avaliacao) {
            throw new AppError('Avaliação NR-01 não encontrada', 404)
        }

        return avaliacao
    },

    async deleteAvaliacao(id, tenantId) {
        const avaliacao = await AvaliacaoNr01Model.findOneAndDelete({ _id: id, tenantId })
        if (!avaliacao) {
            throw new AppError('Avaliação NR-01 não encontrada', 404)
        }
        return null
    },
}
