export function createAvaliacaoNr01DTO(body) {
    return {
        empresaId: body.empresaId,
        pacienteId: body.pacienteId || null,
        profissionalId: body.profissionalId,
        servicoId: body.servicoId || null,
        data: body.data || new Date(),
        respostas: Array.isArray(body.respostas) ? body.respostas : [],
        classificacaoRisco: body.classificacaoRisco || null,
        recomendacoes: body.recomendacoes || '',
    }
}

export function updateAvaliacaoNr01DTO(body) {
    const allowed = ['empresaId', 'pacienteId', 'profissionalId', 'servicoId', 'data', 'respostas', 'classificacaoRisco', 'recomendacoes']
    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
    if ('servicoId' in dto) dto.servicoId = dto.servicoId || null
    return dto
}
