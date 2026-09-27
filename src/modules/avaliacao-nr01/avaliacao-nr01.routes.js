import { AvaliacaoNr01Controller } from './avaliacao-nr01.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function avaliacaoNr01Routes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        fastify.get('/avaliacoes-nr01', AvaliacaoNr01Controller.getAllAvaliacoes)
        fastify.get('/avaliacoes-nr01/:id', AvaliacaoNr01Controller.getAvaliacaoById)
        fastify.post('/avaliacoes-nr01', AvaliacaoNr01Controller.createAvaliacao)
        fastify.patch('/avaliacoes-nr01/:id', AvaliacaoNr01Controller.updateAvaliacao)
        fastify.delete('/avaliacoes-nr01/:id', AvaliacaoNr01Controller.deleteAvaliacao)
    })
}
