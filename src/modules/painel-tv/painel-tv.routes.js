import { PainelTvController } from './painel-tv.controller.js'
import { autenticarPainel } from './painel-tv.middleware.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function painelTvRoutes(fastify) {
    // A TV, sem login: pede o código, espera a clínica confirmar e depois lê as chamadas com a chave dela.
    fastify.post('/painel-tv/pareamento', PainelTvController.iniciarPareamento)
    fastify.post('/painel-tv/pareamento/situacao', PainelTvController.situacaoDoPareamento)
    fastify.get('/painel-tv/tela', { preHandler: autenticarPainel }, PainelTvController.telaDaTv)

    // A clínica conecta, renomeia e desconecta as TVs.
    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        const gerencia = { preHandler: authorize(['admin', 'recepcao', 'super_admin']) }
        fastify.get('/paineis-tv', gerencia, PainelTvController.listar)
        fastify.post('/paineis-tv', gerencia, PainelTvController.conectar)
        fastify.patch('/paineis-tv/:id', gerencia, PainelTvController.renomear)
        fastify.delete('/paineis-tv/:id', gerencia, PainelTvController.desconectar)
    })
}
