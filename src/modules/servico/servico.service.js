import ServicoModel from './servico.model.js'
import { createServicoDTO, updateServicoDTO } from './servico.dto.js'
import AppError from '../../errors/AppError.js'

export const ServicoService = {
    async findAll(tenantId) {
        return await ServicoModel.find({ tenantId })
    },

    async findById(id, tenantId) {
        const servico = await ServicoModel.findOne({ _id: id, tenantId })
        if (!servico) {
            throw new AppError('Serviço não encontrado', 404)
        }
        return servico
    },

    async createServico(body, tenantId) {
        const servicoDTO = createServicoDTO(body)
        try {
            return await ServicoModel.create({ ...servicoDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um serviço com este nome', 409)
            }
            throw error
        }
    },

    async updateServico(id, tenantId, body) {
        const servicoDTO = updateServicoDTO(body)
        const servico = await ServicoModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: servicoDTO },
            { new: true, runValidators: true }
        )

        if (!servico) {
            throw new AppError('Serviço não encontrado', 404)
        }

        return servico
    },

    async deleteServico(id, tenantId) {
        const servico = await ServicoModel.findOneAndDelete({ _id: id, tenantId })
        if (!servico) {
            throw new AppError('Serviço não encontrado', 404)
        }
        return null
    },
}