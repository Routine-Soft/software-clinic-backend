import { LembreteService } from './lembrete.service.js'
import { evolutionConfigurada } from './evolution.client.js'

const INTERVALO_MS = 10 * 60 * 1000

// Confere a cada 10 minutos se há lembretes a enviar. Sem a Evolution API configurada (EVOLUTION_API_URL e
// EVOLUTION_API_KEY, que só o servidor tem), não faz nada.
export function iniciarLembretesWhatsapp(log) {
    if (!evolutionConfigurada()) {
        log.info('Evolution API não configurada: lembretes de consulta pelo WhatsApp desligados')
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
