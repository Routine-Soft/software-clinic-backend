import mongoose from 'mongoose'
import LancamentoModel from './lancamento.model.js'
import { lancamentoDTO, mesesDeRepeticao, tipoDoLancamento } from './lancamento.dto.js'
import AppError from '../../errors/AppError.js'

// Mesmo dia do mês, `meses` depois; no mês mais curto, o último dia dele (31/01 -> 28/02).
function somarMeses(diaPuro, meses) {
    const ano = diaPuro.getUTCFullYear()
    const mes = diaPuro.getUTCMonth() + meses
    const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
    return new Date(Date.UTC(ano, mes, Math.min(diaPuro.getUTCDate(), ultimoDia)))
}

async function buscar(id, tenantId) {
    const lancamento = mongoose.isValidObjectId(id) ? await LancamentoModel.findOne({ _id: id, tenantId }) : null
    if (!lancamento) throw new AppError('Lançamento não encontrado', 404)
    return lancamento
}

export const LancamentoService = {

    // Cria a despesa ou a receita (e as cópias dos meses seguintes, se ela se repete). Já paga só a primeira, se pedido.
    async criar(tenantId, usuarioId, body) {
        const tipo = tipoDoLancamento(body.tipo)
        const dto = lancamentoDTO(body, tipo)
        const meses = mesesDeRepeticao(body)
        const grupoRecorrenciaId = meses > 1 ? new mongoose.Types.ObjectId() : null
        const pago = body.pago === true
        const documentos = Array.from({ length: meses }, (_, i) => ({
            ...dto,
            tipo,
            data: somarMeses(dto.data, i),
            grupoRecorrenciaId,
            criadoPor: usuarioId,
            tenantId,
            ...(pago && i === 0 ? { pagoEm: new Date(), pagoPor: usuarioId } : {}),
        }))
        const criados = await LancamentoModel.insertMany(documentos)
        return { lancamento: criados[0], quantidade: criados.length }
    },

    // Edita os dados e, se vier `pago`, também a situação do pagamento.
    async atualizar(id, tenantId, usuarioId, body) {
        const lancamento = await buscar(id, tenantId)
        lancamento.set(lancamentoDTO(body, lancamento.tipo, { parcial: true }))
        if (typeof body.pago === 'boolean' && body.pago !== !!lancamento.pagoEm) {
            lancamento.pagoEm = body.pago ? new Date() : null
            lancamento.pagoPor = body.pago ? usuarioId : null
        }
        await lancamento.save()
        return lancamento
    },

    // Marca (ou desfaz) o pagamento.
    async marcarPagamento(id, tenantId, usuarioId, { pago }) {
        const lancamento = await buscar(id, tenantId)
        lancamento.pagoEm = pago ? new Date() : null
        lancamento.pagoPor = pago ? usuarioId : null
        await lancamento.save()
        return lancamento
    },

    // Apaga o lançamento. `futuras`: num lançamento que se repete, também os dos meses seguintes ainda não pagos.
    async excluir(id, tenantId, { futuras = false } = {}) {
        const lancamento = await buscar(id, tenantId)
        if (futuras && lancamento.grupoRecorrenciaId) {
            const { deletedCount } = await LancamentoModel.deleteMany({
                tenantId,
                grupoRecorrenciaId: lancamento.grupoRecorrenciaId,
                $or: [{ _id: lancamento._id }, { data: { $gt: lancamento.data }, pagoEm: null }],
            })
            return deletedCount
        }
        await lancamento.deleteOne()
        return 1
    },
}
