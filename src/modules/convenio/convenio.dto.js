export function createConvenioDTO(body) {
    return {
        nome: body.nome,
    }
}

export function updateConvenioDTO(body) {
    const allowed = ['nome']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}