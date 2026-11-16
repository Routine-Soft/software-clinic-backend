import mongoose from 'mongoose'

const planoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    tipo: { type: String, enum: ['gratis', 'pago'], required: true },
    preco: { type: Number, required: true, default: 0 },
    // BRL: clínicas do Brasil (Mercado Pago). USD: clínicas de fora (Stripe); o preço em dólar é próprio, não convertido.
    moeda: { type: String, enum: ['BRL', 'USD'], default: 'BRL' },
    // Produto e preço criados no Stripe quando o plano em dólar é salvo (ver plano.stripe.js).
    stripeProductId: { type: String, default: null },
    stripePriceId: { type: String, default: null },
    duracaoDiasTrial: { type: Number, default: null },
    ativo: { type: Boolean, default: true },
    // Nível do plano pago (ver plano.limites.js): basic (antes "Individual"), pro ou rede. Decide limites e recursos.
    nivel: { type: String, enum: ['basic', 'pro', 'rede'], default: 'pro' },
    // Frase curta do plano na landing e na tela de assinaturas. O que cada plano tem fica fixo no site
    // (`precos.comparacao` em landing.textos.js), para os planos ficarem alinhados lado a lado.
    descricao: { type: String, default: '', trim: true },

}, { timestamps: true });

const PlanoModel = mongoose.models.planos || mongoose.model('planos', planoSchema);

export default PlanoModel;