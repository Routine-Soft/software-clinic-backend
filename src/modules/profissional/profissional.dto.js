export function createProfissionalDTO(body) {
    return {
        nome: body.nome,
        tipoRegistro: body.tipoRegistro,
        numeroRegistro: body.numeroRegistro,
        especialidadeIds: Array.isArray(body.especialidadeIds) ? body.especialidadeIds : [],
        usuarioId: body.usuarioId || null,
        exibirNaTv: body.exibirNaTv !== false,
    }
}

export function updateProfissionalDTO(body) {
    const allowed = [
        'nome',
        'tipoRegistro',
        'numeroRegistro',
        'especialidadeIds',
        'usuarioId',
        'exibirNaTv',
    ]
    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
    if ('exibirNaTv' in dto) dto.exibirNaTv = dto.exibirNaTv !== false
    return dto
}