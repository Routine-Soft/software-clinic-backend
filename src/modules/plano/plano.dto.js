export function createPlanoDTO(body) {
    return {
        nome: body.nome,
        tipo: body.tipo,
        preco: body.preco || 0,
        duracaoDiasTrial: body.duracaoDiasTrial || null,
        nivel: ['basic', 'pro', 'rede'].includes(body.nivel) ? body.nivel : 'pro',
        descricao: typeof body.descricao === 'string' ? body.descricao.trim() : '',
        // A moeda é escolhida ao criar e não muda depois (as assinaturas dependem dela).
        moeda: body.moeda === 'USD' ? 'USD' : 'BRL',
    }
}

export function updatePlanoDTO(body) {
    const allowed = ['nome', 'preco', 'duracaoDiasTrial', 'ativo', 'nivel', 'descricao']
    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
    if ('nivel' in dto && !['basic', 'pro', 'rede'].includes(dto.nivel)) delete dto.nivel
    return dto
}