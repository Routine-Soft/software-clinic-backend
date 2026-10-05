// Cliente da WhatsApp Cloud API (Meta). Sem as variáveis de ambiente, os lembretes ficam desligados.
// WHATSAPP_API_URL só existe para apontar para um servidor falso nos testes.

const TEMPLATE_LEMBRETE = process.env.WHATSAPP_TEMPLATE_LEMBRETE || 'lembrete_consulta'

export function whatsappConfigurado() {
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

// Telefone do cadastro ("(11) 98765-4321", "11987654321", "+55 11 ...") no formato da API: 5511987654321.
// Devolve null quando não parece um celular ou fixo brasileiro com DDD.
export function telefoneWhatsapp(telefone) {
    let digitos = String(telefone ?? '').replace(/\D/g, '').replace(/^0+/, '')
    if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
    return /^55\d{10,11}$/.test(digitos) ? digitos : null
}

async function enviar(para, mensagem) {
    const base = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com'
    const versao = process.env.WHATSAPP_API_VERSION || 'v23.0'

    const resposta = await fetch(`${base}/${versao}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: para, ...mensagem }),
        signal: AbortSignal.timeout(15000),
    })

    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
        const erro = dados?.error
        throw new Error(erro?.error_data?.details || erro?.message || `WhatsApp respondeu ${resposta.status}`)
    }
    return dados?.messages?.[0]?.id ?? null
}

export const WhatsApp = {
    // Modelo aprovado na Meta (categoria Utilidade), com 4 variáveis e 2 botões de resposta rápida:
    // "Olá, {{1}}! Lembrete da sua consulta na {{2}} amanhã, {{3}}, às {{4}}. Você confirma sua presença?"
    // [Confirmar] [Desmarcar]. O payload de cada botão leva a ação e o id do agendamento.
    async enviarLembrete(para, { nome, clinica, dia, hora, agendaId }) {
        const texto = (valor) => ({ type: 'text', text: String(valor) })
        const botao = (indice, acao) => ({
            type: 'button',
            sub_type: 'quick_reply',
            index: String(indice),
            parameters: [{ type: 'payload', payload: `${acao}:${agendaId}` }],
        })

        return await enviar(para, {
            type: 'template',
            template: {
                name: TEMPLATE_LEMBRETE,
                language: { code: 'pt_BR' },
                components: [
                    { type: 'body', parameters: [texto(nome), texto(clinica), texto(dia), texto(hora)] },
                    botao(0, 'confirmar'),
                    botao(1, 'desmarcar'),
                ],
            },
        })
    },

    // Texto livre: só é aceito nas 24h seguintes a uma mensagem do paciente (e não é cobrado).
    async enviarTexto(para, corpo) {
        return await enviar(para, { type: 'text', text: { body: corpo } })
    },
}
