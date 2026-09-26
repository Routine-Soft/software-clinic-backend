import { SalaController } from './sala.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function salaRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        fastify.get('/salas', SalaController.getAllSalas)
        fastify.get('/salas/:id', SalaController.getSalaById)
        fastify.post('/salas', SalaController.createSala)
        fastify.patch('/salas/:id', SalaController.updateSala)
        fastify.delete('/salas/:id', SalaController.deleteSala)
    })
}