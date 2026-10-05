import { ServicoController } from './servico.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function servicoRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // Todos da clínica leem (a agenda precisa da lista); só o admin altera preço e comissão.
        const soAdmin = { preHandler: authorize(['admin', 'super_admin', 'recepcao']) }

        fastify.get('/servicos', ServicoController.getAllServicos)
        fastify.get('/servicos/:id', ServicoController.getServicoById)
        fastify.post('/servicos', soAdmin, ServicoController.createServico)
        fastify.patch('/servicos/:id', soAdmin, ServicoController.updateServico)
        fastify.delete('/servicos/:id', soAdmin, ServicoController.deleteServico)
    })
}
