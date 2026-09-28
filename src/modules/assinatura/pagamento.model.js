import mongoose from 'mongoose'

// Registro de cada pagamento real recebido: Pix (avulso, vale um período de acesso) e cartão (cobrança
// recorrente aprovada pelo Mercado Pago). É a base para a receita somada no painel do super_admin.
const pagamentoSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    assinaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'assinaturas', required: true },
    planoId: { type: mongoose.Schema.Types.ObjectId, ref: 'planos', required: true },

    metodo: { type: String, enum: ['pix', 'recorrente'], default: 'pix' },
    mercadoPagoPaymentId: { type: String, required: true, index: true },
    status: {
        type: String,
        enum: ['pendente', 'aprovado', 'cancelado', 'expirado', 'rejeitado'],
        default: 'pendente',
    },

    valor: { type: Number, required: true },
    qrCode: { type: String, default: null },
    qrCodeBase64: { type: String, default: null },
    ticketUrl: { type: String, default: null },
    expiraEm: { type: Date, default: null },
    aprovadoEm: { type: Date, default: null },

}, { timestamps: true });

const PagamentoModel = mongoose.models.pagamentos || mongoose.model('pagamentos', pagamentoSchema);

export default PagamentoModel;
