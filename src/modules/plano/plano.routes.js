import { PlanoController } from './plano.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function planoRoutes(fastify) {

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)

        fastify.get('/planos', PlanoController.getAllPlanos)
        fastify.get('/planos/:id', PlanoController.getPlanoById)

        fastify.post('/planos', { preHandler: authorize(['super_admin']) }, PlanoController.createPlano)
        fastify.patch('/planos/:id', { preHandler: authorize(['super_admin']) }, PlanoController.updatePlano)
        fastify.delete('/planos/:id', { preHandler: authorize(['super_admin']) }, PlanoController.deletePlano)
    })
}