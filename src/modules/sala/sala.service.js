import SalaModel from './sala.model.js'
import { createSalaDTO, updateSalaDTO } from './sala.dto.js'
import AppError from '../../errors/AppError.js'

export const SalaService = {
    async findAll(tenantId) {
        return await SalaModel.find({ tenantId })
    },

    async findById(id, tenantId) {
        const sala = await SalaModel.findOne({ _id: id, tenantId })
        if (!sala) {
            throw new AppError('Sala não encontrada', 404)
        }
        return sala
    },

    async createSala(body, tenantId) {
        const salaDTO = createSalaDTO(body)
        try {
            return await SalaModel.create({ ...salaDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe uma sala com este nome', 409)
            }
            throw error
        }
    },

    async updateSala(id, tenantId, body) {
        const salaDTO = updateSalaDTO(body)
        const sala = await SalaModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: salaDTO },
            { new: true, runValidators: true }
        )

        if (!sala) {
            throw new AppError('Sala não encontrada', 404)
        }

        return sala
    },

    async deleteSala(id, tenantId) {
        const sala = await SalaModel.findOneAndDelete({ _id: id, tenantId })
        if (!sala) {
            throw new AppError('Sala não encontrada', 404)
        }
        return null
    },
}