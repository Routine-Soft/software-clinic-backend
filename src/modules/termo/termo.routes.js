import { TermoController } from './termo.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function termoRoutes(fastify) {
    // Paciente, sem login: abre o link, lê e assina. A chave do link é o próprio token.
    fastify.get('/termos/publico/:token', TermoController.publico)
    fastify.post('/termos/publico/:token/assinar', TermoController.assinar)

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // A recepção é a auxiliar da dona: também escreve os modelos de termo.
        const equipe = { preHandler: authorize(['admin', 'profissional', 'recepcao', 'super_admin']) }

        fastify.get('/termos/modelos', equipe, TermoController.listarModelos)
        fastify.post('/termos/modelos', equipe, TermoController.criarModelo)
        fastify.patch('/termos/modelos/:id', equipe, TermoController.atualizarModelo)
        fastify.delete('/termos/modelos/:id', equipe, TermoController.excluirModelo)

        fastify.get('/termos', equipe, TermoController.listar)
        fastify.get('/termos/:id', equipe, TermoController.obter)
        fastify.post('/termos', equipe, TermoController.enviar)
        fastify.post('/termos/:id/cancelar', equipe, TermoController.cancelar)
    })
}
