import mongoose from 'mongoose'
import ProntuarioModel from './prontuario.model.js'
import PacienteModel, { CAMPOS_PERFIL_CLINICO } from '../paciente/paciente.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import { createProntuarioDTO, updateProntuarioDTO } from './prontuario.dto.js'
import { ProntuarioAcesso } from './prontuario.acesso.js'
import AppError from '../../errors/AppError.js'

// Todas as funções recebem o contexto { usuario, ip } da requisição; o tenant vem do cadastro do profissional.
function popular(query) {
    return query
        .populate('pacienteId', 'nome')
        .populate('profissionalId', 'nome')
        .populate('convenioId', 'nome')
        .populate('adendos.profissionalId', 'nome')
        .populate('compartilhadoCom', 'nome')
}

async function carregar(id, tenantId) {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Prontuário não encontrado', 404)
    const prontuario = await ProntuarioModel.findOne({ _id: id, tenantId })
    if (!prontuario) throw new AppError('Prontuário não encontrado', 404)
    return prontuario
}

async function contextoDe(contexto) {
    const profissional = await ProntuarioAcesso.exigirProfissional(contexto.usuario)
    return { ...contexto, profissional }
}

export const ProntuarioService = {
    // Diz ao site se o login pode abrir prontuários, sem erro: a agenda e a home usam para decidir o que mostrar.
    // Só a quantidade de atendimentos abertos agora na clínica, sem nenhum dado do paciente nem texto clínico:
    // serve para a recepção e o admin acompanharem o movimento sem ter acesso aos prontuários.
    async totalEmAtendimento(usuario) {
        const total = await ProntuarioModel.countDocuments({
            tenantId: usuario.tenantId,
            atendimentoIniciadoEm: { $ne: null },
            atendimentoFinalizadoEm: null,
        })
        return { total }
    },

    async acesso(contexto) {
        const profissional = await ProntuarioAcesso.profissionalDoUsuario(contexto.usuario)
        return { profissional: profissional ? { _id: profissional._id, nome: profissional.nome } : null }
    },

    // Com pacienteId: os atendimentos que o profissional pode ler (os dele e os liberados para a especialidade
    // dele), mais o perfil clínico, e registra a leitura.
    // Sem pacienteId: só um resumo (datas e situação, sem texto clínico) para as listas e contadores.
    async findAll(contextoRequisicao, filtros = {}) {
        const contexto = await contextoDe(contextoRequisicao)
        const { profissional } = contexto
        const tenantId = profissional.tenantId

        if (!filtros.pacienteId) {
            const resumo = await ProntuarioModel.find({ tenantId, ...ProntuarioAcesso.filtroLeitura(profissional) })
                .select('pacienteId profissionalId createdAt atendimentoIniciadoEm atendimentoFinalizadoEm')
                .sort({ createdAt: -1 })
            return { prontuarios: resumo }
        }

        if (!mongoose.isValidObjectId(filtros.pacienteId)) throw new AppError('Paciente não encontrado', 404)
        const paciente = await PacienteModel.findOne({ _id: filtros.pacienteId, tenantId })
            .select(CAMPOS_PERFIL_CLINICO.map((campo) => `+${campo}`).join(' '))
        if (!paciente) throw new AppError('Paciente não encontrado', 404)

        const prontuarios = await popular(
            ProntuarioModel.find({ tenantId, pacienteId: paciente._id, ...ProntuarioAcesso.filtroLeitura(profissional) }),
        ).sort({ createdAt: -1 })
        const podeVerPerfil = prontuarios.length > 0 || await ProntuarioAcesso.atendeOPaciente(profissional, paciente._id)
        const perfilClinico = podeVerPerfil
            ? Object.fromEntries(CAMPOS_PERFIL_CLINICO.map((campo) => [campo, paciente[campo] ?? '']))
            : null

        await ProntuarioAcesso.registrar(contexto, 'leitura', prontuarios.map((p) => ({ pacienteId: paciente._id, prontuarioId: p._id })))
        if (podeVerPerfil) await ProntuarioAcesso.registrar(contexto, 'perfil_leitura', { pacienteId: paciente._id })

        return { prontuarios, perfilClinico }
    },

    async findById(contextoRequisicao, id) {
        const contexto = await contextoDe(contextoRequisicao)
        const prontuario = await carregar(id, contexto.profissional.tenantId)
        if (!ProntuarioAcesso.podeLerProntuario(contexto.profissional, prontuario)) {
            throw new AppError('Este atendimento não foi liberado para a sua especialidade.', 403)
        }
        await ProntuarioAcesso.registrar(contexto, 'leitura', { pacienteId: prontuario.pacienteId, prontuarioId: prontuario._id })
        return await popular(ProntuarioModel.findById(prontuario._id))
    },

    // O autor é sempre o profissional logado; o que vier no corpo como profissionalId é ignorado.
    async createProntuario(contextoRequisicao, body) {
        const contexto = await contextoDe(contextoRequisicao)
        const { profissional } = contexto
        const tenantId = profissional.tenantId
        const dto = createProntuarioDTO(body)

        if (!mongoose.isValidObjectId(dto.pacienteId) || !(await PacienteModel.exists({ _id: dto.pacienteId, tenantId }))) {
            throw new AppError('Paciente não encontrado', 404)
        }
        if (dto.agendamentoId && !(await AgendaModel.exists({ _id: dto.agendamentoId, tenantId, pacienteId: dto.pacienteId }))) {
            throw new AppError('Agendamento não encontrado para este paciente', 404)
        }
        const emAndamento = await ProntuarioModel.exists({
            tenantId, pacienteId: dto.pacienteId, profissionalId: profissional._id, atendimentoFinalizadoEm: null,
        })
        if (emAndamento) {
            throw new AppError('Você já tem um atendimento em andamento com este paciente. Finalize-o antes de iniciar outro.', 409)
        }

        const compartilhadoCom = await ProntuarioAcesso.validarEspecialidades(body?.compartilhadoCom ?? [], tenantId)

        const prontuario = await ProntuarioModel.create({
            ...dto,
            compartilhadoCom,
            profissionalId: profissional._id,
            tenantId,
            atendimentoIniciadoEm: new Date(),
        })
        await ProntuarioAcesso.registrar(contexto, 'criacao', { pacienteId: prontuario.pacienteId, prontuarioId: prontuario._id })
        return await popular(ProntuarioModel.findById(prontuario._id))
    },

    async updateProntuario(contextoRequisicao, id, body) {
        return await this.salvarAtendimento(contextoRequisicao, id, body, false)
    },

    async finalizarAtendimento(contextoRequisicao, id, body) {
        return await this.salvarAtendimento(contextoRequisicao, id, body, true)
    },

    async salvarAtendimento(contextoRequisicao, id, body, finalizar) {
        const contexto = await contextoDe(contextoRequisicao)
        const prontuario = await carregar(id, contexto.profissional.tenantId)
        ProntuarioAcesso.exigirAutor(contexto.profissional, prontuario, 'Só o profissional que registrou o atendimento pode alterá-lo.')

        const alteracoes = updateProntuarioDTO(body)
        if (finalizar) alteracoes.atendimentoFinalizadoEm = new Date()

        // O filtro repete "não finalizado": duas abas salvando ao mesmo tempo não reabrem um atendimento fechado.
        const salvo = await ProntuarioModel.findOneAndUpdate(
            { _id: prontuario._id, atendimentoFinalizadoEm: null },
            { $set: alteracoes },
            { returnDocument: 'after', runValidators: true },
        )
        if (!salvo) {
            throw new AppError('Este atendimento já foi finalizado e não pode mais ser alterado. Para corrigir ou complementar, registre um adendo.', 409)
        }

        await ProntuarioAcesso.registrar(contexto, finalizar ? 'finalizacao' : 'edicao', { pacienteId: salvo.pacienteId, prontuarioId: salvo._id })
        return await popular(ProntuarioModel.findById(salvo._id))
    },

    // O autor escolhe a qualquer momento (também depois de finalizar) quais especialidades podem ler.
    async compartilhar(contextoRequisicao, id, body) {
        const contexto = await contextoDe(contextoRequisicao)
        const prontuario = await carregar(id, contexto.profissional.tenantId)
        ProntuarioAcesso.exigirAutor(contexto.profissional, prontuario, 'Só o profissional que registrou o atendimento escolhe quem pode lê-lo.')
        const compartilhadoCom = await ProntuarioAcesso.validarEspecialidades(body?.compartilhadoCom, contexto.profissional.tenantId)
        await ProntuarioModel.updateOne({ _id: prontuario._id }, { $set: { compartilhadoCom } })
        await ProntuarioAcesso.registrar(contexto, 'compartilhamento', { pacienteId: prontuario.pacienteId, prontuarioId: prontuario._id })
        return await popular(ProntuarioModel.findById(prontuario._id))
    },

    async adicionarAdendo(contextoRequisicao, id, body) {
        const contexto = await contextoDe(contextoRequisicao)
        const prontuario = await carregar(id, contexto.profissional.tenantId)
        ProntuarioAcesso.exigirAutor(contexto.profissional, prontuario, 'Só o profissional que registrou o atendimento pode acrescentar um adendo.')
        if (!prontuario.atendimentoFinalizadoEm) {
            throw new AppError('O atendimento ainda está em andamento: edite o texto diretamente.', 409)
        }

        const texto = String(body?.texto ?? '').trim()
        if (!texto) throw new AppError('Escreva o texto do adendo', 400)
        if (texto.length > 5000) throw new AppError('O adendo pode ter no máximo 5000 caracteres', 400)

        await ProntuarioModel.updateOne(
            { _id: prontuario._id },
            { $push: { adendos: { texto, profissionalId: contexto.profissional._id, criadoEm: new Date() } } },
        )
        await ProntuarioAcesso.registrar(contexto, 'adendo', { pacienteId: prontuario.pacienteId, prontuarioId: prontuario._id })
        return await popular(ProntuarioModel.findById(prontuario._id))
    },

    async atualizarPerfilClinico(contextoRequisicao, pacienteId, body) {
        const contexto = await contextoDe(contextoRequisicao)
        const tenantId = contexto.profissional.tenantId
        if (!mongoose.isValidObjectId(pacienteId) || !(await PacienteModel.exists({ _id: pacienteId, tenantId }))) {
            throw new AppError('Paciente não encontrado', 404)
        }
        if (!(await ProntuarioAcesso.podeVerPerfil(contexto.profissional, pacienteId))) {
            throw new AppError('Você não atende este paciente, então não pode alterar o perfil clínico dele.', 403)
        }

        const alteracoes = Object.fromEntries(
            CAMPOS_PERFIL_CLINICO.filter((campo) => campo in (body ?? {})).map((campo) => [campo, String(body[campo] ?? '')]),
        )
        const paciente = await PacienteModel.findOneAndUpdate(
            { _id: pacienteId, tenantId },
            { $set: alteracoes },
            { returnDocument: 'after', projection: CAMPOS_PERFIL_CLINICO.join(' ') },
        )
        await ProntuarioAcesso.registrar(contexto, 'perfil_edicao', { pacienteId })
        return Object.fromEntries(CAMPOS_PERFIL_CLINICO.map((campo) => [campo, paciente[campo] ?? '']))
    },
}
