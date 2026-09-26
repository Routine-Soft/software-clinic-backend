import mongoose from 'mongoose'

const salaSchema = new mongoose.Schema({
    nome: { type: String, required: true },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

salaSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const SalaModel = mongoose.models.salas || mongoose.model('salas', salaSchema);

export default SalaModel;