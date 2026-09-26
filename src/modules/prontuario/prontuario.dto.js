export function createProntuarioDTO(body) {
    return {
        pacienteId: body.pacienteId,
        profissionalId: body.profissionalId,
        agendamentoId: body.agendamentoId || null,
        convenioId: body.convenioId || null,
        queixaPrincipal: body.queixaPrincipal || '',
        historicoAtual: body.historicoAtual || '',
        exameObjetivo: body.exameObjetivo || '',
        avaliacao: body.avaliacao || '',
        cid10: body.cid10 || null,
        conduta: body.conduta || '',
        informacoes: body.informacoes || '',
        sinaisVitais: body.sinaisVitais || null,
        anexos: Array.isArray(body.anexos) ? body.anexos : [],
        proximoRetorno: body.proximoRetorno || null,
    }
}

export function updateProntuarioDTO(body) {
    const allowed = [
        'queixaPrincipal',
        'historicoAtual',
        'exameObjetivo',
        'avaliacao',
        'cid10',
        'conduta',
        'informacoes',
        'sinaisVitais',
        'anexos',
        'proximoRetorno',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}