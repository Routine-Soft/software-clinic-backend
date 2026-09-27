import { ProfissionalController } from './profissional.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function profissionalRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/profissionais', ProfissionalController.getAllProfissionais)
        fastify.get('/profissionais/:id', ProfissionalController.getProfissionalById)
        fastify.post('/profissionais', ProfissionalController.createProfissional)
        fastify.patch('/profissionais/:id', ProfissionalController.updateProfissional)
        fastify.delete('/profissionais/:id', ProfissionalController.deleteProfissional)
    })
}