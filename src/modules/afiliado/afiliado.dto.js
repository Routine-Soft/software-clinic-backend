import { interpretarDocumento } from '../assinatura/documento.js'
import AppError from '../../errors/AppError.js'

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')

// Dados para receber as comissões (CPF ou CNPJ e chave Pix) e o aceite dos termos.
// Valem para quem cria uma conta só de afiliado e para quem ativa o programa na conta que já tem.
export function dadosDeAfiliadoDTO(body = {}) {
    const dto = {
        documento: interpretarDocumento(body.documento)?.numero ?? null,
        chavePix: texto(body.chavePix),
    }
    if (!dto.documento) throw new AppError('Informe um CPF ou CNPJ válido', 400)
    if (!dto.chavePix) throw new AppError('Informe a chave Pix para receber as comissões', 400)
    if (body.aceitouTermos !== true) throw new AppError('Para continuar, leia e aceite os Termos do afiliado', 400)
    return dto
}

// Cadastro público de quem ainda não tem conta na Sonelia.
export function criarAfiliadoDTO(body = {}) {
    const dto = {
        nomeCompleto: texto(body.nomeCompleto),
        email: texto(body.email),
        password: typeof body.password === 'string' ? body.password : '',
        telefone: texto(body.telefone),
    }
    if (!dto.nomeCompleto || !dto.email || !dto.telefone) throw new AppError('Informe nome, e-mail e telefone', 400)
    if (dto.password.length < 6) throw new AppError('A senha precisa ter pelo menos 6 caracteres', 400)
    return { ...dto, ...dadosDeAfiliadoDTO(body) }
}
