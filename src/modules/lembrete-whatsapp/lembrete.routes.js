import { LembreteController } from './lembrete.controller.js'

export async function lembreteWhatsappRoutes(fastify) {

    // Públicas: quem chama é a Meta. O POST é protegido pela assinatura do corpo, por isso guarda o corpo cru.
    fastify.register(async function (fastify) {
        fastify.removeContentTypeParser('application/json')
        fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, corpo, done) => {
            req.rawBody = corpo
            try {
                done(null, corpo.length ? JSON.parse(corpo.toString('utf8')) : {})
            } catch (erro) {
                erro.statusCode = 400
                done(erro)
            }
        })

        fastify.get('/whatsapp/webhook', LembreteController.verificar)
        fastify.post('/whatsapp/webhook', LembreteController.receber)
    })
}
