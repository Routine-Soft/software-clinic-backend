import PlanoModel from './plano.model.js'
import { createPlanoDTO, updatePlanoDTO } from './plano.dto.js'
import AppError from '../../errors/AppError.js'

export const PlanoService = {
    async findAll() {
        return await PlanoModel.find()
    },

    async findById(id) {
        const plano = await PlanoModel.findById(id)
        if (!plano) {
            throw new AppError('Plano não encontrado', 404)
        }
        return plano
    },

    async createPlano(body) {
        const planoDTO = createPlanoDTO(body)
        return await PlanoModel.create(planoDTO)
    },

    async updatePlano(id, body) {
        const planoDTO = updatePlanoDTO(body)
        const plano = await PlanoModel.findByIdAndUpdate(id, { $set: planoDTO }, { new: true, runValidators: true })
        if (!plano) {
            throw new AppError('Plano não encontrado', 404)
        }
        return plano
    },

    async deletePlano(id) {
        const plano = await PlanoModel.findByIdAndDelete(id)
        if (!plano) {
            throw new AppError('Plano não encontrado', 404)
        }
        return null
    },
}