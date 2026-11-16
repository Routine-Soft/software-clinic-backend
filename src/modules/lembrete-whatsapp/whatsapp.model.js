import mongoose from 'mongoose'

// WhatsApp de cada clínica, conectado pela Evolution API (ver evolution.client.js): o número da própria clínica
// manda os lembretes de consulta. Mensagens recebidas não passam pelo sistema.
export const TEXTO_PADRAO = 'Olá, {paciente}! Passando para lembrar da sua consulta na {clinica}, {data}, às {hora}, com {profissional}. Até lá!'

const whatsappSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, unique: true },
    // Nome da conexão na Evolution (um por clínica).
    instancia: { type: String, required: true },
    // Número e nome do perfil conectados (atualizados quando a conexão abre).
    numero: { type: String, default: null },
    nomePerfil: { type: String, default: null },
    conectadoEm: { type: Date, default: null },
    // Lembretes ligados pela clínica e o texto deles (com as variáveis entre chaves).
    ativo: { type: Boolean, default: true },
    texto: { type: String, default: TEXTO_PADRAO, maxlength: 1000 },
    // Lembretes enviados no mês (de Brasília, "2026-11"). O plano Grátis tem limite por mês (ver plano.limites.js).
    usoMes: {
        mes: { type: String, default: null },
        enviados: { type: Number, default: 0 },
    },
}, { timestamps: true })

const WhatsappModel = mongoose.models.whatsapp_clinicas || mongoose.model('whatsapp_clinicas', whatsappSchema)

export default WhatsappModel
