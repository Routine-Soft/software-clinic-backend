import mongoose from 'mongoose'

// Pagamento de uma série de sessões feito à parte delas: à vista (uma parcela só) ou parcelado.
// Na série paga por sessão não existe cobrança: cada agendamento tem o próprio `financeiro.pagoEm`.
const parcelaSchema = new mongoose.Schema({
    numero: { type: Number, required: true },
    valor: { type: Number, required: true },
    vencimento: { type: Date, required: true },
    pagoEm: { type: Date, default: null },
}, { _id: false })

const cobrancaSchema = new mongoose.Schema({
    modo: { type: String, enum: ['avista', 'parcelado'], required: true },
    total: { type: Number, required: true },
    grupoRecorrenciaId: { type: mongoose.Schema.Types.ObjectId, required: true },
    parcelas: { type: [parcelaSchema], default: [] },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

export default mongoose.model('cobrancas', cobrancaSchema)
