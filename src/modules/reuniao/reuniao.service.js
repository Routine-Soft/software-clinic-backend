import mongoose from 'mongoose'
import ReuniaoModel from './reuniao.model.js'
import { createReuniaoDTO, updateReuniaoDTO } from './reuniao.dto.js'
import AppError from '../../errors/AppError.js'

const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/
const STATUS = ['aguardando', 'realizado', 'cancelado']

function validarReuniao(reuniao) {
    if (!reuniao.nome?.trim()) {
        throw new AppError('Informe com quem é a reunião', 400)
    }
    if (!reuniao.data || Number.isNaN(new Date(reuniao.data).getTime())) {
        throw new AppError('Informe a data da reunião', 400)
    }
    if (!HORARIO.test(reuniao.horaInicio ?? '') || !HORARIO.test(reuniao.horaFim ?? '')) {
        throw new AppError('Informe o horário de início e de fim', 400)
    }
    if (reuniao.horaFim <= reuniao.horaInicio) {
        throw new AppError('O horário final precisa ser depois do inicial', 400)
    }
    if (reuniao.status !== undefined && !STATUS.includes(reuniao.status)) {
        throw new AppError('Situação da reunião inválida', 400)
    }
}

async function buscar(id, tenantId) {
    const reuniao = mongoose.isValidObjectId(id) ? await ReuniaoModel.findOne({ _id: id, tenantId }) : null
    if (!reuniao) {
        throw new AppError('Reunião não encontrada', 404)
    }
    return reuniao
}

export const ReuniaoService = {
    async findAll(tenantId, filtros = {}) {
        const query = { tenantId }
        if (filtros.dataInicio && filtros.dataFim) {
            query.data = { $gte: new Date(filtros.dataInicio), $lte: new Date(filtros.dataFim) }
        }
        return await ReuniaoModel.find(query).sort({ data: 1, horaInicio: 1 })
    },

    async findById(id, tenantId) {
        return await buscar(id, tenantId)
    },

    async createReuniao(body, tenantId) {
        const reuniaoDTO = createReuniaoDTO(body)
        validarReuniao(reuniaoDTO)
        return await ReuniaoModel.create({ ...reuniaoDTO, tenantId })
    },

    async updateReuniao(id, tenantId, body) {
        const reuniao = await buscar(id, tenantId)
        reuniao.set(updateReuniaoDTO(body))
        validarReuniao(reuniao)
        return await reuniao.save()
    },

    async deleteReuniao(id, tenantId) {
        const reuniao = await buscar(id, tenantId)
        await reuniao.deleteOne()
        return null
    },
}
