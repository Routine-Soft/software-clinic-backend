import UserModel from '../user/user.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import ProntuarioModel from './prontuario.model.js'
import ProntuarioAcessoModel from './prontuario-acesso.model.js'
import EspecialidadeModel from '../especialidade/especialidade.model.js'
import mongoose from 'mongoose'
import AppError from '../../errors/AppError.js'

// Regras de sigilo do prontuário (CFM e LGPD):
// - só profissionais de saúde acessam: login "admin", "profissional" ou "super_admin" vinculado a um cadastro
//   de profissional. A recepção nunca acessa. O super admin só acessa quando ele próprio atende e foi vinculado;
//   como tudo é filtrado pela clínica do cadastro de profissional, ele vê só a clínica dele, nunca a dos clientes;
// - um atendimento do prontuário é lido pelo autor e pelos profissionais das especialidades que o autor
//   liberou (compartilhadoCom). Ter agendamento com o paciente não basta;
// - só o autor altera, e só até finalizar. Depois disso, correções entram como adendo;
// - a avaliação neuropsicológica continua com a regra de quem atende o paciente (podeLerPorAtendimento).

export const ProntuarioAcesso = {
    // Cadastro de profissional ligado ao login, ou null quando o login não pode acessar prontuários.
    async profissionalDoUsuario(usuario) {
        const user = await UserModel.findById(usuario?.id).select('role tenantId')
        if (!user || !['admin', 'profissional', 'super_admin'].includes(user.role)) return null
        return await ProfissionalModel.findOne({ tenantId: user.tenantId, usuarioId: user._id }).select('nome tenantId especialidadeIds')
    },

    async exigirProfissional(usuario) {
        const profissional = await this.profissionalDoUsuario(usuario)
        if (!profissional) {
            throw new AppError(
                'O prontuário é sigiloso: só profissionais de saúde com login vinculado a um cadastro de profissional podem acessá-lo.',
                403,
            )
        }
        return profissional
    },

    // Atende o paciente: tem ou teve agendamento com ele. Com isso, vê todos os atendimentos do paciente.
    async atendeOPaciente(profissional, pacienteId) {
        return !!(await AgendaModel.exists({
            tenantId: profissional.tenantId,
            profissionalId: profissional._id,
            pacienteId,
            status: { $ne: 'cancelado' },
        }))
    },

    // Filtro dos atendimentos que o profissional pode ler: os dele e os liberados para uma especialidade dele.
    filtroLeitura(profissional) {
        return {
            $or: [
                { profissionalId: profissional._id },
                { compartilhadoCom: { $in: profissional.especialidadeIds ?? [] } },
            ],
        }
    },

    podeLerProntuario(profissional, prontuario) {
        if (String(prontuario.profissionalId?._id ?? prontuario.profissionalId) === String(profissional._id)) return true
        const minhas = new Set((profissional.especialidadeIds ?? []).map(String))
        return (prontuario.compartilhadoCom ?? []).some((esp) => minhas.has(String(esp?._id ?? esp)))
    },

    // Perfil clínico (alergias, antecedentes): é dado de segurança do paciente. Vê quem atende o paciente
    // ou quem pode ler algum atendimento dele.
    async podeVerPerfil(profissional, pacienteId) {
        if (await this.atendeOPaciente(profissional, pacienteId)) return true
        return !!(await ProntuarioModel.exists({ tenantId: profissional.tenantId, pacienteId, ...this.filtroLeitura(profissional) }))
    },

    // Especialidades escolhidas pelo autor: precisam existir na clínica. Devolve a lista sem repetição.
    async validarEspecialidades(ids, tenantId) {
        if (!Array.isArray(ids)) throw new AppError('Informe a lista de especialidades', 400)
        const unicos = [...new Set(ids.map(String))]
        if (unicos.some((id) => !mongoose.isValidObjectId(id))) throw new AppError('Especialidade inválida', 400)
        const encontradas = await EspecialidadeModel.countDocuments({ _id: { $in: unicos }, tenantId })
        if (encontradas !== unicos.length) throw new AppError('Especialidade não encontrada nesta clínica', 400)
        return unicos
    },

    // Avaliação neuropsicológica: autor ou quem tem ou teve agendamento com o paciente.
    async podeLerPorAtendimento(profissional, prontuario) {
        if (String(prontuario.profissionalId?._id ?? prontuario.profissionalId) === String(profissional._id)) return true
        return await this.atendeOPaciente(profissional, prontuario.pacienteId?._id ?? prontuario.pacienteId)
    },

    exigirAutor(profissional, prontuario, mensagem) {
        if (String(prontuario.profissionalId?._id ?? prontuario.profissionalId) !== String(profissional._id)) {
            throw new AppError(mensagem, 403)
        }
    },

    async registrar(contexto, acao, registros) {
        const lista = Array.isArray(registros) ? registros : [registros]
        if (lista.length === 0) return
        await ProntuarioAcessoModel.insertMany(lista.map(({ pacienteId, prontuarioId = null, avaliacaoId = null }) => ({
            tenantId: contexto.profissional.tenantId,
            usuarioId: contexto.usuario.id,
            profissionalId: contexto.profissional._id,
            pacienteId: pacienteId?._id ?? pacienteId,
            prontuarioId,
            avaliacaoId,
            acao,
            ip: contexto.ip ?? null,
        })))
    },
}
