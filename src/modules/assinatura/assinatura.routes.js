import { AssinaturaController } from './assinatura.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function assinaturaRoutes(fastify) {

    // pública: quem chama é o Mercado Pago, não um usuário logado (protegida por assinatura HMAC)
    fastify.post('/assinaturas/webhook', AssinaturaController.webhook)

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)

        fastify.get('/assinaturas/atual', AssinaturaController.getAtual)

        // só quem administra a clínica contrata ou consulta a cobrança
        const soAdmin = { preHandler: authorize(['admin', 'super_admin']) }
        fastify.post('/assinaturas/checkout', soAdmin, AssinaturaController.checkout)
        fastify.post('/assinaturas/sincronizar', soAdmin, AssinaturaController.sincronizar)
        fastify.post('/assinaturas/cancelar', soAdmin, AssinaturaController.cancelar)
    })
}
