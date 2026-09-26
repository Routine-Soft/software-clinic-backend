export function createUserDTO(body) {
    return {
        nomeCompleto: body.nomeCompleto,
        email: body.email,
        password: body.password,
        telefone: body.telefone,
        cnpj: body.cnpj || null,
        nomeEmpresa: body.nomeEmpresa,
        role: body.role || 'admin',
    }
}

export function updateUserDTO(body) {
    const allowed = [
        'nomeCompleto',
        'email',
        'telefone',
        'cnpj',
        'nomeEmpresa',
    ]
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )
}

export function updateMeDTO(body, role) {
    const allowed = ['nomeCompleto', 'email', 'telefone']
    if (['admin', 'super_admin'].includes(role)) {
        allowed.push('nomeEmpresa', 'cnpj')
    }

    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )

    if ('cnpj' in dto) dto.cnpj = dto.cnpj || null
    if ('nomeEmpresa' in dto && !dto.nomeEmpresa) delete dto.nomeEmpresa

    return dto
}

export function toUserResponseDto(user) {
    return {
        id: user._id,
        nomeCompleto: user.nomeCompleto,
        email: user.email,
        telefone: user.telefone,
        cnpj: user.cnpj,
        nomeEmpresa: user.nomeEmpresa,
        role: user.role,
        createdAt: user.createdAt,
    };
}

export function loginUserDTO(body) {
    return {
        email: body.email,
        password: body.password,
    }
}