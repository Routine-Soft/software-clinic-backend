// Regra de preço e comissão de um serviço para o convênio do atendimento (sem convênio, ou convênio fora da
// tabela do serviço, usa a regra particular).
export function regraDoServico(servico, convenioId) {
    const linha = convenioId
        ? (servico?.tabelaConvenios ?? []).find((l) => String(l.convenioId) === String(convenioId))
        : null
    const origem = linha ?? servico ?? {}
    return {
        preco: origem.preco ?? 0,
        comissao: origem.comissao ?? 0,
        comissaoTipo: origem.comissaoTipo ?? 'valor',
        doConvenio: !!linha,
    }
}

// Valor em reais da comissão: o valor fixo, ou o percentual aplicado sobre o que foi cobrado no atendimento.
export function calcularComissao(regra, valorCobrado) {
    if (regra.comissaoTipo === 'percentual') {
        return Math.round((Number(valorCobrado) || 0) * regra.comissao) / 100
    }
    return regra.comissao
}
