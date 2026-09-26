import mongoose from 'mongoose'
import AgendaModel from './agenda.model.js'
import { createAgendaDTO, updateAgendaDTO } from './agenda.dto.js'
import AppError from '../../errors/AppError.js'

// As datas dos agendamentos são "dia puro" gravado como meia-noite UTC. Por isso o dia da semana e o
// avanço de dia usam métodos UTC: com getDay()/setDate() locais, num fuso negativo (Brasil) a meia-noite
// UTC cai na noite do dia anterior e a série sai um dia deslocada (escolhe quarta, cria quinta).
function gerarDatasRecorrencia(dataInicio, dataFim, diasSemana) {
    const datas = []
    const atual = new Date(dataInicio)
    const fim = new Date(dataFim)

    while (atual <= fim) {
        if (diasSemana.includes(atual.getUTCDay())) {
            datas.push(new Date(atual))
        }
        atual.setUTCDate(atual.getUTCDate() + 1)
    }

    return datas
}

export const AgendaService = {
    async findAll(tenantId, filtros = {}) {
        const query = { tenantId }

        if (filtros.profissionalId) {
            query.profissionalId = filtros.profissionalId
        }

        if (filtros.dataInicio && filtros.dataFim) {
            query.data = { $gte: new Date(filtros.dataInicio), $lte: new Date(filtros.dataFim) }
        }

        return await AgendaModel.find(query)
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('salaId')
            .populate('servicoId')
            .populate('convenioId')
            .sort({ data: 1, horaInicio: 1 })
    },

    async findById(id, tenantId) {
        const agenda = await AgendaModel.findOne({ _id: id, tenantId })
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('salaId')
            .populate('servicoId')
            .populate('convenioId')

        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        return agenda
    },

    async createAgenda(body, tenantId) {
        const agendaDTO = createAgendaDTO(body)

        if (!body.repetir) {
            return await AgendaModel.create({ ...agendaDTO, tenantId })
        }

        const { diasSemana, dataFim } = body.repetir
        const datas = gerarDatasRecorrencia(agendaDTO.data, dataFim, diasSemana)

        if (datas.length === 0) {
            throw new AppError('Nenhuma data válida encontrada para a recorrência informada', 400)
        }

        const grupoRecorrenciaId = new mongoose.Types.ObjectId()

        const documentos = datas.map((data) => ({
            ...agendaDTO,
            data,
            tenantId,
            grupoRecorrenciaId,
        }))

        return await AgendaModel.insertMany(documentos)
    },

    async updateAgenda(id, tenantId, body) {
        const agendaDTO = updateAgendaDTO(body)

        const agenda = await AgendaModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: agendaDTO },
            { new: true, runValidators: true }
        )

        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        return agenda
    },

    async cancelarAgenda(id, tenantId) {
        const agenda = await AgendaModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: { status: 'cancelado' } },
            { new: true }
        )

        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        return agenda
    },

    async cancelarGrupoRecorrencia(grupoRecorrenciaId, tenantId) {
        await AgendaModel.updateMany(
            { grupoRecorrenciaId, tenantId, status: { $ne: 'cancelado' } },
            { $set: { status: 'cancelado' } }
        )
        return null
    },

    async deleteAgenda(id, tenantId) {
        const agenda = await AgendaModel.findOneAndDelete({ _id: id, tenantId })
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        return null
    },
}