import { FinanceiroService } from './financeiro.service.js'
import { LancamentoService } from './lancamento.service.js'
import { ExtratoAcoesService } from './extrato-acoes.service.js'

const NOME = { despesa: 'Despesa', receita: 'Receita' }

export const FinanceiroController = {
    async painel(req, reply) {
        const dados = await FinanceiroService.painel(req.user.tenantId, req.query)
        return reply.send({ data: dados })
    },

    // Despesas e receitas avulsas
    async criarLancamento(req, reply) {
        const { lancamento, quantidade } = await LancamentoService.criar(req.user.tenantId, req.user.id, req.body ?? {})
        const message = quantidade > 1
            ? `${NOME[lancamento.tipo]} lançada para os próximos ${quantidade} meses`
            : `${NOME[lancamento.tipo]} lançada com sucesso`
        return reply.code(201).send({ data: lancamento, message })
    },

    async atualizarLancamento(req, reply) {
        const lancamento = await LancamentoService.atualizar(req.params.id, req.user.tenantId, req.user.id, req.body ?? {})
        return reply.send({ data: lancamento, message: `${NOME[lancamento.tipo]} atualizada com sucesso` })
    },

    async pagarLancamento(req, reply) {
        const pago = req.body?.pago !== false
        const lancamento = await LancamentoService.marcarPagamento(req.params.id, req.user.tenantId, req.user.id, { pago })
        const message = lancamento.tipo === 'despesa'
            ? (pago ? 'Despesa marcada como paga' : 'Pagamento da despesa desfeito')
            : (pago ? 'Receita marcada como recebida' : 'Recebimento da receita desfeito')
        return reply.send({ data: lancamento, message })
    },

    async excluirLancamento(req, reply) {
        const quantidade = await LancamentoService.excluir(req.params.id, req.user.tenantId, { futuras: req.query?.futuras === 'true' })
        const message = quantidade > 1 ? `${quantidade} lançamentos excluídos` : 'Lançamento excluído'
        return reply.send({ data: null, message })
    },

    // Atendimentos e repasses mexidos direto do extrato
    async editarAtendimento(req, reply) {
        const agenda = await ExtratoAcoesService.editarAtendimento(req.params.id, req.user, req.body ?? {})
        return reply.send({ data: agenda, message: 'Atendimento atualizado' })
    },

    async excluirAtendimento(req, reply) {
        await ExtratoAcoesService.excluirAtendimento(req.params.id, req.user.tenantId)
        return reply.send({ data: null, message: 'Atendimento excluído' })
    },

    async desfazerRepasse(req, reply) {
        await ExtratoAcoesService.desfazerRepasse(req.params.id, req.user.tenantId)
        return reply.send({ data: null, message: 'Pagamento do repasse desfeito: os atendimentos voltaram a ficar pendentes' })
    },
}
