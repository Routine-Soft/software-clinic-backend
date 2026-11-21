import mongoose from 'mongoose'
import DespesaModel from './despesa.model.js'
import { despesaDTO, mesesDeRepeticao } from './despesa.dto.js'
import AppError from '../../errors/AppError.js'

// Mesmo dia do mês, `meses` depois; no mês mais curto, o último dia dele (31/01 -> 28/02).
function somarMeses(diaPuro, meses) {
    const ano = diaPuro.getUTCFullYear()
    const mes = diaPuro.getUTCMonth() + meses
    const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
    return new Date(Date.UTC(ano, mes, Math.min(diaPuro.getUTCDate(), ultimoDia)))
}

async function buscar(id, tenantId) {
    const despesa = mongoose.isValidObjectId(id) ? await DespesaModel.findOne({ _id: id, tenantId }) : null
    if (!despesa) throw new AppError('Despesa não encontrada', 404)
    return despesa
}

export const DespesaService = {

    // Lança a despesa (e as cópias dos meses seguintes, se ela se repete). Já paga só a primeira, se pedido.
    async criar(tenantId, usuarioId, body) {
        const dto = despesaDTO(body)
        const meses = mesesDeRepeticao(body)
        const grupoRecorrenciaId = meses > 1 ? new mongoose.Types.ObjectId() : null
        const paga = body.pago === true
        const documentos = Array.from({ length: meses }, (_, i) => ({
            ...dto,
            data: somarMeses(dto.data, i),
            grupoRecorrenciaId,
            criadoPor: usuarioId,
            tenantId,
            ...(paga && i === 0 ? { pagoEm: new Date(), pagoPor: usuarioId } : { formaPagamento: i === 0 ? dto.formaPagamento ?? null : null }),
        }))
        const criadas = await DespesaModel.insertMany(documentos)
        return { despesa: criadas[0], quantidade: criadas.length }
    },

    async atualizar(id, tenantId, body) {
        const despesa = await buscar(id, tenantId)
        despesa.set(despesaDTO(body, { parcial: true }))
        await despesa.save()
        return despesa
    },

    // Marca (ou desfaz) o pagamento da despesa.
    async marcarPagamento(id, tenantId, usuarioId, { pago, formaPagamento }) {
        const despesa = await buscar(id, tenantId)
        despesa.pagoEm = pago ? new Date() : null
        despesa.pagoPor = pago ? usuarioId : null
        if (pago && formaPagamento !== undefined) despesa.set(despesaDTO({ formaPagamento }, { parcial: true }))
        await despesa.save()
        return despesa
    },

    // Exclui a despesa. `futuras`: numa despesa que se repete, também as dos meses seguintes ainda não pagas.
    async excluir(id, tenantId, { futuras = false } = {}) {
        const despesa = await buscar(id, tenantId)
        if (futuras && despesa.grupoRecorrenciaId) {
            const { deletedCount } = await DespesaModel.deleteMany({
                tenantId,
                grupoRecorrenciaId: despesa.grupoRecorrenciaId,
                $or: [{ _id: despesa._id }, { data: { $gt: despesa.data }, pagoEm: null }],
            })
            return deletedCount
        }
        await despesa.deleteOne()
        return 1
    },
}
