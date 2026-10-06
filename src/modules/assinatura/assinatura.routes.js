import { AssinaturaController } from './assinatura.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function assinaturaRoutes(fastify) {

    // pública: quem chama é o Mercado Pago, não um usuário logado (protegida por assinatura HMAC)
    fastify.post('/assinaturas/webhook', AssinaturaController.webhook)

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)

        fastify.get('/assinaturas/atual', AssinaturaController.getAtual)

        // Admin e recepção (que faz o papel de secretaria) pagam a assinatura; cancelar é só do admin.
        const quemPaga = { preHandler: authorize(['admin', 'super_admin', 'recepcao']) }
        const soAdmin = { preHandler: authorize(['admin', 'super_admin']) }
        fastify.post('/assinaturas/checkout', quemPaga, AssinaturaController.checkout)
        fastify.post('/assinaturas/sincronizar', quemPaga, AssinaturaController.sincronizar)
        fastify.post('/assinaturas/pix', quemPaga, AssinaturaController.pix)
        fastify.post('/assinaturas/pix/sincronizar', quemPaga, AssinaturaController.sincronizarPix)
        fastify.post('/assinaturas/cancelar', soAdmin, AssinaturaController.cancelar)
    })
}
