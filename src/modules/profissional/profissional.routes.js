import { ProfissionalController } from './profissional.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function profissionalRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/profissionais', ProfissionalController.getAllProfissionais)
        fastify.get('/profissionais/:id', ProfissionalController.getProfissionalById)
        // Todos da clínica leem (agenda); só o admin cadastra e vincula logins, porque o vínculo dá acesso às comissões.
        const soAdmin = { preHandler: authorize(['admin', 'super_admin']) }
        fastify.post('/profissionais', soAdmin, ProfissionalController.createProfissional)
        fastify.patch('/profissionais/:id', soAdmin, ProfissionalController.updateProfissional)
        fastify.delete('/profissionais/:id', soAdmin, ProfissionalController.deleteProfissional)
    })
}