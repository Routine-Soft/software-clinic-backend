import mongoose from 'mongoose'

// Anamnese preenchida no prontuário. Guarda a cópia das seções do modelo usado: editar o modelo depois não muda
// o que já foi respondido. Segue o sigilo do prontuário: lê o autor e as especialidades que ele liberar.
const anamneseSchema = new mongoose.Schema({
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    modeloId: { type: mongoose.Schema.Types.ObjectId, ref: 'anamnese_modelos', default: null },
    titulo: { type: String, required: true },
    secoes: { type: [mongoose.Schema.Types.Mixed], required: true },
    respostas: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    compartilhadoCom: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'especialidades' }], default: [] },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
}, { timestamps: true, minimize: false })

anamneseSchema.index({ tenantId: 1, pacienteId: 1, createdAt: -1 })

const AnamneseModel = mongoose.models.anamneses || mongoose.model('anamneses', anamneseSchema)

export default AnamneseModel
