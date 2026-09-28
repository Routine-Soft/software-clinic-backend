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
    cobranca: { type: String, enum: ['recorrente', 'pix', 'manual'], default: 'recorrente' },
    mercadoPagoPreapprovalId: { type: String, default: null },
    proximaCobranca: { type: Date, default: null },
    inadimplenteDesde: { type: Date, default: null },

    // Bloqueio manual do suporte, independente do status. Enquanto true, o acesso fica bloqueado mesmo que a
    // assinatura esteja ativa ou em teste. Guarda-chuva para casos que a máquina de estados normal não cobre.
    acessoRevogado: { type: Boolean, default: false },

}, { timestamps: true });

const AssinaturaModel = mongoose.models.assinaturas || mongoose.model('assinaturas', assinaturaSchema);

export default AssinaturaModel;