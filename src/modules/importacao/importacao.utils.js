// Leitura dos valores que vêm da planilha de outro sistema: cada sistema escreve datas, horas, valores e
// "sim/não" de um jeito, então tudo aqui aceita as formas mais comuns e devolve null quando não entende.

export function texto(valor) {
    if (valor === null || valor === undefined) return ''
    return String(valor).trim().replace(/\s+/g, ' ')
}

// Para comparar nomes: sem acento, minúsculo e com um espaço só entre as palavras.
export function normalizar(valor) {
    return texto(valor).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function soDigitos(valor) {
    return texto(valor).replace(/\D/g, '')
}

// CPF com 11 dígitos sai no formato 000.000.000-00 (o mesmo do cadastro na tela). Outro tamanho fica como veio.
export function formatarCpf(valor) {
    const digitos = soDigitos(valor)
    if (!digitos) return ''
    if (digitos.length !== 11) return texto(valor)
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function email(valor) {
    return texto(valor).replace(/\s+/g, '').toLowerCase()
}

export function emailValido(valor) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)
}

function diaPuro(ano, mes, dia) {
    if (ano < 100) ano += ano > 50 ? 1900 : 2000
    const data = new Date(Date.UTC(ano, mes - 1, dia))
    if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null
    if (ano < 1900 || ano > 2100) return null
    return data
}

// Data em "dia puro" (meia-noite UTC). Aceita 31/12/2024, 31-12-24, 2024-12-31 e o número de série do Excel,
// com ou sem hora depois. Devolve { data, hora } (hora "HH:MM" quando veio junto) ou null.
export function lerData(valor) {
    if (valor === null || valor === undefined || valor === '') return null
    if (typeof valor === 'number' || /^\d{4,5}(\.\d+)?$/.test(String(valor).trim())) {
        const serie = Number(valor)
        if (serie < 1 || serie > 80000) return null
        const ms = Math.round((serie - 25569) * 86400000)
        const d = new Date(ms)
        const data = diaPuro(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
        const minutos = Math.round((serie % 1) * 1440)
        const hora = minutos > 0 ? `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}` : null
        return data ? { data, hora } : null
    }
    const t = texto(valor)
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/)
    if (m) {
        const data = diaPuro(Number(m[1]), Number(m[2]), Number(m[3]))
        return data ? { data, hora: m[4] ? lerHora(`${m[4]}:${m[5]}`) : null } : null
    }
    m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[\s,]+(?:às\s+)?(\d{1,2})[:h](\d{2}))?/i)
    if (m) {
        const data = diaPuro(Number(m[3]), Number(m[2]), Number(m[1]))
        return data ? { data, hora: m[4] ? lerHora(`${m[4]}:${m[5]}`) : null } : null
    }
    return null
}

// Hora "HH:MM". Aceita 9:00, 09h00, 9h, 09:00:00 e a fração de dia do Excel (0,375 = 09:00).
export function lerHora(valor) {
    if (valor === null || valor === undefined || valor === '') return null
    const t = texto(valor).toLowerCase()
    if (/^0?[.,]\d+$/.test(t) || (typeof valor === 'number' && valor < 1)) {
        const minutos = Math.round(Number(t.replace(',', '.')) * 1440)
        return `${String(Math.floor(minutos / 60) % 24).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
    }
    const m = t.match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?(?::\d{2})?\s*$/)
    if (!m) return null
    const h = Number(m[1])
    const min = Number(m[2] ?? 0)
    if (h > 23 || min > 59) return null
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function somarMinutos(hora, minutos) {
    const [h, m] = hora.split(':').map(Number)
    const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Valor em dinheiro: 150, "150,00", "R$ 1.234,56", "1,234.56". Vazio = null; texto que não é número = NaN.
export function lerValor(valor) {
    if (valor === null || valor === undefined || valor === '') return null
    if (typeof valor === 'number') return valor
    let t = texto(valor).replace(/[^\d,.-]/g, '')
    if (!t) return Number.NaN
    const virgula = t.lastIndexOf(',')
    const ponto = t.lastIndexOf('.')
    if (virgula > ponto) t = t.replace(/\./g, '').replace(',', '.')
    else if (ponto > virgula && virgula >= 0) t = t.replace(/,/g, '')
    else if (virgula < 0 && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
    else if (ponto < 0 && virgula >= 0) t = t.replace(',', '.')
    const n = Number(t)
    return Number.isFinite(n) ? n : Number.NaN
}

const SIM = ['sim', 's', 'yes', 'y', 'true', 'verdadeiro', 'x', '1', 'pago', 'paga', 'quitado', 'ok']
const NAO = ['nao', 'n', 'no', 'false', 'falso', '0', 'pendente', 'em aberto', 'aberto', 'a pagar']

// true, false ou null (vazio ou não entendido).
export function lerSimNao(valor) {
    const t = normalizar(valor)
    if (!t) return null
    if (SIM.includes(t)) return true
    if (NAO.includes(t)) return false
    return null
}

// Lista separada por vírgula, ponto e vírgula, barra ou "e".
export function lerLista(valor) {
    return texto(valor).split(/\s*(?:[,;/|]|\se\s)\s*/).map(texto).filter(Boolean)
}
