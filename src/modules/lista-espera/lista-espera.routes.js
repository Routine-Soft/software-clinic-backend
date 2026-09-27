import { ListaEsperaController } from './lista-espera.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function listaEsperaRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/lista-espera', ListaEsperaController.getAllListaEspera)
        fastify.get('/lista-espera/:id', ListaEsperaController.getListaEsperaById)
        fastify.post('/lista-espera', ListaEsperaController.createListaEspera)
        fastify.patch('/lista-espera/:id', ListaEsperaController.updateListaEspera)
        fastify.delete('/lista-espera/:id', ListaEsperaController.deleteListaEspera)
    })
}