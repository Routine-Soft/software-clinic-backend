import { IndicacaoController } from './indicacao.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function indicacaoRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        // Só a dona da conta: o desconto é na mensalidade dela. Funciona mesmo com a assinatura vencida.
        fastify.addHook('preHandler', authorize(['admin', 'super_admin']))

        fastify.get('/indicacoes', IndicacaoController.resumo)
    })
}
