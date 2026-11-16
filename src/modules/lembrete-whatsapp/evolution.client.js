// Cliente da Evolution API (container `evolution` no servidor, só pela rede interna do Docker).
// Cada clínica tem a própria conexão ("instância"), ligada ao WhatsApp dela pelo QR Code.
// Sem EVOLUTION_API_URL e EVOLUTION_API_KEY (como no computador local), o WhatsApp fica desligado.
import AppError from '../../errors/AppError.js'

export function evolutionConfigurada() {
    return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY)
}

// Telefone do cadastro no formato do WhatsApp (só dígitos, com o país). Brasil: "(11) 98765-4321" vira
// 5511987654321. Número de fora do Brasil precisa vir com "+" e o código do país. Null quando não parece válido.
export function telefoneWhatsapp(telefone) {
    const texto = String(telefone ?? '').trim()
    let digitos = texto.replace(/\D/g, '').replace(/^0+/, '')
    if (texto.startsWith('+')) return /^\d{8,15}$/.test(digitos) ? digitos : null
    if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
    return /^55\d{10,11}$/.test(digitos) ? digitos : null
}

async function chamar(metodo, caminho, corpo) {
    if (!evolutionConfigurada()) throw new AppError('O WhatsApp não está disponível neste servidor', 503)
    const base = process.env.EVOLUTION_API_URL.replace(/\/+$/, '')
    let resposta
    try {
        resposta = await fetch(`${base}${caminho}`, {
            method: metodo,
            headers: { apikey: process.env.EVOLUTION_API_KEY, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
            body: corpo ? JSON.stringify(corpo) : undefined,
            signal: AbortSignal.timeout(20000),
        })
    } catch {
        throw new AppError('Não foi possível falar com o serviço de WhatsApp. Tente de novo em instantes.', 503)
    }
    const dados = await resposta.json().catch(() => ({}))
    return { status: resposta.status, ok: resposta.ok, dados }
}

function mensagemDeErro(dados) {
    const r = dados?.response?.message ?? dados?.message
    return Array.isArray(r) ? JSON.stringify(r[0]) : String(r ?? 'erro desconhecido')
}

export const Evolution = {
    // Cria a conexão da clínica (se ainda não existir). Mensagens recebidas não são lidas nem guardadas.
    async criar(instancia) {
        const { ok, status, dados } = await chamar('POST', '/instance/create', {
            instanceName: instancia,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            groupsIgnore: true,
            readMessages: false,
            alwaysOnline: false,
            syncFullHistory: false,
        })
        // 403/409: já existe (ex.: criada numa tentativa anterior). Segue para pedir o QR Code.
        if (!ok && ![403, 409].includes(status)) throw new AppError(`Não foi possível preparar o WhatsApp: ${mensagemDeErro(dados)}`, 502)
    },

    // QR Code (imagem em base64) para o celular da clínica ler.
    async qrCode(instancia) {
        const { ok, dados } = await chamar('GET', `/instance/connect/${encodeURIComponent(instancia)}`)
        if (!ok) return null
        return dados?.base64 ?? null
    },

    // 'open' (conectado), 'connecting' (esperando o QR Code), 'close' (desconectado) ou null (não existe).
    async estado(instancia) {
        const { ok, status, dados } = await chamar('GET', `/instance/connectionState/${encodeURIComponent(instancia)}`)
        if (status === 404) return null
        if (!ok) throw new AppError('Não foi possível ver a situação do WhatsApp', 502)
        return dados?.instance?.state ?? null
    },

    // Número conectado (só dígitos) e nome do perfil, quando conectado.
    async perfil(instancia) {
        const { ok, dados } = await chamar('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`)
        const item = ok && Array.isArray(dados) ? dados[0] : null
        return {
            numero: String(item?.ownerJid ?? '').split('@')[0] || null,
            nome: item?.profileName ?? null,
        }
    },

    // Desconecta o celular e apaga a conexão (para conectar de novo, outro QR Code).
    async apagar(instancia) {
        await chamar('DELETE', `/instance/logout/${encodeURIComponent(instancia)}`).catch(() => null)
        await chamar('DELETE', `/instance/delete/${encodeURIComponent(instancia)}`).catch(() => null)
    },

    // Envia um texto. Devolve o id da mensagem; erro quando o número não tem WhatsApp ou a conexão caiu.
    async enviarTexto(instancia, numero, texto) {
        const { ok, dados } = await chamar('POST', `/message/sendText/${encodeURIComponent(instancia)}`, { number: numero, text: texto })
        if (!ok) {
            const detalhe = mensagemDeErro(dados)
            throw new Error(/exists.?:\s*false/i.test(detalhe) ? 'Este número não tem WhatsApp' : `WhatsApp recusou o envio: ${detalhe}`)
        }
        return dados?.key?.id ?? null
    },
}
