import AssinaturaModel from './assinatura.model.js'
import UserModel from '../user/user.model.js'
import { enviarEmail } from '../shared/utils/email.js'
import { paisValido, ehBrasil } from '../shared/utils/pais.js'

// E-mails da assinatura para o dono da clínica: aviso de que a fatura vai vencer e agradecimento pelo pagamento.
const DIAS_DE_ANTECEDENCIA = 3
// Uma fatura recebe um aviso só, mesmo que a data dela seja ajustada depois (o cartão pode mudar a hora da cobrança).
const DIAS_ENTRE_AVISOS = 20
const DIA_EM_MS = 24 * 60 * 60 * 1000
const FUSO = 'America/Sao_Paulo'

const PAISES_DE_LINGUA_ESPANHOLA = ['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GQ', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE']

// O dono não guarda o idioma da tela: o país dele decide o idioma do e-mail.
function idiomaDoPais(pais) {
    if (ehBrasil(pais)) return 'pt'
    return PAISES_DE_LINGUA_ESPANHOLA.includes(paisValido(pais)) ? 'es' : 'en'
}

const TEXTOS = {
    pt: {
        lang: 'pt-BR',
        locale: 'pt-BR',
        ola: 'Olá',
        assinatura: 'Equipe Sonelia',
        botao: 'Abrir minha assinatura',
        aviso: {
            assunto: (data) => `Sua fatura da Sonelia vence em ${data}`,
            titulo: 'Sua fatura está chegando',
            manual: (data) => `A fatura da sua assinatura da Sonelia vence no dia ${data}. Faça o pagamento até essa data para continuar usando o sistema sem interrupção.`,
            automatica: (data) => `A fatura da sua assinatura da Sonelia vence no dia ${data} e será cobrada automaticamente no seu cartão. Você não precisa fazer nada, mas pode conferir os detalhes quando quiser.`,
        },
        recebido: {
            assunto: 'Recebemos seu pagamento. Obrigado!',
            titulo: 'Obrigado pelo pagamento!',
            texto: (data) => `Recebemos o pagamento da sua assinatura da Sonelia. Muito obrigado por continuar com a gente! Sua próxima fatura será no dia ${data}.`,
        },
    },
    en: {
        lang: 'en',
        locale: 'en-US',
        ola: 'Hi',
        assinatura: 'The Sonelia team',
        botao: 'Open my subscription',
        aviso: {
            assunto: (data) => `Your Sonelia invoice is due on ${data}`,
            titulo: 'Your invoice is coming up',
            manual: (data) => `Your Sonelia subscription invoice is due on ${data}. Please pay by that date to keep using the system without interruption.`,
            automatica: (data) => `Your Sonelia subscription invoice is due on ${data} and will be charged to your card automatically. You don't need to do anything, but you can check the details anytime.`,
        },
        recebido: {
            assunto: 'We received your payment. Thank you!',
            titulo: 'Thank you for your payment!',
            texto: (data) => `We received your Sonelia subscription payment. Thank you for staying with us! Your next invoice will be on ${data}.`,
        },
    },
    es: {
        lang: 'es',
        locale: 'es-419',
        ola: '¡Hola',
        assinatura: 'Equipo Sonelia',
        botao: 'Abrir mi suscripción',
        aviso: {
            assunto: (data) => `Tu factura de Sonelia vence el ${data}`,
            titulo: 'Tu factura está por vencer',
            manual: (data) => `La factura de tu suscripción a Sonelia vence el ${data}. Realiza el pago hasta esa fecha para seguir usando el sistema sin interrupciones.`,
            automatica: (data) => `La factura de tu suscripción a Sonelia vence el ${data} y se cobrará automáticamente en tu tarjeta. No necesitas hacer nada, pero puedes revisar los detalles cuando quieras.`,
        },
        recebido: {
            assunto: '¡Recibimos tu pago, gracias!',
            titulo: '¡Gracias por tu pago!',
            texto: (data) => `Recibimos el pago de tu suscripción a Sonelia. ¡Muchas gracias por seguir con nosotros! Tu próxima factura será el ${data}.`,
        },
    },
}

// Frontend usa HashRouter: a rota fica depois do "#".
function urlDasAssinaturas() {
    const base = (process.env.APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    return `${base}/#/assinaturas`
}

function escaparHtml(texto) {
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatarDia(data, locale) {
    return new Date(data).toLocaleDateString(locale, { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diaEmBrasilia(instante) {
    return Date.parse(new Date(instante).toLocaleDateString('en-CA', { timeZone: FUSO }))
}

function montarEmail(T, nome, titulo, corpo) {
    const primeiroNome = (nome || '').trim().split(/\s+/)[0]
    const saudacao = primeiroNome ? `${T.ola}, ${primeiroNome}!` : `${T.ola}!`
    const url = urlDasAssinaturas()
    const texto = `${saudacao}\n\n${corpo}\n\n${T.botao}: ${url}\n\n${T.assinatura}`
    const html = `<!doctype html>
<html lang="${T.lang}"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <div style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border-radius:12px;background:#1e3a8a;color:#fff;font-family:Georgia,serif;font-size:20px">So</div>
      <h1 style="font-size:20px;margin:20px 0 8px">${titulo}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px">${escaparHtml(saudacao)}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${corpo}</p>
      <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold">${T.botao}</a></p>
      <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0">${T.assinatura}</p>
    </td></tr>
  </table>
</body></html>`
    return { html, texto }
}

export function emailDeAviso({ nome, pais, vencimento, automatica }) {
    const T = TEXTOS[idiomaDoPais(pais)]
    const data = formatarDia(vencimento, T.locale)
    const corpo = automatica ? T.aviso.automatica(data) : T.aviso.manual(data)
    return { assunto: T.aviso.assunto(data), ...montarEmail(T, nome, T.aviso.titulo, corpo) }
}

export function emailDePagamentoRecebido({ nome, pais, proximaFatura }) {
    const T = TEXTOS[idiomaDoPais(pais)]
    const corpo = T.recebido.texto(formatarDia(proximaFatura, T.locale))
    return { assunto: T.recebido.assunto, ...montarEmail(T, nome, T.recebido.titulo, corpo) }
}

// Não trava a liberação do pagamento: se o Resend falhar, o acesso segue liberado e o erro fica só no log.
export async function enviarPagamentoRecebido(assinatura, proximaFatura = assinatura.proximaCobranca) {
    try {
        if (!proximaFatura) return
        const dono = await UserModel.findById(assinatura.tenantId, 'nomeCompleto email pais')
        if (!dono?.email) return
        const { assunto, html, texto } = emailDePagamentoRecebido({ nome: dono.nomeCompleto, pais: dono.pais, proximaFatura })
        await enviarEmail({ para: dono.email, assunto, html, texto })
    } catch (error) {
        console.error(`Não foi possível enviar o e-mail de pagamento recebido da clínica ${assinatura.tenantId}: ${error.message}`)
    }
}

async function avisarVencimento(assinatura, agora) {
    const avisoAnterior = assinatura.avisoVencimentoEm
    // Marca antes de enviar: mesmo com o servidor reiniciando no meio, ninguém recebe o aviso duas vezes.
    const reservada = await AssinaturaModel.findOneAndUpdate(
        { _id: assinatura._id, avisoVencimentoEm: avisoAnterior },
        { $set: { avisoVencimentoEm: agora } }
    )
    if (!reservada) return false

    try {
        const dono = await UserModel.findById(assinatura.tenantId, 'nomeCompleto email pais')
        if (!dono?.email) return false
        const { assunto, html, texto } = emailDeAviso({
            nome: dono.nomeCompleto,
            pais: dono.pais,
            vencimento: assinatura.proximaCobranca,
            automatica: assinatura.cobranca !== 'pix',
        })
        await enviarEmail({ para: dono.email, assunto, html, texto })
        return true
    } catch (error) {
        console.error(`Não foi possível enviar o aviso de vencimento da clínica ${assinatura.tenantId}: ${error.message}`)
        // Na próxima rodada tenta de novo.
        await AssinaturaModel.updateOne({ _id: assinatura._id }, { $set: { avisoVencimentoEm: avisoAnterior } })
        return false
    }
}

// Quem tem fatura vencendo em até 3 dias e ainda não foi avisado. "manual" e cancelada não têm próxima fatura.
export async function enviarAvisosDeVencimento(agora = new Date()) {
    const hora = Number(agora.toLocaleString('en-US', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' }))
    if (hora < 8 || hora >= 20) return 0

    const assinaturas = await AssinaturaModel.find({
        status: 'ativa',
        cobranca: { $in: ['pix', 'recorrente', 'stripe'] },
        acessoRevogado: { $ne: true },
        proximaCobranca: { $gt: agora, $lte: new Date(agora.getTime() + (DIAS_DE_ANTECEDENCIA + 1) * DIA_EM_MS) },
        $or: [{ avisoVencimentoEm: null }, { avisoVencimentoEm: { $lt: new Date(agora.getTime() - DIAS_ENTRE_AVISOS * DIA_EM_MS) } }],
    })

    let enviados = 0
    for (const assinatura of assinaturas) {
        const dias = Math.round((diaEmBrasilia(assinatura.proximaCobranca) - diaEmBrasilia(agora)) / DIA_EM_MS)
        if (dias <= DIAS_DE_ANTECEDENCIA && await avisarVencimento(assinatura, agora)) enviados += 1
    }
    return enviados
}
