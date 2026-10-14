import mongoose from 'mongoose'

// Cada vez que um paciente é chamado na TV da sala de espera. Guarda só o texto já pronto para a TV (no formato
// que a clínica escolheu para o paciente), nunca o cadastro dele, e some sozinho depois de 24 horas.
const chamadaSchema = new mongoose.Schema({
    agendaId: { type: mongoose.Schema.Types.ObjectId, ref: 'agendas', required: true },
    // null quando o paciente está marcado para não ter o nome na TV.
    paciente: { type: String, default: null },
    sala: { type: String, default: '' },
    // null quando o profissional não aparece na TV.
    profissional: { type: String, default: null },
    chamadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
}, { timestamps: true, collection: 'chamadas' })

chamadaSchema.index({ tenantId: 1, createdAt: -1 })
chamadaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

const ChamadaModel = mongoose.models.chamadas || mongoose.model('chamadas', chamadaSchema)

export default ChamadaModel
