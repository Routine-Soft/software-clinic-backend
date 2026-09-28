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
