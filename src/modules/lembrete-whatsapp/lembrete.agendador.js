import { LembreteService } from './lembrete.service.js'
import { whatsappConfigurado } from './whatsapp.client.js'

const INTERVALO_MS = 10 * 60 * 1000

// Confere a cada 10 minutos se há lembretes a enviar. Sem as variáveis do WhatsApp, não faz nada.
export function iniciarLembretesWhatsapp(log) {
    if (!whatsappConfigurado()) {
        log.info('WhatsApp não configurado: lembretes de consulta desligados')
        return
    }

    let rodando = false
    async function rodar() {
        if (rodando) return
        rodando = true
        try {
            const { enviados } = await LembreteService.enviarPendentes()
            if (enviados > 0) log.info(`Lembretes de consulta enviados pelo WhatsApp: ${enviados}`)
        } catch (erro) {
            log.error(erro, 'Falha ao enviar lembretes pelo WhatsApp')
        } finally {
            rodando = false
        }
    }

    setTimeout(rodar, 30 * 1000).unref()
    setInterval(rodar, INTERVALO_MS).unref()
}
