import { PacienteController } from './paciente.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function pacienteRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/pacientes', PacienteController.getAllPacientes)
        fastify.get('/pacientes/:id', PacienteController.getPacienteById)
        fastify.post('/pacientes', PacienteController.createPaciente)
        fastify.patch('/pacientes/:id', PacienteController.updatePaciente)
        fastify.delete('/pacientes/:id', PacienteController.deletePaciente)
    })
}