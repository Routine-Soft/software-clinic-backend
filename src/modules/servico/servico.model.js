import mongoose from 'mongoose'

const servicoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    tipo: { type: String, enum: ['consulta', 'pacote'], required: true },
    qtdDias: {
        type: Number,
        required: function () { return this.tipo === 'pacote' },
        default: null,
    },
    preco: { type: Number, required: true },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

servicoSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const ServicoModel = mongoose.models.servicos || mongoose.model('servicos', servicoSchema);

export default ServicoModel;