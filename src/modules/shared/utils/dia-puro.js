// Datas de agendamento são "dia puro" gravado como meia-noite UTC (ver agenda.service.js).
// Estas funções trabalham na mesma convenção, com o "hoje" pelo relógio de Brasília.

export function hojeDiaPuro(agora = new Date()) {
    const iso = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    return new Date(`${iso}T00:00:00.000Z`)
}

export const PERIODOS = ['diario', 'semanal', 'mensal', 'anual']

// Início do período de calendário que contém `hoje`: o próprio dia, o domingo da semana, o dia 1 do mês ou 1º de janeiro.
export function inicioDoPeriodoDiaPuro(periodo, hoje) {
    const inicio = new Date(hoje)
    if (periodo === 'semanal') inicio.setUTCDate(inicio.getUTCDate() - inicio.getUTCDay())
    else if (periodo === 'mensal') inicio.setUTCDate(1)
    else if (periodo === 'anual') inicio.setUTCMonth(0, 1)
    return inicio
}

// Início do período seguinte (fim exclusivo do período que começa em `inicio`).
export function fimDoPeriodoDiaPuro(periodo, inicio) {
    const fim = new Date(inicio)
    if (periodo === 'semanal') fim.setUTCDate(fim.getUTCDate() + 7)
    else if (periodo === 'mensal') fim.setUTCMonth(fim.getUTCMonth() + 1)
    else if (periodo === 'anual') fim.setUTCFullYear(fim.getUTCFullYear() + 1)
    else fim.setUTCDate(fim.getUTCDate() + 1)
    return fim
}

// "2026-11-21" (ou uma data ISO) -> dia puro; null se não for uma data válida.
export function diaPuroDe(valor) {
    const texto = String(valor ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null
    const data = new Date(`${texto}T00:00:00.000Z`)
    return Number.isNaN(data.getTime()) ? null : data
}

// Instante em que o dia puro começa no relógio de Brasília (UTC-3, sem horário de verão desde 2019): para comparar
// com datas de verdade, como a hora em que um pagamento foi registrado.
export function instanteDeBrasilia(diaPuro) {
    return new Date(diaPuro.getTime() + 3 * 60 * 60 * 1000)
}
