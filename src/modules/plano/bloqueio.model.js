import mongoose from 'mongoose'

// Cada clique num recurso com cadeado (plano Grátis ou Basic). Mostra ao super admin qual recurso faz as clínicas
// quererem assinar. `origem`: de onde veio o clique (menu, agenda, aviso da API...).
const bloqueioSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },
    recurso: { type: String, required: true, maxlength: 40 },
    origem: { type: String, default: '', maxlength: 40 },
    nivel: { type: String, default: null },
}, { timestamps: true })

const BloqueioModel = mongoose.models.planos_bloqueios || mongoose.model('planos_bloqueios', bloqueioSchema)

export default BloqueioModel
