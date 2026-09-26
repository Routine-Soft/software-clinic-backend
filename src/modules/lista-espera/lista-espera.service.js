import ListaEsperaModel from './lista-espera.model.js'
import { createListaEsperaDTO, updateListaEsperaDTO } from './lista-espera.dto.js'
import AppError from '../../errors/AppError.js'

export const ListaEsperaService = {
    async findAll(tenantId, filtros = {}) {
        const query = { tenantId }

        if (filtros.especialidadeId) {
            query.especialidadeId = filtros.especialidadeId
        }

        if (filtros.status) {
            query.status = filtros.status
        }

        return await ListaEsperaModel.find(query)
            .populate('pacienteId')
            .populate('especialidadeId')
            .populate('profissionalId')
            .sort({ createdAt: 1 })
    },

    async findById(id, tenantId) {
        const item = await ListaEsperaModel.findOne({ _id: id, tenantId })
            .populate('pacienteId')
            .populate('especialidadeId')
            .populate('profissionalId')

        if (!item) {
            throw new AppError('Item da lista de espera não encontrado', 404)
        }
        return item
    },

    async createListaEspera(body, tenantId) {
        const listaEsperaDTO = createListaEsperaDTO(body)
        return await ListaEsperaModel.create({ ...listaEsperaDTO, tenantId })
    },

    async updateListaEspera(id, tenantId, body) {
        const listaEsperaDTO = updateListaEsperaDTO(body)
        const item = await ListaEsperaModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: listaEsperaDTO },
            { new: true, runValidators: true }
        )

        if (!item) {
            throw new AppError('Item da lista de espera não encontrado', 404)
        }

        return item
    },

    async deleteListaEspera(id, tenantId) {
        const item = await ListaEsperaModel.findOneAndDelete({ _id: id, tenantId })
        if (!item) {
            throw new AppError('Item da lista de espera não encontrado', 404)
        }
        return null
    },
}