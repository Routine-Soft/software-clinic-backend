import mongoose from 'mongoose'

// Modelo de anamnese da clínica (ex.: "Anamnese Psiquiátrica"). As seções seguem o formato de anamnese.ficha.js.
const anamneseModeloSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true },
    area: { type: String, default: '', trim: true },
    descricao: { type: String, default: '', trim: true },
    secoes: { type: [mongoose.Schema.Types.Mixed], required: true },
    // Modelo pronto de origem ('neuropsicologica', 'psiquiatrica'...); nulo nos criados pela clínica.
    chave: { type: String, default: null },
    // Excluir só arquiva: as anamneses já preenchidas guardam a própria cópia, e os modelos prontos não voltam sozinhos.
    arquivado: { type: Boolean, default: false },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

// Cada modelo pronto entra uma vez só por clínica (duas abas abrindo ao mesmo tempo não duplicam).
anamneseModeloSchema.index({ tenantId: 1, chave: 1 }, { unique: true, partialFilterExpression: { chave: { $type: 'string' } } })

const AnamneseModeloModel = mongoose.models.anamnese_modelos || mongoose.model('anamnese_modelos', anamneseModeloSchema)

export default AnamneseModeloModel
