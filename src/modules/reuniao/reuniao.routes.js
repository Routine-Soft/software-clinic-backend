import { ReuniaoController } from './reuniao.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function reuniaoRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)
        // Agenda de reuniões da dona: profissionais não veem.
        fastify.addHook('preHandler', authorize(['admin', 'recepcao', 'super_admin']))

        fastify.get('/reunioes', ReuniaoController.getAllReunioes)
        fastify.get('/reunioes/:id', ReuniaoController.getReuniaoById)
        fastify.post('/reunioes', ReuniaoController.createReuniao)
        fastify.patch('/reunioes/:id', ReuniaoController.updateReuniao)
        fastify.delete('/reunioes/:id', ReuniaoController.deleteReuniao)
    })
}
