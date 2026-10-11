import { IndicacaoService } from './indicacao.service.js'

export const IndicacaoController = {
    async resumo(req, reply) {
        const resumo = await IndicacaoService.resumo(req.user.tenantId)
        return reply.send({ data: resumo })
    },
}
