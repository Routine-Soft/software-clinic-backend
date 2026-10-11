import mongoose from 'mongoose'

const planoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    tipo: { type: String, enum: ['gratis', 'pago'], required: true },
    preco: { type: Number, required: true, default: 0 },
    duracaoDiasTrial: { type: Number, default: null },
    ativo: { type: Boolean, default: true },
    // Plano para quem atende sozinho: só o dono da conta usa o sistema (um profissional, sem recepção nem equipe).
    individual: { type: Boolean, default: false },

}, { timestamps: true });

const PlanoModel = mongoose.models.planos || mongoose.model('planos', planoSchema);

export default PlanoModel;