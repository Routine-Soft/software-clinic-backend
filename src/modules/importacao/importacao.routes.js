import { ImportacaoController } from './importacao.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

// Importação de planilhas de outro sistema. Quem pode cada tipo é decidido no serviço (prontuário: só profissional de saúde).
export async function importacaoRoutes(fastify) {
    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // Até 500 linhas por vez; prontuários têm textos longos, por isso o limite maior que o padrão (1 MB).
        fastify.post('/importacao/:tipo', { bodyLimit: 15 * 1024 * 1024 }, ImportacaoController.importar)
    })
}
