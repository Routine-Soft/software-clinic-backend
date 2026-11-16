import { WhatsappController } from './whatsapp.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva, exigirRecurso } from '../shared/middlewares/assinatura.middleware.js'

// WhatsApp da clínica (lembretes de consulta). Admin e recepção configuram; o plano Grátis só vê a situação.
export async function whatsappRoutes(fastify) {
    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)
        fastify.addHook('preHandler', authorize(['admin', 'recepcao']))
        fastify.addHook('preHandler', exigirRecurso('whatsapp'))

        fastify.get('/whatsapp', WhatsappController.situacao)
        fastify.post('/whatsapp/conectar', WhatsappController.conectar)
        fastify.post('/whatsapp/desconectar', WhatsappController.desconectar)
        fastify.patch('/whatsapp', WhatsappController.atualizar)
        fastify.post('/whatsapp/teste', WhatsappController.enviarTeste)
    })
}
