import mongoose from 'mongoose'

const anexoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    url: { type: String, required: true },
    tipo: { type: String, enum: ['exame', 'foto', 'laudo', 'outro'], default: 'outro' },
}, { _id: false })

const sinaisVitaisSchema = new mongoose.Schema({
    peso: { type: Number, default: null },
    altura: { type: Number, default: null },
    pressaoArterial: { type: String, default: null },
    frequenciaCardiaca: { type: Number, default: null },
    temperatura: { type: Number, default: null },
}, { _id: false })

const prontuarioSchema = new mongoose.Schema({
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'agendas', default: null },
    convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', default: null },

    queixaPrincipal: { type: String, default: '' },
    historicoAtual: { type: String, default: '' },
    exameObjetivo: { type: String, default: '' },
    avaliacao: { type: String, default: '' },
    cid10: { type: String, default: null },
    conduta: { type: String, default: '' },
    informacoes: { type: String, default: '' },

    sinaisVitais: { type: sinaisVitaisSchema, default: null },
    anexos: { type: [anexoSchema], default: [] },
    proximoRetorno: { type: Date, default: null },

    atendimentoIniciadoEm: { type: Date, default: null },
    atendimentoFinalizadoEm: { type: Date, default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

prontuarioSchema.index({ tenantId: 1, pacienteId: 1, createdAt: -1 })

const ProntuarioModel = mongoose.models.prontuarios || mongoose.model('prontuarios', prontuarioSchema);

export default ProntuarioModel;