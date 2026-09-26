import { ProntuarioController } from './prontuario.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function prontuarioRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        fastify.get('/prontuarios', ProntuarioController.getAllProntuarios)
        fastify.get('/prontuarios/:id', ProntuarioController.getProntuarioById)
        fastify.post('/prontuarios', ProntuarioController.createProntuario)
        fastify.patch('/prontuarios/:id', ProntuarioController.updateProntuario)
        fastify.patch('/prontuarios/:id/finalizar', ProntuarioController.finalizarAtendimento)
        fastify.delete('/prontuarios/:id', ProntuarioController.deleteProntuario)
    })
}