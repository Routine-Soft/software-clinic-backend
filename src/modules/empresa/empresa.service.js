import EmpresaModel from './empresa.model.js'
import { createEmpresaDTO, updateEmpresaDTO } from './empresa.dto.js'
import AppError from '../../errors/AppError.js'

export const EmpresaService = {
    async findAll(tenantId) {
        return await EmpresaModel.find({ tenantId })
    },

    async findById(id, tenantId) {
        const empresa = await EmpresaModel.findOne({ _id: id, tenantId })
        if (!empresa) {
            throw new AppError('Empresa não encontrada', 404)
        }
        return empresa
    },

    async createEmpresa(body, tenantId) {
        const empresaDTO = createEmpresaDTO(body)
        try {
            return await EmpresaModel.create({ ...empresaDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe uma empresa com este CNPJ nesta clínica', 409)
            }
            throw error
        }
    },

    async updateEmpresa(id, tenantId, body) {
        const empresaDTO = updateEmpresaDTO(body)
        const empresa = await EmpresaModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: empresaDTO },
            { new: true, runValidators: true }
        )

        if (!empresa) {
            throw new AppError('Empresa não encontrada', 404)
        }

        return empresa
    },

    async deleteEmpresa(id, tenantId) {
        const empresa = await EmpresaModel.findOneAndDelete({ _id: id, tenantId })
        if (!empresa) {
            throw new AppError('Empresa não encontrada', 404)
        }
        return null
    },
}
