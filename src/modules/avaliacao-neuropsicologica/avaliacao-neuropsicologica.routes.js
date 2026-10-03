import { AvaliacaoNeuropsicologicaController } from './avaliacao-neuropsicologica.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function avaliacaoNeuropsicologicaRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // Quem pode ler e alterar é decidido no serviço, com as regras de sigilo do prontuário.
        fastify.get('/avaliacoes-neuropsicologicas', AvaliacaoNeuropsicologicaController.listar)
        fastify.get('/avaliacoes-neuropsicologicas/:id', AvaliacaoNeuropsicologicaController.buscar)
        fastify.post('/avaliacoes-neuropsicologicas', AvaliacaoNeuropsicologicaController.criar)
        fastify.patch('/avaliacoes-neuropsicologicas/:id', AvaliacaoNeuropsicologicaController.atualizar)
        fastify.patch('/avaliacoes-neuropsicologicas/:id/finalizar', AvaliacaoNeuropsicologicaController.finalizar)
        fastify.delete('/avaliacoes-neuropsicologicas/:id', AvaliacaoNeuropsicologicaController.remover)
    })
}
