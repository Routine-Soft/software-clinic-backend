export function createEspecialidadeDTO(body) {
    return {
        nome: body.nome,
    }
}

export function updateEspecialidadeDTO(body) {
    const allowed = ['nome']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}