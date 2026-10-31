// Coparticipação só existe quando quem paga é o plano.
function comRegraDePagamento(dados) {
    if (dados.quemPaga === 'paciente') return { ...dados, coparticipacao: 0 }
    if ('coparticipacao' in dados) return { ...dados, coparticipacao: Number(dados.coparticipacao) || 0 }
    return dados
}

export function createConvenioDTO(body) {
    const dados = { nome: body.nome }
    if (body.quemPaga) dados.quemPaga = body.quemPaga
    if ('coparticipacao' in body) dados.coparticipacao = body.coparticipacao
    return comRegraDePagamento(dados)
}

export function updateConvenioDTO(body) {
    const allowed = ['nome', 'quemPaga', 'coparticipacao']
    return comRegraDePagamento(Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    ))
}
