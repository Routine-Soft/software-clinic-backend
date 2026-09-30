import mongoose from 'mongoose'

const pacienteSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    telefone: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    cpf: { type: String, required: true },
    dataNascimento: { type: Date, required: true },
    convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', default: null },
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'empresas', default: null },

    // Perfil clínico: dado de saúde, fica fora de toda consulta por padrão (select: false), inclusive nos
    // populate da agenda. Só o módulo de prontuário lê e grava, com as regras de sigilo.
    antecedentesClinicos: { type: String, default: '', select: false },
    antecedentesCirurgicos: { type: String, default: '', select: false },
    antecedentesFamiliares: { type: String, default: '', select: false },
    habitos: { type: String, default: '', select: false },
    alergias: { type: String, default: '', select: false },
    medicamentosEmUso: { type: String, default: '', select: false },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

// Um mesmo CPF não pode se repetir dentro da mesma clínica (tenant)
pacienteSchema.index({ tenantId: 1, cpf: 1 }, { unique: true })

export const CAMPOS_PERFIL_CLINICO = [
    'antecedentesClinicos',
    'antecedentesCirurgicos',
    'antecedentesFamiliares',
    'habitos',
    'alergias',
    'medicamentosEmUso',
]

const PacienteModel = mongoose.models.pacientes || mongoose.model('pacientes', pacienteSchema);

export default PacienteModel;