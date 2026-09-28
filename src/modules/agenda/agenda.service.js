import mongoose from 'mongoose'
import AgendaModel from './agenda.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import { createAgendaDTO, updateAgendaDTO } from './agenda.dto.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import AppError from '../../errors/AppError.js'

const COMISSAO_PAGA = 'A comissão deste atendimento já foi paga ao profissional'

async function buscarCompleta(id, tenantId) {
    return await AgendaModel.findOne({ _id: id, tenantId })
        .populate('pacienteId')
        .populate('profissionalId')
        .populate('salaId')
        .populate('servicoId')
        .populate('convenioId')
}

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
        const agenda = await buscarCompleta(id, tenantId)

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

        // A comissão de um atendimento realizado pertence ao profissional e ao serviço dele; trocar um dos dois
        // deixaria a comissão no nome errado.
        const atual = await AgendaModel.findOne({ _id: id, tenantId })
        if (!atual) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        const trocaComissao = ['profissionalId', 'servicoId'].some((campo) => campo in agendaDTO && String(agendaDTO[campo]) !== String(atual[campo]))
        if (atual.status === 'realizado' && trocaComissao) {
            throw new AppError('Desmarque o atendimento como realizado antes de trocar o profissional ou o serviço', 409)
        }

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

    // Marca (ou desmarca) o atendimento como realizado. Marcar gera a comissão pendente do profissional, com o valor
    // que o serviço tem agora; desmarcar só é possível enquanto essa comissão não foi paga.
    // O profissional só pode fazer isso nos próprios atendimentos; admin e recepção, em qualquer um da clínica.
    async definirRealizado(id, usuario, realizado) {
        const { tenantId } = usuario
        const agenda = await AgendaModel.findOne({ _id: id, tenantId }).populate('servicoId')
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        if (usuario.role === 'profissional') {
            const doProprio = await ProfissionalModel.exists({ _id: agenda.profissionalId, tenantId, usuarioId: usuario.id })
            if (!doProprio) {
                throw new AppError('Você só pode marcar os seus próprios atendimentos', 403)
            }
        }

        if (realizado) {
            if (agenda.status === 'cancelado') {
                throw new AppError('Um agendamento cancelado não pode ser marcado como realizado', 400)
            }
            if (agenda.data > hojeDiaPuro()) {
                throw new AppError('Só é possível marcar como realizado a partir do dia do atendimento', 400)
            }
            if (agenda.status !== 'realizado') {
                agenda.status = 'realizado'
                agenda.realizadoEm = new Date()
                agenda.comissao = { valor: agenda.servicoId?.comissao ?? 0, pagamentoId: null }
            }
        } else if (agenda.status === 'realizado') {
            if (agenda.comissao?.pagamentoId) {
                throw new AppError(`${COMISSAO_PAGA}; não dá para desmarcar`, 409)
            }
            agenda.status = 'aguardando'
            agenda.realizadoEm = null
            agenda.comissao = { valor: 0, pagamentoId: null }
        }

        await agenda.save()
        return await buscarCompleta(id, tenantId)
    },

    async cancelarAgenda(id, tenantId) {
        const agenda = await AgendaModel.findOne({ _id: id, tenantId })
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        if (agenda.comissao?.pagamentoId) {
            throw new AppError(`${COMISSAO_PAGA}; não dá para cancelar`, 409)
        }

        agenda.status = 'cancelado'
        agenda.realizadoEm = null
        agenda.comissao = { valor: 0, pagamentoId: null }
        await agenda.save()
        return agenda
    },

    // Cancela só as sessões que ainda não aconteceram: as já realizadas continuam valendo (e com a comissão delas).
    async cancelarGrupoRecorrencia(grupoRecorrenciaId, tenantId) {
        await AgendaModel.updateMany(
            { grupoRecorrenciaId, tenantId, status: 'aguardando' },
            { $set: { status: 'cancelado' } }
        )
        return null
    },

    async deleteAgenda(id, tenantId) {
        const agenda = await AgendaModel.findOne({ _id: id, tenantId })
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        if (agenda.comissao?.pagamentoId) {
            throw new AppError(`${COMISSAO_PAGA}; não dá para remover`, 409)
        }
        await agenda.deleteOne()
        return null
    },
}