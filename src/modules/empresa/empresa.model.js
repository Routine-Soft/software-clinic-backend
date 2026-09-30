import mongoose from 'mongoose'

const empresaSchema = new mongoose.Schema({
    razaoSocial: { type: String, required: true },
    nomeFantasia: { type: String, default: '' },
    cnpj: { type: String, required: true },
    telefone: { type: String, default: '' },
    email: { type: String, default: '', trim: true, lowercase: true },
    endereco: { type: String, default: '' },
    setor: { type: String, default: '' },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

empresaSchema.index({ tenantId: 1, cnpj: 1 }, { unique: true })

const EmpresaModel = mongoose.models.empresas || mongoose.model('empresas', empresaSchema);

export default EmpresaModel;
