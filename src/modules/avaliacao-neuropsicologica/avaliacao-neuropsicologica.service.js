import mongoose from 'mongoose'
import AvaliacaoNeuropsicologicaModel from './avaliacao-neuropsicologica.model.js'
import PacienteModel from '../paciente/paciente.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import { camposEditaveis } from './avaliacao-neuropsicologica.dto.js'
import { ProntuarioAcesso } from '../prontuario/prontuario.acesso.js'
import { validarServicoDoModulo } from '../servico/servico.modulo.js'
import AppError from '../../errors/AppError.js'

// Documento psicológico: segue o mesmo sigilo do prontuário (prontuario.acesso.js).
// Lê quem é autor ou atende o paciente; só o autor altera, e só até finalizar.

function popular(query) {
    return query
        .populate('pacienteId', 'nome dataNascimento')
        .populate('profissionalId', 'nome tipoRegistro numeroRegistro')
        .populate('servicoId', 'nome')
}

async function contextoDe(contexto) {
    const profissional = await ProntuarioAcesso.exigirProfissional(contexto.usuario)
    return { ...contexto, profissional }
}

async function carregar(id, tenantId) {
    const avaliacao = mongoose.isValidObjectId(id)
        ? await AvaliacaoNeuropsicologicaModel.findOne({ _id: id, tenantId })
        : null
    if (!avaliacao) throw new AppError('Avaliação não encontrada', 404)
    return avaliacao
}

const registro = (avaliacao) => ({ pacienteId: avaliacao.pacienteId, avaliacaoId: avaliacao._id })

export const AvaliacaoNeuropsicologicaService = {
    // Lista resumida (sem texto clínico): as do profissional e as dos pacientes que ele atende.
    async findAll(contextoRequisicao) {
        const { profissional } = await contextoDe(contextoRequisicao)
        const tenantId = profissional.tenantId
        const pacientesAtendidos = await AgendaModel.distinct('pacienteId', {
            tenantId,
            profissionalId: profissional._id,
            status: { $ne: 'cancelado' },
        })
        return await AvaliacaoNeuropsicologicaModel.find({
            tenantId,
            $or: [{ profissionalId: profissional._id }, { pacienteId: { $in: pacientesAtendidos } }],
        })
            .select('pacienteId profissionalId servicoId finalidade sessoes.data devolutivaEm finalizadaEm createdAt')
            .populate('pacienteId', 'nome')
            .populate('profissionalId', 'nome')
            .populate('servicoId', 'nome')
            .sort({ createdAt: -1 })
    },

    async findById(contextoRequisicao, id) {
        const contexto = await contextoDe(contextoRequisicao)
        const avaliacao = await carregar(id, contexto.profissional.tenantId)
        if (!(await ProntuarioAcesso.podeLerPorAtendimento(contexto.profissional, avaliacao))) {
            throw new AppError('Você não atende este paciente, então não pode abrir esta avaliação.', 403)
        }
        await ProntuarioAcesso.registrar(contexto, 'avaliacao_leitura', registro(avaliacao))
        return await popular(AvaliacaoNeuropsicologicaModel.findById(avaliacao._id))
    },

    // O autor é sempre o profissional logado.
    async create(contextoRequisicao, body) {
        const contexto = await contextoDe(contextoRequisicao)
        const tenantId = contexto.profissional.tenantId
        const pacienteId = body?.pacienteId
        if (!mongoose.isValidObjectId(pacienteId) || !(await PacienteModel.exists({ _id: pacienteId, tenantId }))) {
            throw new AppError('Paciente não encontrado', 404)
        }
        const dto = camposEditaveis(body)
        await validarServicoDoModulo(dto.servicoId, tenantId, 'neuropsicologica')

        const avaliacao = await AvaliacaoNeuropsicologicaModel.create({
            ...dto,
            pacienteId,
            profissionalId: contexto.profissional._id,
            tenantId,
        })
        await ProntuarioAcesso.registrar(contexto, 'avaliacao_criacao', registro(avaliacao))
        return await popular(AvaliacaoNeuropsicologicaModel.findById(avaliacao._id))
    },

    async update(contextoRequisicao, id, body) {
        return await this.salvar(contextoRequisicao, id, body, false)
    },

    async finalizar(contextoRequisicao, id, body) {
        return await this.salvar(contextoRequisicao, id, body, true)
    },

    async salvar(contextoRequisicao, id, body, finalizar) {
        const contexto = await contextoDe(contextoRequisicao)
        const tenantId = contexto.profissional.tenantId
        const avaliacao = await carregar(id, tenantId)
        ProntuarioAcesso.exigirAutor(contexto.profissional, avaliacao, 'Só o profissional que conduz a avaliação pode alterá-la.')

        const dto = camposEditaveis(body)
        await validarServicoDoModulo(dto.servicoId, tenantId, 'neuropsicologica')
        if (finalizar) dto.finalizadaEm = new Date()

        // O filtro repete "não finalizada": uma avaliação fechada não é reaberta por um salvamento atrasado.
        const salva = await AvaliacaoNeuropsicologicaModel.findOneAndUpdate(
            { _id: avaliacao._id, finalizadaEm: null },
            { $set: dto },
            { returnDocument: 'after', runValidators: true },
        )
        if (!salva) throw new AppError('Esta avaliação já foi finalizada e não pode mais ser alterada.', 409)

        await ProntuarioAcesso.registrar(contexto, finalizar ? 'avaliacao_finalizacao' : 'avaliacao_edicao', registro(salva))
        return await popular(AvaliacaoNeuropsicologicaModel.findById(salva._id))
    },

    // Só o rascunho pode ser excluído (aberta por engano); finalizada, o documento deve ser guardado.
    async remove(contextoRequisicao, id) {
        const contexto = await contextoDe(contextoRequisicao)
        const avaliacao = await carregar(id, contexto.profissional.tenantId)
        ProntuarioAcesso.exigirAutor(contexto.profissional, avaliacao, 'Só o profissional que conduz a avaliação pode excluí-la.')
        const apagada = await AvaliacaoNeuropsicologicaModel.findOneAndDelete({ _id: avaliacao._id, finalizadaEm: null })
        if (!apagada) throw new AppError('Avaliação finalizada não pode ser excluída: o documento psicológico deve ser guardado.', 409)
        await ProntuarioAcesso.registrar(contexto, 'avaliacao_exclusao', registro(avaliacao))
        return null
    },
}
