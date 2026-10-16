import mongoose from 'mongoose'

// Modelo de termo da clínica (ex.: "TCLE – Atendimento psicológico"). O texto aceita marcadores como
// {{paciente}} e {{cpf}}, trocados pelos dados do paciente quando o termo é enviado.
const termoModeloSchema = new mongoose.Schema({
    titulo: { type: String, required: true, trim: true },
    texto: { type: String, required: true },
    // Excluir só arquiva: assim os modelos de exemplo não voltam sozinhos (ver TermoService.listarModelos).
    arquivado: { type: Boolean, default: false },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
}, { timestamps: true })

const TermoModeloModel = mongoose.models.termo_modelos || mongoose.model('termo_modelos', termoModeloSchema)

export default TermoModeloModel
