import { ComissaoService } from './comissao.service.js'

export const ComissaoController = {
    async resumo(req, reply) {
        const resumo = await ComissaoService.resumoDaClinica(req.user.tenantId)
        return reply.send({ data: resumo })
    },

    async pendentes(req, reply) {
        const pendentes = await ComissaoService.pendentesDoProfissional(req.user.tenantId, req.params.profissionalId)
        return reply.send({ data: pendentes })
    },

    async pagar(req, reply) {
        const pagamento = await ComissaoService.pagar(req.user.tenantId, req.params.profissionalId, req.user.id)
        return reply.code(201).send({ data: pagamento, message: `Repasse de ${pagamento.profissional.nome} pago` })
    },

    async historico(req, reply) {
        const pagamentos = await ComissaoService.historico(req.user.tenantId, req.query?.profissionalId)
        return reply.send({ data: pagamentos })
    },

    async minhas(req, reply) {
        const dados = await ComissaoService.minhas(req.user, req.query?.periodo)
        return reply.send({ data: dados })
    },
}
