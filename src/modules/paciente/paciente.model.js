import mongoose from 'mongoose'

const pacienteSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    telefone: { type: String, required: true },
    email: { type: String, required: true },
    cpf: { type: String, required: true },
    dataNascimento: { type: Date, required: true },
    convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', default: null },
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'empresas', default: null },

    antecedentesClinicos: { type: String, default: '' },
    antecedentesCirurgicos: { type: String, default: '' },
    antecedentesFamiliares: { type: String, default: '' },
    habitos: { type: String, default: '' },
    alergias: { type: String, default: '' },
    medicamentosEmUso: { type: String, default: '' },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

// Um mesmo CPF não pode se repetir dentro da mesma clínica (tenant)
pacienteSchema.index({ tenantId: 1, cpf: 1 }, { unique: true })

const PacienteModel = mongoose.models.pacientes || mongoose.model('pacientes', pacienteSchema);

export default PacienteModel;