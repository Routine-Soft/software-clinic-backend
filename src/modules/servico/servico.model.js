import mongoose from 'mongoose'

const servicoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    tipo: { type: String, enum: ['consulta', 'pacote'], required: true },
    qtdDias: {
        type: Number,
        required: function () { return this.tipo === 'pacote' },
        default: null,
    },
    // Preço e comissão do atendimento particular. A comissão é o que o profissional recebe por atendimento
    // realizado: um valor em reais ('valor') ou um percentual do valor cobrado ('percentual').
    preco: { type: Number, required: true },
    // Módulo que usa este serviço (a avaliação escolhe entre os serviços do seu módulo); null = atendimento comum.
    modulo: { type: String, enum: ['nr01', 'neuropsicologica', null], default: null },
    comissao: { type: Number, default: 0, min: 0 },
    comissaoTipo: { type: String, enum: ['valor', 'percentual'], default: 'valor' },

    // Cada convênio pode ter preço e comissão próprios para este serviço. Convênio sem linha aqui usa a regra particular.
    tabelaConvenios: {
        type: [new mongoose.Schema({
            convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', required: true },
            preco: { type: Number, required: true, min: 0 },
            comissao: { type: Number, default: 0, min: 0 },
            comissaoTipo: { type: String, enum: ['valor', 'percentual'], default: 'valor' },
        }, { _id: false })],
        default: [],
    },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

servicoSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const ServicoModel = mongoose.models.servicos || mongoose.model('servicos', servicoSchema);

export default ServicoModel;