function tabelaDTO(tabela) {
    if (!Array.isArray(tabela)) return []
    return tabela.map((linha) => ({
        convenioId: linha?.convenioId,
        preco: linha?.preco,
        comissao: linha?.comissao ?? 0,
        comissaoTipo: linha?.comissaoTipo ?? 'valor',
    }))
}

export function createServicoDTO(body) {
    return {
        nome: body.nome,
        tipo: body.tipo,
        qtdDias: body.tipo === 'pacote' ? body.qtdDias : null,
        preco: body.preco,
        comissao: body.comissao ?? 0,
        comissaoTipo: body.comissaoTipo ?? 'valor',
        tabelaConvenios: tabelaDTO(body.tabelaConvenios),
    }
}

export function updateServicoDTO(body) {
    const allowed = ['nome', 'tipo', 'qtdDias', 'preco', 'comissao', 'comissaoTipo', 'tabelaConvenios']
    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
    if ('tabelaConvenios' in dto) dto.tabelaConvenios = tabelaDTO(dto.tabelaConvenios)
    return dto
}
