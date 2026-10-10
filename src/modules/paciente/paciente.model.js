import mongoose from 'mongoose'

// Responsável legal (pais, avós, tutor). Usado principalmente para pacientes menores de idade.
const responsavelSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    parentesco: { type: String, default: '', trim: true },
    cpf: { type: String, default: '', trim: true },
    telefone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
}, { _id: false })

const pacienteSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    // Obrigatórios para adultos; para menores de idade, o contato pode ser só o dos responsáveis
    // (a regra fica em paciente.service.js, porque depende da data de nascimento).
    telefone: { type: String, default: '' },
    email: { type: String, default: '', trim: true, lowercase: true },
    // Opcional: nem toda criança tem CPF (aí vale o CPF do responsável, guardado em responsaveis).
    cpf: { type: String, default: '', trim: true },
    dataNascimento: { type: Date, required: true },
    convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', default: null },
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'empresas', default: null },
    responsaveis: {
        type: [responsavelSchema],
        default: [],
        validate: { validator: (lista) => lista.length <= 2, message: 'Informe no máximo dois responsáveis' },
    },
    // Paciente criado só para experimentar o sistema. Só é marcado no cadastro (nunca depois) e, ao ser excluído,
    // leva junto prontuário, agendamentos e avaliações, sem a guarda de 20 anos que vale para paciente real.
    teste: { type: Boolean, default: false },

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

// Um mesmo CPF não pode se repetir dentro da mesma clínica (tenant). Só vale para CPF preenchido:
// vários pacientes sem CPF convivem normalmente.
pacienteSchema.index(
    { tenantId: 1, cpf: 1 },
    { unique: true, name: 'cpf_unico_preenchido', partialFilterExpression: { cpf: { $gt: '' } } }
)

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