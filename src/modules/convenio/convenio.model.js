import mongoose from 'mongoose'

const convenioSchema = new mongoose.Schema({
    nome: { type: String, required: true },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

convenioSchema.index({ tenantId: 1, nome: 1 }, { unique: true })

const ConvenioModel = mongoose.models.convenios || mongoose.model('convenios', convenioSchema);

export default ConvenioModel;