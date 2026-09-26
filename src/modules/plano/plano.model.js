import mongoose from 'mongoose'

const planoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    tipo: { type: String, enum: ['gratis', 'pago'], required: true },
    preco: { type: Number, required: true, default: 0 },
    duracaoDiasTrial: { type: Number, default: null },
    ativo: { type: Boolean, default: true },

}, { timestamps: true });

const PlanoModel = mongoose.models.planos || mongoose.model('planos', planoSchema);

export default PlanoModel;