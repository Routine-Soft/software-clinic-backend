import mongoose from 'mongoose'

// Reunião interna da dona da clínica (ex.: conversa com um cliente antes de ele contratar). Não é atendimento:
// não tem paciente, profissional, serviço, sala nem valor. Só a dona (admin) e a recepção veem.
const reuniaoSchema = new mongoose.Schema({
    // Com quem é a reunião: texto livre, porque normalmente a pessoa ainda não é paciente.
    nome: { type: String, required: true, trim: true },
    telefone: { type: String, default: '', trim: true },
    observacoes: { type: String, default: '', trim: true },

    // "Dia puro" gravado como meia-noite UTC, igual à agenda.
    data: { type: Date, required: true },
    horaInicio: { type: String, required: true },
    horaFim: { type: String, required: true },

    status: { type: String, enum: ['aguardando', 'realizado', 'cancelado'], default: 'aguardando' },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

reuniaoSchema.index({ tenantId: 1, data: 1 })

const ReuniaoModel = mongoose.models.reunioes || mongoose.model('reunioes', reuniaoSchema);

export default ReuniaoModel;
