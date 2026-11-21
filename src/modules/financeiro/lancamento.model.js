import mongoose from 'mongoose'

// Categorias de cada tipo de lançamento (as mesmas da tela, em financeiro.utils.js no frontend).
export const CATEGORIAS = {
    despesa: ['aluguel', 'pessoal', 'materiais', 'contas', 'impostos', 'marketing', 'sistemas', 'manutencao', 'terceiros', 'equipamentos', 'outros'],
    receita: ['convenio', 'produtos', 'servicos', 'sublocacao', 'outros'],
}

// Formas de pagamento: as do atendimento e mais as que uma empresa usa para pagar ou receber contas.
export const FORMAS_LANCAMENTO = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia']

// Lançamento manual do Financeiro: despesa (aluguel, salário...) ou receita avulsa (venda de produto, pagamento do
// convênio...). Os atendimentos não ficam aqui: vêm da agenda. `data` é dia puro (meia-noite UTC): o dia ou o
// vencimento. Sem `pagoEm`, a despesa está "a pagar" e a receita "a receber" (vencida, se a data já passou).
const lancamentoSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['despesa', 'receita'], required: true },
    descricao: { type: String, required: true, trim: true, maxlength: 160 },
    categoria: { type: String, default: 'outros' },
    valor: { type: Number, required: true, min: 0.01 },
    data: { type: Date, required: true },
    pagoEm: { type: Date, default: null },
    formaPagamento: { type: String, enum: [...FORMAS_LANCAMENTO, null], default: null },
    // Fornecedor (despesa) ou de quem veio o dinheiro (receita).
    fornecedor: { type: String, trim: true, maxlength: 120, default: '' },
    observacao: { type: String, trim: true, maxlength: 500, default: '' },

    // Lançamento que se repete todo mês (aluguel, salário...): as cópias de cada mês têm o mesmo grupo.
    grupoRecorrenciaId: { type: mongoose.Schema.Types.ObjectId, default: null },

    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },
    pagoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

lancamentoSchema.index({ tenantId: 1, data: 1 })

const LancamentoModel = mongoose.models.lancamentos || mongoose.model('lancamentos', lancamentoSchema)

export default LancamentoModel
