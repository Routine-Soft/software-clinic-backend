export function createListaEsperaDTO(body) {
    return {
        pacienteId: body.pacienteId,
        especialidadeId: body.especialidadeId,
        profissionalId: body.profissionalId || null,
        dataDesejada: body.dataDesejada || null,
        observacao: body.observacao || null,
    }
}

export function updateListaEsperaDTO(body) {
    const allowed = [
        'especialidadeId',
        'profissionalId',
        'dataDesejada',
        'observacao',
        'status',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}