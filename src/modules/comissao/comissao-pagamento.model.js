import mongoose from 'mongoose'

// Cada vez que o admin paga as comissões pendentes de um profissional. Os atendimentos pagos apontam para este registro
// (agenda.comissao.pagamentoId), então dá para saber exatamente o que entrou em cada pagamento.
const comissaoPagamentoSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    valor: { type: Number, required: true },
    quantidade: { type: Number, required: true },
    pagoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
}, { timestamps: true });

comissaoPagamentoSchema.index({ tenantId: 1, profissionalId: 1, createdAt: -1 })

const ComissaoPagamentoModel = mongoose.models.comissaopagamentos || mongoose.model('comissaopagamentos', comissaoPagamentoSchema);

export default ComissaoPagamentoModel;
