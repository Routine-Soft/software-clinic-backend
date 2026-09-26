import { PrintController } from './print.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function printRoutes(fastify) {
    fastify.addHook('preHandler', authenticate)

    fastify.post('/print/test', PrintController.printTest)
    fastify.post('/print/agendamento/:agendaId', PrintController.printAgendamento)
}