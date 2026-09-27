import { ServicoController } from './servico.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function servicoRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/servicos', ServicoController.getAllServicos)
        fastify.get('/servicos/:id', ServicoController.getServicoById)
        fastify.post('/servicos', ServicoController.createServico)
        fastify.patch('/servicos/:id', ServicoController.updateServico)
        fastify.delete('/servicos/:id', ServicoController.deleteServico)
    })
}