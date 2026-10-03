import mongoose from 'mongoose'

// Avaliação neuropsicológica, organizada como o laudo da Resolução CFP 06/2019:
// identificação, descrição da demanda, procedimento, análise, conclusão e referências.

const anamneseSchema = new mongoose.Schema({
    gestacaoParto: { type: String, default: '' },
    desenvolvimento: { type: String, default: '' },
    escolaridade: { type: String, default: '' },
    historicoMedico: { type: String, default: '' },
    medicamentos: { type: String, default: '' },
    historicoFamiliar: { type: String, default: '' },
    aspectosEmocionais: { type: String, default: '' },
    rotinaSono: { type: String, default: '' },
    relacoesSociais: { type: String, default: '' },
}, { _id: false })

const sessaoSchema = new mongoose.Schema({
    data: { type: Date, default: null },
    duracaoMin: { type: Number, default: null, min: 0 },
    descricao: { type: String, default: '' },
}, { _id: false })

const instrumentoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    dominio: { type: String, default: '' },
    escoreBruto: { type: String, default: '' },
    escorePadrao: { type: String, default: '' },
    percentil: { type: Number, default: null, min: 0, max: 100 },
    classificacao: { type: String, default: '' },
    observacao: { type: String, default: '' },
}, { _id: false })

const avaliacaoNeuropsicologicaSchema = new mongoose.Schema({
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    servicoId: { type: mongoose.Schema.Types.ObjectId, ref: 'servicos', default: null },

    // Identificação e demanda
    solicitante: { type: String, default: '' },
    finalidade: { type: String, default: '' },
    demanda: { type: String, default: '' },

    anamnese: { type: anamneseSchema, default: () => ({}) },

    // Procedimento
    informantes: { type: String, default: '' },
    procedimento: { type: String, default: '' },
    sessoes: { type: [sessaoSchema], default: [] },
    instrumentos: { type: [instrumentoSchema], default: [] },

    // Análise e conclusão
    analise: { type: String, default: '' },
    hipoteseDiagnostica: { type: String, default: '' },
    cid: { type: String, default: '' },
    conclusao: { type: String, default: '' },
    encaminhamentos: { type: String, default: '' },
    referencias: { type: String, default: '' },

    devolutivaEm: { type: Date, default: null },
    devolutivaObservacoes: { type: String, default: '' },

    finalizadaEm: { type: Date, default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

avaliacaoNeuropsicologicaSchema.index({ tenantId: 1, pacienteId: 1, createdAt: -1 })

const AvaliacaoNeuropsicologicaModel = mongoose.models.avaliacoes_neuropsicologicas
    || mongoose.model('avaliacoes_neuropsicologicas', avaliacaoNeuropsicologicaSchema)

export default AvaliacaoNeuropsicologicaModel
