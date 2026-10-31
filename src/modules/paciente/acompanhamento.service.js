import mongoose from 'mongoose'
import PacienteModel from './paciente.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import AppError from '../../errors/AppError.js'

// Profissionais que acompanham cada paciente. Servem para a recepção saber, sem investigar, com quem o paciente
// se trata, e para a agenda já sugerir esse profissional ao marcar a próxima consulta.

const CAMPOS_PROFISSIONAL = 'nome tipoRegistro numeroRegistro'
const oid = (valor) => new mongoose.Types.ObjectId(String(valor))

// Consulta marcada para o futuro: o acompanhamento conta a partir de hoje (dia em que foi marcada).
function desdeQuando(data) {
    const hoje = hojeDiaPuro()
    const dia = data ? new Date(data) : hoje
    return Number.isNaN(dia.getTime()) || dia > hoje ? hoje : dia
}

async function pacienteCompleto(id, tenantId) {
    return await PacienteModel.findOne({ _id: id, tenantId })
        .populate('convenioId')
        .populate('empresaId')
        .populate('acompanhamentos.profissionalId', CAMPOS_PROFISSIONAL)
}

export const AcompanhamentoService = {
    CAMPOS_PROFISSIONAL,

    // Primeira consulta do paciente com um profissional: ele passa a acompanhar o paciente, a partir da data da
    // consulta. Quem já está (ou já esteve) na lista não volta sozinho: se a recepção encerrou, a decisão vale.
    async registrarConsulta(tenantId, pacienteId, profissionalId, data) {
        if (!mongoose.isValidObjectId(pacienteId) || !mongoose.isValidObjectId(profissionalId)) return
        await PacienteModel.updateOne(
            { _id: pacienteId, tenantId, 'acompanhamentos.profissionalId': { $ne: oid(profissionalId) } },
            { $push: { acompanhamentos: { profissionalId: oid(profissionalId), desde: desdeQuando(data) } } }
        )
    },

    // A recepção (ou o profissional) inclui à mão quem acompanha o paciente, a partir de hoje.
    // Datas em "dia puro" (meia-noite UTC), como as das consultas.
    async adicionar(tenantId, pacienteId, profissionalId) {
        if (!mongoose.isValidObjectId(pacienteId)) throw new AppError('Paciente não encontrado', 404)
        if (!mongoose.isValidObjectId(profissionalId) || !(await ProfissionalModel.exists({ _id: profissionalId, tenantId }))) {
            throw new AppError('Escolha o profissional', 400)
        }
        const resultado = await PacienteModel.updateOne(
            { _id: pacienteId, tenantId, acompanhamentos: { $not: { $elemMatch: { profissionalId: oid(profissionalId), ate: null } } } },
            { $push: { acompanhamentos: { profissionalId: oid(profissionalId), desde: hojeDiaPuro() } } }
        )
        if (resultado.matchedCount === 0) {
            if (!(await PacienteModel.exists({ _id: pacienteId, tenantId }))) throw new AppError('Paciente não encontrado', 404)
            throw new AppError('Este profissional já acompanha o paciente', 409)
        }
        return await pacienteCompleto(pacienteId, tenantId)
    },

    // O profissional deixa de acompanhar: fica no histórico, com a data de saída.
    async encerrar(tenantId, pacienteId, acompanhamentoId) {
        if (!mongoose.isValidObjectId(pacienteId) || !mongoose.isValidObjectId(acompanhamentoId)) {
            throw new AppError('Acompanhamento não encontrado', 404)
        }
        const resultado = await PacienteModel.updateOne(
            { _id: pacienteId, tenantId, acompanhamentos: { $elemMatch: { _id: oid(acompanhamentoId), ate: null } } },
            { $set: { 'acompanhamentos.$.ate': hojeDiaPuro() } }
        )
        if (resultado.matchedCount === 0) throw new AppError('Acompanhamento não encontrado', 404)
        return await pacienteCompleto(pacienteId, tenantId)
    },

    // Pacientes cadastrados antes desta função: monta a lista a partir das consultas que já existem
    // (cada profissional desde a primeira consulta não cancelada). Roda ao subir o servidor e só pega
    // quem ainda não tem o campo, então rodar de novo não muda nada.
    async preencherPacientesAntigos(filtro = {}) {
        const antigos = await PacienteModel.find({ ...filtro, acompanhamentos: { $exists: false } }, '_id tenantId').lean()
        if (antigos.length === 0) return 0

        const consultas = await AgendaModel.aggregate([
            { $match: { pacienteId: { $in: antigos.map((p) => p._id) }, status: { $nin: ['cancelado', 'faltou'] }, profissionalId: { $ne: null } } },
            { $group: { _id: { pacienteId: '$pacienteId', profissionalId: '$profissionalId' }, desde: { $min: '$data' } } },
            { $sort: { desde: 1 } },
        ])
        const porPaciente = new Map()
        for (const c of consultas) {
            const chave = String(c._id.pacienteId)
            if (!porPaciente.has(chave)) porPaciente.set(chave, [])
            porPaciente.get(chave).push({ _id: new mongoose.Types.ObjectId(), profissionalId: c._id.profissionalId, desde: desdeQuando(c.desde), ate: null })
        }

        await PacienteModel.bulkWrite(antigos.map((p) => ({
            updateOne: {
                filter: { _id: p._id, acompanhamentos: { $exists: false } },
                update: { $set: { acompanhamentos: porPaciente.get(String(p._id)) ?? [] } },
            },
        })))
        return antigos.length
    },
}
