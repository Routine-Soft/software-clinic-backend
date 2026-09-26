export function createProfissionalDTO(body) {
    return {
        nome: body.nome,
        tipoRegistro: body.tipoRegistro,
        numeroRegistro: body.numeroRegistro,
        especialidadeIds: Array.isArray(body.especialidadeIds) ? body.especialidadeIds : [],
        usuarioId: body.usuarioId || null,
    }
}

export function updateProfissionalDTO(body) {
    const allowed = [
        'nome',
        'tipoRegistro',
        'numeroRegistro',
        'especialidadeIds',
        'usuarioId',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}