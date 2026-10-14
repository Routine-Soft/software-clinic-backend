// Partículas que não contam como sobrenome na abreviação ("Maria da Silva" → "Maria S.").
const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])

// Nome do paciente como aparece na TV, conforme o que a clínica escolheu para ele. null = não mostrar.
export function nomeParaTv(nome, modo = 'abreviado') {
    const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
    if (!partes.length || modo === 'oculto') return null
    if (modo === 'completo') return partes.join(' ')
    if (modo === 'primeiro' || partes.length === 1) return partes[0]

    const sobrenome = [...partes.slice(1)].reverse().find((p) => !PARTICULAS.has(p.toLowerCase()))
    return sobrenome ? `${partes[0]} ${sobrenome[0].toUpperCase()}.` : partes[0]
}
