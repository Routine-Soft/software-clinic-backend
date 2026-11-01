import { enviarAvisosDeVencimento } from './assinatura.emails.js'

const INTERVALO_MS = 60 * 60 * 1000

// Confere de hora em hora quem precisa do e-mail de vencimento. Sem o Resend, não faz nada.
export function iniciarAvisosDeVencimento(log) {
    if (!process.env.RESEND_API_KEY) {
        log.info('E-mail não configurado: avisos de vencimento desligados')
        return
    }

    let rodando = false
    async function rodar() {
        if (rodando) return
        rodando = true
        try {
            const enviados = await enviarAvisosDeVencimento()
            if (enviados > 0) log.info(`Avisos de vencimento enviados por e-mail: ${enviados}`)
        } catch (erro) {
            log.error(erro, 'Falha ao enviar os avisos de vencimento')
        } finally {
            rodando = false
        }
    }

    setTimeout(rodar, 60 * 1000).unref()
    setInterval(rodar, INTERVALO_MS).unref()
}
