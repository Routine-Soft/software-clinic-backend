import { AssinaturaController } from './assinatura.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function assinaturaRoutes(fastify) {

    // pública: quem chama é o Mercado Pago, não um usuário logado
    fastify.post('/assinaturas/webhook', AssinaturaController.webhook)

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)

        fastify.get('/assinaturas/atual', AssinaturaController.getAtual)
        fastify.post('/assinaturas/checkout', AssinaturaController.checkout)
    })
}