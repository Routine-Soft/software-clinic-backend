import { paisValido } from '../shared/utils/pais.js'

import { interpretarDocumento } from '../assinatura/documento.js'
import AppError from '../../errors/AppError.js'

export function createUserDTO(body) {
    return {
        nomeCompleto: body.nomeCompleto,
        email: body.email,
        password: body.password,
        telefone: body.telefone,
        cnpj: body.cnpj || null,
        nomeEmpresa: body.nomeEmpresa,
        role: body.role || 'admin',
        pais: paisValido(body.pais) ?? 'BR',
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

export function updateMeDTO(body, role, ehAfiliado = false) {
    const allowed = ['nomeCompleto', 'email', 'telefone']
    if (['admin', 'super_admin'].includes(role)) {
        allowed.push('nomeEmpresa', 'cnpj')
    }
    if (ehAfiliado) {
        allowed.push('chavePix', 'documento')
    }

    const dto = Object.fromEntries(
        Object.entries(body).filter(([key]) => allowed.includes(key))
    )

    if ('cnpj' in dto) dto.cnpj = dto.cnpj || null
    if ('chavePix' in dto) {
        dto.chavePix = String(dto.chavePix ?? '').trim()
        if (!dto.chavePix) throw new AppError('Informe a chave Pix para receber as comissões', 400)
    }
    if ('documento' in dto) {
        dto.documento = interpretarDocumento(dto.documento)?.numero
        if (!dto.documento) throw new AppError('Informe um CPF ou CNPJ válido', 400)
    }
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
        email: String(body.email ?? '').replace(/\s+/g, '').toLowerCase(),
        password: body.password,
    }
}