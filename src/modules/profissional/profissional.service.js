import mongoose from 'mongoose'
import ProfissionalModel from './profissional.model.js'
import UserModel from '../user/user.model.js'
import { createProfissionalDTO, updateProfissionalDTO } from './profissional.dto.js'
import AppError from '../../errors/AppError.js'

// O login vinculado precisa ser desta clínica (profissional, admin ou o super admin que também atende) e só pode
// pertencer a um profissional.
async function validarUsuarioVinculado(usuarioId, tenantId, profissionalId = null) {
    if (!usuarioId) return
    const usuario = mongoose.isValidObjectId(usuarioId)
        ? await UserModel.findOne({ _id: usuarioId, tenantId, role: { $in: ['profissional', 'admin', 'super_admin'] } })
        : null
    if (!usuario) {
        throw new AppError('Usuário não encontrado nesta clínica. Só é possível vincular usuários com função Profissional, Administrador ou Super admin.', 400)
    }
    const outro = await ProfissionalModel.findOne({ tenantId, usuarioId, ...(profissionalId ? { _id: { $ne: profissionalId } } : {}) })
    if (outro) {
        throw new AppError(`Este usuário já está vinculado ao profissional ${outro.nome}`, 409)
    }
}

export const ProfissionalService = {
    async findAll(tenantId) {
        return await ProfissionalModel.find({ tenantId }).populate('especialidadeIds').populate('usuarioId')
    },

    async findById(id, tenantId) {
        const profissional = await ProfissionalModel.findOne({ _id: id, tenantId }).populate('especialidadeIds').populate('usuarioId')
        if (!profissional) {
            throw new AppError('Profissional não encontrado', 404)
        }
        return profissional
    },

    async createProfissional(body, tenantId) {
        const profissionalDTO = createProfissionalDTO(body)
        await validarUsuarioVinculado(profissionalDTO.usuarioId, tenantId)
        try {
            return await ProfissionalModel.create({ ...profissionalDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um profissional com este registro', 409)
            }
            throw error
        }
    },

    async updateProfissional(id, tenantId, body) {
        const profissionalDTO = updateProfissionalDTO(body)
        if ('usuarioId' in profissionalDTO) {
            profissionalDTO.usuarioId = profissionalDTO.usuarioId || null
            await validarUsuarioVinculado(profissionalDTO.usuarioId, tenantId, id)
        }
        const profissional = await ProfissionalModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: profissionalDTO },
            { new: true, runValidators: true }
        )

        if (!profissional) {
            throw new AppError('Profissional não encontrado', 404)
        }

        return profissional
    },

    async deleteProfissional(id, tenantId) {
        const profissional = await ProfissionalModel.findOneAndDelete({ _id: id, tenantId })
        if (!profissional) {
            throw new AppError('Profissional não encontrado', 404)
        }
        return null
    },
}