import mongoose from 'mongoose'

// Conexão de uma TV, como na Netflix: a TV mostra um código de 6 números e alguém da clínica digita no sistema.
// A TV acompanha pelo `segredoHash` (só ela sabe o segredo); quando a clínica confirma, `painelId` é preenchido e a
// TV busca a chave dela uma única vez. O pedido some sozinho quando vence.
const pareamentoTvSchema = new mongoose.Schema({
    codigo: { type: String, required: true, unique: true },
    segredoHash: { type: String, required: true, unique: true },
    painelId: { type: mongoose.Schema.Types.ObjectId, ref: 'paineistv', default: null },
    expiraEm: { type: Date, required: true },
}, { timestamps: true, collection: 'pareamentostv' })

pareamentoTvSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 })

const PareamentoTvModel = mongoose.models.pareamentostv || mongoose.model('pareamentostv', pareamentoTvSchema)

export default PareamentoTvModel
