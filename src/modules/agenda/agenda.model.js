import mongoose from 'mongoose'

const formaPagamentoSchema = new mongoose.Schema({
    tipo: { type: String, required: true },
    valor: { type: Number, required: true },
}, { _id: false })

const agendaSchema = new mongoose.Schema({
    data: { type: Date, required: true },
    horaInicio: { type: String, required: true },
    horaFim: { type: String, required: true },

    salaId: { type: mongoose.Schema.Types.ObjectId, ref: 'salas', required: true },
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    servicoId: { type: mongoose.Schema.Types.ObjectId, ref: 'servicos', required: true },
    convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', default: null },

    status: { type: String, enum: ['aguardando', 'realizado', 'cancelado'], default: 'aguardando' },

    grupoRecorrenciaId: { type: mongoose.Schema.Types.ObjectId, default: null },

    financeiro: {
        valor: { type: Number, required: true },
        vencimento: { type: Date, required: true },
        parcelamento: { type: Number, default: 1 },
        formasPagamento: { type: [formaPagamentoSchema], default: [] },
    },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

agendaSchema.index({ tenantId: 1, profissionalId: 1, data: 1 })
agendaSchema.index({ tenantId: 1, salaId: 1, data: 1 })

const AgendaModel = mongoose.models.agendas || mongoose.model('agendas', agendaSchema);

export default AgendaModel;