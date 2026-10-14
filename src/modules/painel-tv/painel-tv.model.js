import mongoose from 'mongoose'

// TV conectada à clínica para mostrar as chamadas da sala de espera. A TV não tem login: guarda uma chave própria,
// que só lê as chamadas. No banco fica só o hash da chave.
const painelTvSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    chaveHash: { type: String, required: true, unique: true },
    ultimoAcessoEm: { type: Date, default: null },
    conectadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true, collection: 'paineistv' })

painelTvSchema.set('toJSON', {
    transform(doc, obj) {
        delete obj.chaveHash
        return obj
    },
})

const PainelTvModel = mongoose.models.paineistv || mongoose.model('paineistv', painelTvSchema)

export default PainelTvModel
