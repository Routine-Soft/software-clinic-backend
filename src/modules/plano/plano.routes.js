import { PlanoController } from './plano.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function planoRoutes(fastify) {
    // Público: a landing mostra os planos à venda.
    fastify.get('/planos/publicos', PlanoController.publicos)

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)

        // Cliques nos cadeados: a clínica registra, o super admin vê o resumo.
        fastify.post('/planos/bloqueios', { preHandler: [authorize(['admin', 'profissional', 'recepcao']), exigirAssinaturaAtiva] }, PlanoController.registrarBloqueio)
        fastify.get('/planos/bloqueios/resumo', { preHandler: authorize(['super_admin']) }, PlanoController.resumoDeBloqueios)

        fastify.get('/planos', PlanoController.getAllPlanos)
        fastify.get('/planos/:id', PlanoController.getPlanoById)

        fastify.post('/planos', { preHandler: authorize(['super_admin']) }, PlanoController.createPlano)
        fastify.patch('/planos/:id', { preHandler: authorize(['super_admin']) }, PlanoController.updatePlano)
        fastify.delete('/planos/:id', { preHandler: authorize(['super_admin']) }, PlanoController.deletePlano)
    })
}