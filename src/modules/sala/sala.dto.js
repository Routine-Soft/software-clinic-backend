export function createSalaDTO(body) {
    return {
        nome: body.nome,
    }
}

export function updateSalaDTO(body) {
    const allowed = ['nome']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}