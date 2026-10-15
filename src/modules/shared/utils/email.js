import AppError from '../../../errors/AppError.js'

// Envio de e-mail pelo Resend (https://resend.com), pela API HTTP: sem SDK.
// RESEND_API_KEY: chave criada no painel do Resend. EMAIL_REMETENTE: endereço do domínio verificado no Resend.
const REMETENTE_PADRAO = 'Sonelia <atendimento@sonelia.com.br>'

export async function enviarEmail({ para, assunto, html, texto }) {
    if (!process.env.RESEND_API_KEY) {
        throw new AppError('O envio de e-mail não está configurado. Fale com o suporte da Sonelia.', 503)
    }

    const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_REMETENTE || REMETENTE_PADRAO, to: [para], subject: assunto, html, text: texto }),
    })
    if (!resposta.ok) {
        const detalhe = await resposta.text().catch(() => '')
        console.error(`Resend recusou o e-mail (${resposta.status}): ${detalhe}`)
        throw new AppError('Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.', 502)
    }
}
