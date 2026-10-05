import crypto from 'node:crypto'
import { LembreteService } from './lembrete.service.js'

// A Meta assina o corpo exato da requisição com o App Secret (cabeçalho X-Hub-Signature-256).
function assinaturaValida(req) {
    const segredo = process.env.WHATSAPP_APP_SECRET
    const recebida = String(req.headers['x-hub-signature-256'] ?? '')
    if (!segredo || !req.rawBody || !recebida.startsWith('sha256=')) return false

    const esperada = `sha256=${crypto.createHmac('sha256', segredo).update(req.rawBody).digest('hex')}`
    return recebida.length === esperada.length && crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada))
}

export const LembreteController = {
    // Verificação feita uma vez pela Meta ao cadastrar a URL do webhook.
    async verificar(req, reply) {
        const { 'hub.mode': modo, 'hub.verify_token': token, 'hub.challenge': desafio } = req.query
        if (modo === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            return reply.type('text/plain').send(desafio)
        }
        return reply.code(403).send({ message: 'Token de verificação inválido' })
    },

    // Situação das mensagens (entregue, lida, falhou) e botões apertados pelos pacientes.
    async receber(req, reply) {
        if (!assinaturaValida(req)) {
            return reply.code(401).send({ message: 'Webhook inválido' })
        }

        // Responde 200 mesmo com erro interno: senão a Meta reenvia o mesmo aviso por horas.
        try {
            await LembreteService.processarWebhook(req.body)
        } catch (erro) {
            req.log.error(erro, 'Falha ao processar webhook do WhatsApp')
        }
        return reply.send({ received: true })
    },
}
