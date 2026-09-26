export function createAgendaDTO(body) {
    return {
        data: body.data,
        horaInicio: body.horaInicio,
        horaFim: body.horaFim,
        salaId: body.salaId,
        pacienteId: body.pacienteId,
        profissionalId: body.profissionalId,
        servicoId: body.servicoId,
        convenioId: body.convenioId || null,
        financeiro: {
            valor: body.financeiro.valor,
            vencimento: body.financeiro.vencimento,
            parcelamento: body.financeiro.parcelamento || 1,
            formasPagamento: body.financeiro.formasPagamento || [],
        },
    }
}

export function updateAgendaDTO(body) {
    const allowed = [
        'data',
        'horaInicio',
        'horaFim',
        'salaId',
        'pacienteId',
        'profissionalId',
        'servicoId',
        'convenioId',
        'financeiro',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}