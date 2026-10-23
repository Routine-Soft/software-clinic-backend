import { MENSAGENS_EN } from './mensagens.en.js'
import { MENSAGENS_ES } from './mensagens.es.js'

// O site manda "Accept-Language: en" (ou "es") quando a pessoa usa a Sonelia em inglês (ou espanhol). O código e as
// mensagens ficam em português; a tradução acontece na saída (ver o onSend em index.js).
export function idiomaDaRequisicao(req) {
    const idioma = String(req.headers['accept-language'] ?? '').toLowerCase().slice(0, 2)
    return idioma === 'en' || idioma === 'es' ? idioma : 'pt'
}

// Mensagens com partes variáveis ({0}, {1}...) viram expressões: "Repasse de {0} pago" casa com "Repasse de R$ 50 pago".
function modelosDe(dicionario) {
    return Object.entries(dicionario)
        .filter(([pt]) => /\{\d+\}/.test(pt))
        .map(([pt, traducao]) => {
            const partes = pt.split(/\{\d+\}/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            const ordem = [...pt.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]))
            return { regex: new RegExp(`^${partes.join('(.+?)')}$`, 's'), ordem, traducao }
        })
        // modelos mais específicos (mais texto fixo) primeiro
        .sort((a, b) => b.regex.source.length - a.regex.source.length)
}

const IDIOMAS = {
    en: { mensagens: MENSAGENS_EN, modelos: modelosDe(MENSAGENS_EN) },
    es: { mensagens: MENSAGENS_ES, modelos: modelosDe(MENSAGENS_ES) },
}

// Quanto de português sobrou numa tradução (acentos e palavras comuns), para escolher o melhor modelo.
// No espanhol, só contam as marcas que o espanhol não tem (acentos e "de", "para"... existem nos dois).
function restoEmPortugues(texto, idioma) {
    const marcas = idioma === 'es'
        ? /[ãõçâêô]|\b(?:do|da|e|só|um|uma|não|com|os|as|hoje|são|deixe|remova)\b/gi
        : /[ãõçáéíóúâêô]|\b(?:de|do|da|e|só|um|uma|não|para|com|os|as|hoje|são|deixe|remova)\b/gi
    return (texto.match(marcas) ?? []).length
}

export function traduzirMensagem(mensagem, idioma, profundidade = 0) {
    const dicionario = IDIOMAS[idioma]
    if (!dicionario || typeof mensagem !== 'string' || !mensagem) return mensagem
    if (dicionario.mensagens[mensagem]) return dicionario.mensagens[mensagem]
    if (profundidade > 2) return mensagem
    // Mais de um modelo pode casar (um pedaço variável pode "engolir" o resto da frase): fica o que deixa menos
    // texto sem traduzir nas partes variáveis.
    let melhor = null
    for (const { regex, ordem, traducao: modelo } of dicionario.modelos) {
        const m = mensagem.match(regex)
        if (!m) continue
        const valores = {}
        ordem.forEach((n, i) => { valores[n] = traduzirMensagem(m[i + 1], idioma, profundidade + 1) })
        const traducao = modelo.replace(/\{(\d+)\}/g, (trecho, n) => valores[n] ?? trecho)
        const sobra = restoEmPortugues(traducao, idioma)
        if (!melhor || sobra < melhor.sobra) melhor = { sobra, traducao }
        if (sobra === 0) break
    }
    return melhor ? melhor.traducao : mensagem
}
