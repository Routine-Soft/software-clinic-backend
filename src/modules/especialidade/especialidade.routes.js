import { EspecialidadeController } from './especialidade.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function especialidadeRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/especialidades', EspecialidadeController.getAllEspecialidades)
        fastify.get('/especialidades/:id', EspecialidadeController.getEspecialidadeById)
        fastify.post('/especialidades', EspecialidadeController.createEspecialidade)
        fastify.patch('/especialidades/:id', EspecialidadeController.updateEspecialidade)
        fastify.delete('/especialidades/:id', EspecialidadeController.deleteEspecialidade)
    })
}