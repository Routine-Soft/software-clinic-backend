export function createEmpresaDTO(body) {
    return {
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia || '',
        cnpj: body.cnpj,
        telefone: body.telefone || '',
        email: body.email || '',
        endereco: body.endereco || '',
        setor: body.setor || '',
    }
}

export function updateEmpresaDTO(body) {
    const allowed = ['razaoSocial', 'nomeFantasia', 'cnpj', 'telefone', 'email', 'endereco', 'setor']
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}
