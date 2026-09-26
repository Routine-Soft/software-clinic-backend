import mongoose from 'mongoose'

const especialidadeSchema = new mongoose.Schema({
    nome: { type: String, required: true },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

especialidadeSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const EspecialidadeModel = mongoose.models.especialidades || mongoose.model('especialidades', especialidadeSchema);

export default EspecialidadeModel;