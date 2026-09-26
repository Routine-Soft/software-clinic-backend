export function createServicoDTO(body) {
    return {
        nome: body.nome,
        tipo: body.tipo,
        qtdDias: body.tipo === 'pacote' ? body.qtdDias : null,
        preco: body.preco,
    }
}

export function updateServicoDTO(body) {
    const allowed = ['nome', 'tipo', 'qtdDias', 'preco']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}