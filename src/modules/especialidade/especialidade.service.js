import EspecialidadeModel from './especialidade.model.js'
import { createEspecialidadeDTO, updateEspecialidadeDTO } from './especialidade.dto.js'
import AppError from '../../errors/AppError.js'

export const EspecialidadeService = {
    async findAll(tenantId) {
        return await EspecialidadeModel.find({ tenantId })
    },

    async findById(id, tenantId) {
        const especialidade = await EspecialidadeModel.findOne({ _id: id, tenantId })
        if (!especialidade) {
            throw new AppError('Especialidade não encontrada', 404)
        }
        return especialidade
    },

    async createEspecialidade(body, tenantId) {
        const especialidadeDTO = createEspecialidadeDTO(body)
        try {
            return await EspecialidadeModel.create({ ...especialidadeDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe uma especialidade com este nome', 409)
            }
            throw error
        }
    },

    async updateEspecialidade(id, tenantId, body) {
        const especialidadeDTO = updateEspecialidadeDTO(body)
        const especialidade = await EspecialidadeModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: especialidadeDTO },
            { new: true, runValidators: true }
        )

        if (!especialidade) {
            throw new AppError('Especialidade não encontrada', 404)
        }

        return especialidade
    },

    async deleteEspecialidade(id, tenantId) {
        const especialidade = await EspecialidadeModel.findOneAndDelete({ _id: id, tenantId })
        if (!especialidade) {
            throw new AppError('Especialidade não encontrada', 404)
        }
        return null
    },
}