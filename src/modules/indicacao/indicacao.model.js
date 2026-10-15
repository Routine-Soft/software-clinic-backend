import mongoose from 'mongoose'

// Uma clínica (indicada) que se cadastrou pelo link ou código de outra clínica ou de um afiliado (indicador).
// tipo 'clinica': o prêmio é desconto na mensalidade de quem indicou; tipo 'afiliado': é comissão em dinheiro.
// aguardando: a indicada ainda não pagou nenhuma mensalidade (ou o pagamento foi devolvido);
// liberada: a indicada pagou. Clínica: desconto guardado. Afiliado: comissão a pagar a partir de `disponivelEm`
//   (depois dos 7 dias em que o cliente pode desistir e pedir o dinheiro de volta);
// usada: o desconto já entrou em um pagamento da clínica que indicou;
// paga: a comissão já foi paga ao afiliado.
const indicacaoSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['clinica', 'afiliado'], default: 'clinica' },
    // Clínica: o tenant que indicou. Afiliado: o _id do usuário afiliado (que pode trabalhar numa clínica).
    indicadorTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    indicadoTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, unique: true },
    valor: { type: Number, required: true },
    status: { type: String, enum: ['aguardando', 'liberada', 'usada', 'paga'], default: 'aguardando' },

    liberadaEm: { type: Date, default: null },
    liberadaPorPagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'pagamentos', default: null },
    disponivelEm: { type: Date, default: null },
    usadaEm: { type: Date, default: null },
    usadaNoPagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'pagamentos', default: null },
    pagaEm: { type: Date, default: null },
}, { timestamps: true, collection: 'indicacoes' })

const IndicacaoModel = mongoose.models.indicacoes || mongoose.model('indicacoes', indicacaoSchema)

export default IndicacaoModel
