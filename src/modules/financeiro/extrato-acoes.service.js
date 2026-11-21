import mongoose from 'mongoose'
import AgendaModel from '../agenda/agenda.model.js'
import { AgendaService } from '../agenda/agenda.service.js'
import ComissaoPagamentoModel from '../comissao/comissao-pagamento.model.js'
import { FORMAS_LANCAMENTO } from './lancamento.model.js'
import AppError from '../../errors/AppError.js'

// O que a dona faz direto no extrato com os lançamentos que vêm de outras telas: atendimentos (da agenda) e
// repasses pagos (dos repasses). Despesas e receitas avulsas ficam em lancamento.service.js.

function arredondar(valor) {
    return Math.round((valor ?? 0) * 100) / 100
}

async function buscarAtendimento(id, tenantId) {
    const agenda = mongoose.isValidObjectId(id) ? await AgendaModel.findOne({ _id: id, tenantId }) : null
    if (!agenda) throw new AppError('Atendimento não encontrado', 404)
    return agenda
}

function formasDoCorpo(formas) {
    if (!Array.isArray(formas)) throw new AppError('Formas de pagamento inválidas', 400)
    return formas
        .map((f) => ({ tipo: String(f?.tipo ?? ''), valor: arredondar(Number(f?.valor)) }))
        .filter((f) => {
            if (!FORMAS_LANCAMENTO.includes(f.tipo)) throw new AppError('Forma de pagamento inválida', 400)
            if (!Number.isFinite(f.valor) || f.valor < 0) throw new AppError('Informe o valor de cada forma de pagamento', 400)
            return f.valor > 0
        })
}

export const ExtratoAcoesService = {

    // Corrige o lado financeiro de um atendimento: valor, formas de pagamento e se foi recebido.
    // Mudar o valor refaz o repasse percentual ainda não pago; o repasse já pago não muda.
    async editarAtendimento(id, usuario, body = {}) {
        const agenda = await buscarAtendimento(id, usuario.tenantId)

        if ('valor' in body) {
            const valor = arredondar(Number(body.valor))
            if (!Number.isFinite(valor) || valor < 0) throw new AppError('Informe um valor válido', 400)
            agenda.financeiro.valor = valor
            const percentual = agenda.comissao?.percentual
            if (agenda.status === 'realizado' && percentual != null && !agenda.comissao?.pagamentoId) {
                agenda.comissao.valor = arredondar((valor * percentual) / 100)
            }
        }

        if ('formasPagamento' in body) {
            agenda.financeiro.formasPagamento = formasDoCorpo(body.formasPagamento)
        }

        if (typeof body.pago === 'boolean' && body.pago !== !!agenda.financeiro?.pagoEm) {
            if (agenda.cobrancaId) {
                throw new AppError('Este atendimento é de um pacote com cobrança à parte: marque o pagamento pela parcela, na agenda', 400)
            }
            agenda.financeiro.pagoEm = body.pago ? new Date() : null
            agenda.financeiro.recebidoPor = body.pago ? usuario.id : null
        }

        await agenda.save()
        return agenda
    },

    // Apaga o atendimento (some da agenda também). Com o repasse já pago, é preciso desfazer o pagamento antes.
    async excluirAtendimento(id, tenantId) {
        await buscarAtendimento(id, tenantId)
        return await AgendaService.deleteAgenda(id, tenantId)
    },

    // Desfaz um pagamento de repasse: os atendimentos dele voltam a ficar pendentes para o profissional.
    async desfazerRepasse(id, tenantId) {
        const pagamento = mongoose.isValidObjectId(id) ? await ComissaoPagamentoModel.findOne({ _id: id, tenantId }) : null
        if (!pagamento) throw new AppError('Pagamento de repasse não encontrado', 404)
        await AgendaModel.updateMany({ tenantId, 'comissao.pagamentoId': pagamento._id }, { $set: { 'comissao.pagamentoId': null } })
        await pagamento.deleteOne()
        return pagamento
    },
}
