// Responsáveis vêm do formulário com até dois blocos; blocos totalmente em branco são descartados.
function responsaveisDTO(lista) {
    if (!Array.isArray(lista)) return []
    const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')
    return lista
        .map((r) => ({
            nome: texto(r?.nome),
            parentesco: texto(r?.parentesco),
            cpf: texto(r?.cpf),
            telefone: texto(r?.telefone),
            email: texto(r?.email).replace(/\s+/g, '').toLowerCase(),
        }))
        .filter((r) => Object.values(r).some(Boolean))
}

export function createPacienteDTO(body) {
    return {
        nome: body.nome,
        telefone: body.telefone,
        email: body.email,
        cpf: typeof body.cpf === 'string' ? body.cpf.trim() : '',
        dataNascimento: body.dataNascimento,
        convenioId: body.convenioId || null,
        empresaId: body.empresaId || null,
        responsaveis: responsaveisDTO(body.responsaveis),
        teste: body.teste === true,
    }
}

// "teste" fica de fora de propósito: um paciente real não pode virar teste para ter o prontuário apagado.
export function updatePacienteDTO(body) {
    const allowed = [
        'nome',
        'telefone',
        'email',
        'cpf',
        'dataNascimento',
        'convenioId',
        'empresaId',
    ]
    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
    if ('responsaveis' in body) dto.responsaveis = responsaveisDTO(body.responsaveis)
    return dto
}