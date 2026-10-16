import mongoose from 'mongoose'

// Quem assinou e como: é a prova da assinatura eletrônica simples (Lei 14.063/2020).
const assinaturaSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    documento: { type: String, required: true, trim: true },
    // 'paciente' (o próprio) ou 'responsavel' (pais ou responsável legal de menor).
    relacao: { type: String, enum: ['paciente', 'responsavel'], required: true },
    // Desenho da assinatura (PNG em data URL). Pesado: fica fora das listagens.
    imagem: { type: String, required: true, select: false },
    assinadoEm: { type: Date, required: true },
    ip: { type: String, default: '' },
    aparelho: { type: String, default: '' },
    // Resumo (SHA-256) do texto + dados de quem assinou: mostra que nada mudou depois da assinatura.
    hashAssinatura: { type: String, required: true },
}, { _id: false })

// Termo enviado a um paciente. O texto fica congelado no envio (mudar o modelo depois não altera este termo).
const termoSchema = new mongoose.Schema({
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true, index: true },
    modeloId: { type: mongoose.Schema.Types.ObjectId, ref: 'termo_modelos', default: null },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', default: null },
    titulo: { type: String, required: true },
    texto: { type: String, required: true },
    // SHA-256 do título + texto no momento do envio.
    hashDocumento: { type: String, required: true },
    // Chave do link de assinatura (secreta, aleatória). Quem tem o link vê e assina este termo.
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pendente', 'assinado', 'cancelado'], default: 'pendente', index: true },
    expiraEm: { type: Date, required: true },
    enviadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },
    assinatura: { type: assinaturaSchema, default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

const TermoModel = mongoose.models.termos || mongoose.model('termos', termoSchema)

export default TermoModel
