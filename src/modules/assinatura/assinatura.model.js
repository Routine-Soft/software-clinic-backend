import mongoose from 'mongoose'

const assinaturaSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    planoId: { type: mongoose.Schema.Types.ObjectId, ref: 'planos', required: true },

    status: {
        type: String,
        enum: ['trial', 'pendente', 'ativa', 'inadimplente', 'cancelada', 'expirada'],
        default: 'trial',
    },

    dataInicio: { type: Date, default: Date.now },
    dataFimTrial: { type: Date, default: null },
    // "recorrente": cartão, renova sozinho no Mercado Pago. "pix": pagamento avulso, vale até proximaCobranca.
    // 'manual': ativada diretamente pelo super_admin (fora do Mercado Pago), sem cobrança futura automática.
    // "stripe": cartão internacional, renova sozinho no Stripe (clínicas de fora do Brasil).
    cobranca: { type: String, enum: ['recorrente', 'pix', 'manual', 'stripe'], default: 'recorrente' },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    mercadoPagoPreapprovalId: { type: String, default: null },
    // Troca do Pix para o cartão: assinatura no cartão criada para só começar a cobrar quando o período pago por Pix
    // acabar. Enquanto o cliente não conclui o checkout, a assinatura continua como Pix (ver aplicarCartaoAgendado).
    cartaoAgendadoPreapprovalId: { type: String, default: null },
    proximaCobranca: { type: Date, default: null },
    inadimplenteDesde: { type: Date, default: null },
    // Quando saiu o último e-mail avisando do vencimento (cada fatura recebe um só; ver assinatura.emails.js).
    avisoVencimentoEm: { type: Date, default: null },
    // Preço que a clínica continua pagando depois de um aumento do plano (quem já assinava não paga o preço novo).
    // Vale só para o plano gravado aqui; trocar de plano cobra o preço do plano novo. Ver precoDaAssinatura.
    precoTravado: {
        type: new mongoose.Schema({ planoId: mongoose.Schema.Types.ObjectId, valor: Number }, { _id: false }),
        default: null,
    },
    // E-mails de ajuda do período de teste que já saíram ('dia1', 'dia3', 'fim'; ver teste.emails.js).
    emailsDoTeste: { type: [String], default: [] },

    // Bloqueio manual do suporte, independente do status. Enquanto true, o acesso fica bloqueado mesmo que a
    // assinatura esteja ativa ou em teste. Guarda-chuva para casos que a máquina de estados normal não cobre.
    acessoRevogado: { type: Boolean, default: false },

}, { timestamps: true });

const AssinaturaModel = mongoose.models.assinaturas || mongoose.model('assinaturas', assinaturaSchema);

export default AssinaturaModel;