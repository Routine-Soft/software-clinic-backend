import mongoose from 'mongoose'

const respostaSchema = new mongoose.Schema({
    pergunta: { type: String, required: true },
    resposta: { type: String, default: '' },
}, { _id: false })

const avaliacaoNr01Schema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'empresas', required: true },
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', default: null },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    servicoId: { type: mongoose.Schema.Types.ObjectId, ref: 'servicos', default: null },

    data: { type: Date, default: Date.now },
    respostas: { type: [respostaSchema], default: [] },
    classificacaoRisco: { type: String, enum: ['baixo', 'medio', 'alto', null], default: null },
    recomendacoes: { type: String, default: '' },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

avaliacaoNr01Schema.index({ tenantId: 1, empresaId: 1, data: -1 })

const AvaliacaoNr01Model = mongoose.models.avaliacoesnr01 || mongoose.model('avaliacoesnr01', avaliacaoNr01Schema);

export default AvaliacaoNr01Model;
