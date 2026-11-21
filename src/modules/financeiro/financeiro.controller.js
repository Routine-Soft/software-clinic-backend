import { FinanceiroService } from './financeiro.service.js'
import { DespesaService } from './despesa.service.js'

export const FinanceiroController = {
    async painel(req, reply) {
        const dados = await FinanceiroService.painel(req.user.tenantId, req.query)
        return reply.send({ data: dados })
    },

    async criarDespesa(req, reply) {
        const { despesa, quantidade } = await DespesaService.criar(req.user.tenantId, req.user.id, req.body)
        const message = quantidade > 1 ? `Despesa lançada para os próximos ${quantidade} meses` : 'Despesa lançada com sucesso'
        return reply.code(201).send({ data: despesa, message })
    },

    async atualizarDespesa(req, reply) {
        const despesa = await DespesaService.atualizar(req.params.id, req.user.tenantId, req.body)
        return reply.send({ data: despesa, message: 'Despesa atualizada com sucesso' })
    },

    async pagarDespesa(req, reply) {
        const pago = req.body?.pago !== false
        const despesa = await DespesaService.marcarPagamento(req.params.id, req.user.tenantId, req.user.id, { pago, formaPagamento: req.body?.formaPagamento })
        return reply.send({ data: despesa, message: pago ? 'Despesa marcada como paga' : 'Pagamento da despesa desfeito' })
    },

    async excluirDespesa(req, reply) {
        const quantidade = await DespesaService.excluir(req.params.id, req.user.tenantId, { futuras: req.query?.futuras === 'true' })
        const message = quantidade > 1 ? `${quantidade} despesas excluídas` : 'Despesa excluída'
        return reply.send({ data: null, message })
    },
}
