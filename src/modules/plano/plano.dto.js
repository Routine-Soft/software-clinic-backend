export function createPlanoDTO(body) {
    return {
        nome: body.nome,
        tipo: body.tipo,
        preco: body.preco || 0,
        duracaoDiasTrial: body.duracaoDiasTrial || null,
        individual: body.individual === true,
    }
}

export function updatePlanoDTO(body) {
    const allowed = ['nome', 'preco', 'duracaoDiasTrial', 'ativo', 'individual']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}