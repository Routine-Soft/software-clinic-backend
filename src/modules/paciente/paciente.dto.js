export function createPacienteDTO(body) {
    return {
        nome: body.nome,
        telefone: body.telefone,
        email: body.email,
        cpf: body.cpf,
        dataNascimento: body.dataNascimento,
        convenioId: body.convenioId || null,
        empresaId: body.empresaId || null,
        antecedentesClinicos: body.antecedentesClinicos || '',
        antecedentesCirurgicos: body.antecedentesCirurgicos || '',
        antecedentesFamiliares: body.antecedentesFamiliares || '',
        habitos: body.habitos || '',
        alergias: body.alergias || '',
        medicamentosEmUso: body.medicamentosEmUso || '',
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
        'antecedentesClinicos',
        'antecedentesCirurgicos',
        'antecedentesFamiliares',
        'habitos',
        'alergias',
        'medicamentosEmUso',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}