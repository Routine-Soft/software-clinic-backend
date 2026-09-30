import mongoose from 'mongoose'

// Trilha de auditoria: quem abriu, criou ou alterou cada prontuário, e quando. Só recebe inserções.
const prontuarioAcessoSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    // Nulo quando a ação é no perfil clínico do paciente, e não num atendimento.
    prontuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'prontuarios', default: null },
    acao: {
        type: String,
        enum: ['leitura', 'criacao', 'edicao', 'finalizacao', 'adendo', 'perfil_leitura', 'perfil_edicao'],
        required: true,
    },
    ip: { type: String, default: null },
    em: { type: Date, default: Date.now },
}, { versionKey: false })

prontuarioAcessoSchema.index({ tenantId: 1, pacienteId: 1, em: -1 })
prontuarioAcessoSchema.index({ tenantId: 1, prontuarioId: 1, em: -1 })

const ProntuarioAcessoModel = mongoose.models.prontuario_acessos
    || mongoose.model('prontuario_acessos', prontuarioAcessoSchema)

export default ProntuarioAcessoModel
