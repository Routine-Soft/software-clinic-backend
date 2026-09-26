import { AgendaController } from './agenda.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function agendaRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        fastify.get('/agendas', AgendaController.getAllAgendas)
        fastify.get('/agendas/:id', AgendaController.getAgendaById)
        fastify.post('/agendas', AgendaController.createAgenda)
        fastify.patch('/agendas/:id', AgendaController.updateAgenda)
        fastify.post('/agendas/:id/cancelar', AgendaController.cancelarAgenda)
        fastify.post('/agendas/grupo/:grupoRecorrenciaId/cancelar', AgendaController.cancelarGrupoRecorrencia)
        fastify.delete('/agendas/:id', AgendaController.deleteAgenda)
    })
}