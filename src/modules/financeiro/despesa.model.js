import mongoose from 'mongoose'

// Categorias de despesa da clínica (as mesmas da tela, em financeiro.utils.js no frontend).
export const CATEGORIAS_DESPESA = [
    'aluguel', 'pessoal', 'materiais', 'contas', 'impostos', 'marketing', 'sistemas', 'manutencao', 'terceiros', 'equipamentos', 'outros',
]

// Formas de pagar uma despesa: as do atendimento e mais as que só uma empresa usa para pagar contas.
export const FORMAS_DESPESA = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia']

// Despesa lançada no Financeiro. `data` é dia puro (meia-noite UTC): o dia da despesa ou o vencimento.
// Sem `pagoEm`, ela está "a pagar" (e vencida, se a data já passou).
const despesaSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true, maxlength: 160 },
    categoria: { type: String, enum: CATEGORIAS_DESPESA, default: 'outros' },
    valor: { type: Number, required: true, min: 0.01 },
    data: { type: Date, required: true },
    pagoEm: { type: Date, default: null },
    formaPagamento: { type: String, enum: [...FORMAS_DESPESA, null], default: null },
    fornecedor: { type: String, trim: true, maxlength: 120, default: '' },
    observacao: { type: String, trim: true, maxlength: 500, default: '' },

    // Despesa que se repete todo mês (aluguel, salário...): as cópias de cada mês têm o mesmo grupo.
    grupoRecorrenciaId: { type: mongoose.Schema.Types.ObjectId, default: null },

    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },
    pagoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

despesaSchema.index({ tenantId: 1, data: 1 })

const DespesaModel = mongoose.models.despesas || mongoose.model('despesas', despesaSchema)

export default DespesaModel
