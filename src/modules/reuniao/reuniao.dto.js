const CAMPOS = ['nome', 'telefone', 'observacoes', 'data', 'horaInicio', 'horaFim']

export function createReuniaoDTO(body) {
    return Object.fromEntries(CAMPOS.map((campo) => [campo, body[campo]]))
}

export function updateReuniaoDTO(body) {
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => [...CAMPOS, 'status'].includes(key))
    )
}
