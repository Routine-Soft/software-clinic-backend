export function createAvaliacaoNr01DTO(body) {
    return {
        empresaId: body.empresaId,
        pacienteId: body.pacienteId || null,
        profissionalId: body.profissionalId,
        data: body.data || new Date(),
        respostas: Array.isArray(body.respostas) ? body.respostas : [],
        classificacaoRisco: body.classificacaoRisco || null,
        recomendacoes: body.recomendacoes || '',
    }
}

export function updateAvaliacaoNr01DTO(body) {
    const allowed = ['empresaId', 'pacienteId', 'profissionalId', 'data', 'respostas', 'classificacaoRisco', 'recomendacoes']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}
