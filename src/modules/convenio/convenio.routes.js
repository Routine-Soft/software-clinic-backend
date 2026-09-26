import { ConvenioController } from './convenio.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function convenioRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        fastify.get('/convenios', ConvenioController.getAllConvenios)
        fastify.get('/convenios/:id', ConvenioController.getConvenioById)
        fastify.post('/convenios', ConvenioController.createConvenio)
        fastify.patch('/convenios/:id', ConvenioController.updateConvenio)
        fastify.delete('/convenios/:id', ConvenioController.deleteConvenio)
    })
}