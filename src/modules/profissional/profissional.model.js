import mongoose from 'mongoose'

const profissionalSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    tipoRegistro: { type: String, required: true },
    numeroRegistro: { type: String, required: true },
    especialidadeIds: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'especialidades' }],
        required: true,
        validate: {
            validator: (arr) => Array.isArray(arr) && arr.length > 0,
            message: 'Selecione ao menos uma especialidade',
        },
    },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

profissionalSchema.index({ tenantId: 1, tipoRegistro: 1, numeroRegistro: 1 }, { unique: true })

const ProfissionalModel = mongoose.models.profissionais || mongoose.model('profissionais', profissionalSchema);

export default ProfissionalModel;