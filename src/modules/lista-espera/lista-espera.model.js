import mongoose from 'mongoose'

const listaEsperaSchema = new mongoose.Schema({
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    especialidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'especialidades', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', default: null },
    dataDesejada: { type: Date, default: null },
    observacao: { type: String, default: null },
    status: { type: String, enum: ['aguardando', 'chamado', 'atendido'], default: 'aguardando' },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

const ListaEsperaModel = mongoose.models.listas_espera || mongoose.model('listas_espera', listaEsperaSchema);

export default ListaEsperaModel;