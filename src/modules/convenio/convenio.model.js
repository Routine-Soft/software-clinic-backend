import mongoose from 'mongoose'

// Sempre com a primeira letra maiúscula ("particular" vira "Particular"); o resto fica como a clínica digitou.
export function nomeDoConvenio(valor) {
    if (typeof valor !== 'string') return valor
    const nome = valor.trim().replace(/\s+/g, ' ')
    return nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1)
}

// Quem paga o atendimento. Convênio antigo, sem a escolha feita: "Particular" é o paciente; os demais, o plano.
export function pagaOPlano(convenio) {
    if (!convenio?.nome) return false
    return convenio.quemPaga ? convenio.quemPaga === 'plano' : convenio.nome.trim().toLowerCase() !== 'particular'
}

const convenioSchema = new mongoose.Schema({
    nome: { type: String, required: true, set: nomeDoConvenio },
    quemPaga: { type: String, enum: ['paciente', 'plano'] },
    // Quanto o paciente paga à clínica em cada atendimento pelo plano; 0 = sem coparticipação.
    coparticipacao: { type: Number, default: 0, min: 0 },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

convenioSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const ConvenioModel = mongoose.models.convenios || mongoose.model('convenios', convenioSchema);

export default ConvenioModel;