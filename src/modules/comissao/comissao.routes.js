import { ComissaoController } from './comissao.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function comissaoRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        const soAdmin = { preHandler: authorize(['admin', 'super_admin']) }

        fastify.get('/comissoes/resumo', soAdmin, ComissaoController.resumo)
        fastify.get('/comissoes/pagamentos', soAdmin, ComissaoController.historico)
        fastify.get('/comissoes/profissionais/:profissionalId/pendentes', soAdmin, ComissaoController.pendentes)
        fastify.post('/comissoes/profissionais/:profissionalId/pagar', soAdmin, ComissaoController.pagar)

        // Sem restrição de perfil: devolve só os dados do profissional vinculado ao próprio login.
        fastify.get('/comissoes/minhas', ComissaoController.minhas)
    })
}
