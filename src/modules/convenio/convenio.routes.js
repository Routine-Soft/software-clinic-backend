import { ConvenioController } from './convenio.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function convenioRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/convenios', ConvenioController.getAllConvenios)
        fastify.get('/convenios/:id', ConvenioController.getConvenioById)
        // Todos da clínica leem; só o admin altera (os convênios definem preços e comissões nos serviços).
        const soAdmin = { preHandler: authorize(['admin', 'super_admin', 'recepcao']) }
        fastify.post('/convenios', soAdmin, ConvenioController.createConvenio)
        fastify.patch('/convenios/:id', soAdmin, ConvenioController.updateConvenio)
        fastify.delete('/convenios/:id', soAdmin, ConvenioController.deleteConvenio)
    })
}