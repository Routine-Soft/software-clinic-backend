import { diaPuroDe } from '../shared/utils/dia-puro.js'
import { CATEGORIAS_DESPESA, FORMAS_DESPESA } from './despesa.model.js'
import AppError from '../../errors/AppError.js'

const CAMPOS = ['descricao', 'categoria', 'valor', 'data', 'formaPagamento', 'fornecedor', 'observacao']

// Valida e normaliza os campos de uma despesa. `parcial`: na edição, só o que veio no corpo.
export function despesaDTO(body = {}, { parcial = false } = {}) {
    const dto = {}
    for (const campo of CAMPOS) {
        if (campo in body) dto[campo] = body[campo]
    }

    if (!parcial || 'descricao' in dto) {
        dto.descricao = String(dto.descricao ?? '').trim()
        if (!dto.descricao) throw new AppError('Informe a descrição da despesa', 400)
    }
    if (!parcial || 'valor' in dto) {
        dto.valor = Math.round(Number(dto.valor) * 100) / 100
        if (!Number.isFinite(dto.valor) || dto.valor <= 0) throw new AppError('Informe um valor maior que zero', 400)
    }
    if (!parcial || 'data' in dto) {
        dto.data = diaPuroDe(dto.data)
        if (!dto.data) throw new AppError('Informe a data da despesa', 400)
    }
    if ('categoria' in dto && !CATEGORIAS_DESPESA.includes(dto.categoria)) dto.categoria = 'outros'
    if ('formaPagamento' in dto && !FORMAS_DESPESA.includes(dto.formaPagamento)) dto.formaPagamento = null
    if ('fornecedor' in dto) dto.fornecedor = String(dto.fornecedor ?? '').trim()
    if ('observacao' in dto) dto.observacao = String(dto.observacao ?? '').trim()
    return dto
}

// Quantos meses a despesa nova se repete (1 = só esta). Até 24 meses de uma vez.
export function mesesDeRepeticao(body = {}) {
    const meses = Number.parseInt(body.repetirMeses, 10)
    if (!Number.isFinite(meses) || meses <= 1) return 1
    if (meses > 24) throw new AppError('A despesa pode se repetir por até 24 meses', 400)
    return meses
}
