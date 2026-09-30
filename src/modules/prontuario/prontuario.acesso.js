import UserModel from '../user/user.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import ProntuarioModel from './prontuario.model.js'
import ProntuarioAcessoModel from './prontuario-acesso.model.js'
import AppError from '../../errors/AppError.js'

// Regras de sigilo do prontuário (CFM e LGPD):
// - só profissionais de saúde acessam: login "admin" ou "profissional" vinculado a um cadastro de profissional.
//   Recepção e super admin nunca acessam, mesmo que o frontend tente;
// - lê quem é autor do atendimento, ou quem tem ou teve agendamento (não cancelado) com o paciente;
// - só o autor altera, e só até finalizar. Depois disso, correções entram como adendo.

export const ProntuarioAcesso = {
    // Cadastro de profissional ligado ao login, ou null quando o login não pode acessar prontuários.
    async profissionalDoUsuario(usuario) {
        const user = await UserModel.findById(usuario?.id).select('role tenantId')
        if (!user || !['admin', 'profissional'].includes(user.role)) return null
        return await ProfissionalModel.findOne({ tenantId: user.tenantId, usuarioId: user._id }).select('nome tenantId')
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

    // Perfil clínico (alergias, antecedentes): quem atende o paciente ou já registrou algum atendimento dele.
    async podeVerPerfil(profissional, pacienteId) {
        if (await this.atendeOPaciente(profissional, pacienteId)) return true
        return !!(await ProntuarioModel.exists({ tenantId: profissional.tenantId, pacienteId, profissionalId: profissional._id }))
    },

    async podeLer(profissional, prontuario) {
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
        await ProntuarioAcessoModel.insertMany(lista.map(({ pacienteId, prontuarioId = null }) => ({
            tenantId: contexto.profissional.tenantId,
            usuarioId: contexto.usuario.id,
            profissionalId: contexto.profissional._id,
            pacienteId: pacienteId?._id ?? pacienteId,
            prontuarioId,
            acao,
            ip: contexto.ip ?? null,
        })))
    },
}
