import ConvenioModel from './convenio.model.js'
import ServicoModel from '../servico/servico.model.js'
import { createConvenioDTO, updateConvenioDTO } from './convenio.dto.js'
import AppError from '../../errors/AppError.js'

export const ConvenioService = {
    async findAll(tenantId) {
        return await ConvenioModel.find({ tenantId })
    },

    async findById(id, tenantId) {
        const convenio = await ConvenioModel.findOne({ _id: id, tenantId })
        if (!convenio) {
            throw new AppError('Convênio não encontrado', 404)
        }
        return convenio
    },

    async createConvenio(body, tenantId) {
        const convenioDTO = createConvenioDTO(body)
        try {
            return await ConvenioModel.create({ ...convenioDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um convênio com este nome', 409)
            }
            throw error
        }
    },

    async updateConvenio(id, tenantId, body) {
        const convenioDTO = updateConvenioDTO(body)
        const convenio = await ConvenioModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: convenioDTO },
            { new: true, runValidators: true }
        )

        if (!convenio) {
            throw new AppError('Convênio não encontrado', 404)
        }

        return convenio
    },

    async deleteConvenio(id, tenantId) {
        const convenio = await ConvenioModel.findOneAndDelete({ _id: id, tenantId })
        if (!convenio) {
            throw new AppError('Convênio não encontrado', 404)
        }
        // O preço e a comissão desse convênio nos serviços deixam de existir junto com ele.
        await ServicoModel.updateMany({ tenantId }, { $pull: { tabelaConvenios: { convenioId: convenio._id } } })
        return null
    },
}