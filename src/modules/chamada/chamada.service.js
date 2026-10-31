import AgendaModel from '../agenda/agenda.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import ChamadaModel from './chamada.model.js'
import { nomeParaTv } from './chamada.utils.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import AppError from '../../errors/AppError.js'

// Quantas chamadas a TV mostra (a atual em destaque e as anteriores embaixo).
const CHAMADAS_NA_TV = 6

// O profissional só vê e chama os próprios pacientes; admin e recepção, todos os da clínica.
async function filtroDoUsuario(usuario) {
    if (usuario.role !== 'profissional') return {}
    const proprio = await ProfissionalModel.findOne({ tenantId: usuario.tenantId, usuarioId: usuario.id }, '_id')
    if (!proprio) throw new AppError('Seu usuário não está vinculado a nenhum profissional. Peça ao administrador para vincular.', 403)
    return { profissionalId: proprio._id }
}

async function agendaDeHoje(id, usuario) {
    const agenda = await AgendaModel.findOne({ _id: id, tenantId: usuario.tenantId, ...(await filtroDoUsuario(usuario)) })
    if (!agenda) throw new AppError('Agendamento não encontrado', 404)
    if (agenda.status === 'cancelado') throw new AppError('Este agendamento foi cancelado', 400)
    if (agenda.status === 'faltou') throw new AppError('Este paciente foi marcado como falta', 400)
    if (agenda.data.getTime() !== hojeDiaPuro().getTime()) throw new AppError('Só dá para usar a sala de espera nos agendamentos de hoje', 400)
    return agenda
}

export function chamadaParaTv(chamada) {
    return {
        id: chamada._id,
        paciente: chamada.paciente,
        nomeFalado: chamada.nomeFalado ?? chamada.paciente,
        sala: chamada.sala,
        profissional: chamada.profissional,
        chamadaEm: chamada.createdAt,
    }
}

export const ChamadaService = {
    // Agendamentos de hoje na ordem do horário, com a situação de cada paciente na sala de espera.
    async salaDeEspera(usuario) {
        const agendas = await AgendaModel.find({
            tenantId: usuario.tenantId,
            data: hojeDiaPuro(),
            status: { $nin: ['cancelado', 'faltou'] },
            ...(await filtroDoUsuario(usuario)),
        })
            .populate('pacienteId', 'nome nomeNaTv teste')
            .populate('profissionalId', 'nome exibirNaTv')
            .populate('salaId', 'nome')
            .populate('servicoId', 'nome')
            .sort({ horaInicio: 1 })

        return agendas.map((a) => ({
            id: a._id,
            horaInicio: a.horaInicio,
            horaFim: a.horaFim,
            status: a.status,
            chegouEm: a.chegouEm,
            chamadoEm: a.chamadoEm,
            paciente: a.pacienteId ? { id: a.pacienteId._id, nome: a.pacienteId.nome, nomeNaTv: a.pacienteId.nomeNaTv } : null,
            profissional: a.profissionalId?.nome ?? '',
            sala: a.salaId?.nome ?? '',
            servico: a.servicoId?.nome ?? '',
        }))
    },

    // Marca (ou desfaz) a chegada do paciente.
    async definirChegada(id, usuario, chegou) {
        const agenda = await agendaDeHoje(id, usuario)
        agenda.chegouEm = chegou ? (agenda.chegouEm ?? new Date()) : null
        if (!chegou) agenda.chamadoEm = null
        await agenda.save()
        return { id: agenda._id, chegouEm: agenda.chegouEm, chamadoEm: agenda.chamadoEm }
    },

    // Chama o paciente na TV (de novo, se já foi chamado). Chamar também conta como chegada.
    async chamar(id, usuario) {
        const agenda = await agendaDeHoje(id, usuario)
        await agenda.populate([
            { path: 'pacienteId', select: 'nome nomeNaTv' },
            { path: 'profissionalId', select: 'nome exibirNaTv' },
            { path: 'salaId', select: 'nome' },
        ])

        const agora = new Date()
        await ChamadaModel.create({
            agendaId: agenda._id,
            // A TV mostra e fala o nome completo, a não ser que o paciente esteja marcado para não aparecer.
            paciente: agenda.pacienteId?.nomeNaTv === 'oculto' ? null : nomeParaTv(agenda.pacienteId?.nome, 'completo'),
            nomeFalado: agenda.pacienteId?.nomeNaTv === 'oculto' ? null : nomeParaTv(agenda.pacienteId?.nome, 'completo'),
            sala: agenda.salaId?.nome ?? '',
            profissional: agenda.profissionalId?.exibirNaTv === false ? null : (agenda.profissionalId?.nome ?? null),
            chamadoPor: usuario.id,
            tenantId: usuario.tenantId,
        })
        await AgendaModel.updateOne({ _id: agenda._id }, { $set: { chamadoEm: agora, chegouEm: agenda.chegouEm ?? agora } })
        return { id: agenda._id, chegouEm: agenda.chegouEm ?? agora, chamadoEm: agora }
    },

    // O que a TV mostra: as últimas chamadas de hoje, da mais recente para a mais antiga.
    async ultimasDoDia(tenantId) {
        const inicioDoDia = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T00:00:00-03:00')
        const chamadas = await ChamadaModel.find({ tenantId, createdAt: { $gte: inicioDoDia } })
            .sort({ createdAt: -1 })
            .limit(CHAMADAS_NA_TV)
        return chamadas.map(chamadaParaTv)
    },
}
