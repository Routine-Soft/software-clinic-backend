export function createPacienteDTO(body) {
    return {
        nome: body.nome,
        telefone: body.telefone,
        email: body.email,
        cpf: body.cpf,
        dataNascimento: body.dataNascimento,
        convenioId: body.convenioId || null,
        empresaId: body.empresaId || null,
        aceitaWhatsapp: body.aceitaWhatsapp === true,
    }
}

export function updatePacienteDTO(body) {
    const allowed = [
        'nome',
        'telefone',
        'email',
        'cpf',
        'dataNascimento',
        'convenioId',
        'empresaId',
        'aceitaWhatsapp',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}