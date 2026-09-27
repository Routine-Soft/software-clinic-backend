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
    cobranca: { type: String, enum: ['recorrente', 'pix'], default: 'recorrente' },
    mercadoPagoPreapprovalId: { type: String, default: null },
    proximaCobranca: { type: Date, default: null },
    inadimplenteDesde: { type: Date, default: null },

}, { timestamps: true });

const AssinaturaModel = mongoose.models.assinaturas || mongoose.model('assinaturas', assinaturaSchema);

export default AssinaturaModel;