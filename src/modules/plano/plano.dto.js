// Um recurso por item, sem linhas em branco nem repetidos.
function recursosDTO(lista) {
    if (!Array.isArray(lista)) return []
    return [...new Set(lista.map((r) => (typeof r === 'string' ? r.trim() : '')).filter(Boolean))].slice(0, 30)
}

export function createPlanoDTO(body) {
    return {
        nome: body.nome,
        tipo: body.tipo,
        preco: body.preco || 0,
        duracaoDiasTrial: body.duracaoDiasTrial || null,
        individual: body.individual === true,
        descricao: typeof body.descricao === 'string' ? body.descricao.trim() : '',
        recursos: recursosDTO(body.recursos),
    }
}

export function updatePlanoDTO(body) {
    const allowed = ['nome', 'preco', 'duracaoDiasTrial', 'ativo', 'individual', 'descricao']
    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
    if ('recursos' in body) dto.recursos = recursosDTO(body.recursos)
    return dto
}