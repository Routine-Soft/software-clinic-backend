// Alertas para o Stanley pelo Telegram (bot criado no @BotFather), pela API HTTP: sem SDK.
// TELEGRAM_BOT_TOKEN: token do bot. TELEGRAM_CHAT_ID: conversa que recebe os alertas.
// Sem as variáveis, o alerta é ignorado; se o Telegram falhar, o erro fica só no log (nunca trava quem chamou).
export function avisarNoTelegram(texto) {
    const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return

    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: texto, disable_web_page_preview: true }),
    })
        .then(async (resposta) => {
            if (!resposta.ok) console.error(`Telegram recusou o alerta (${resposta.status}): ${await resposta.text().catch(() => '')}`)
        })
        .catch((error) => console.error(`Não foi possível mandar o alerta pelo Telegram: ${error.message}`))
}
