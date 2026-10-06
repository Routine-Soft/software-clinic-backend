import mongoose from 'mongoose'

// Sempre com a primeira letra maiúscula ("particular" vira "Particular"); o resto fica como a clínica digitou.
export function nomeDoConvenio(valor) {
    if (typeof valor !== 'string') return valor
    const nome = valor.trim().replace(/\s+/g, ' ')
    return nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1)
}

const convenioSchema = new mongoose.Schema({
    nome: { type: String, required: true, set: nomeDoConvenio },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

convenioSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const ConvenioModel = mongoose.models.convenios || mongoose.model('convenios', convenioSchema);

export default ConvenioModel;