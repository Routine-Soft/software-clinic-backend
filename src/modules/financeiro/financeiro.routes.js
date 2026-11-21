import { FinanceiroController } from './financeiro.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

// Financeiro da clínica: livre em todos os planos (os repasses, dentro dele, continuam sendo do Pro, em /comissoes).
// Só a dona vê: a recepção não entra (decisão do Stanley em 2026-11-21).
export async function financeiroRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)
        fastify.addHook('preHandler', authorize(['admin', 'super_admin']))

        fastify.get('/financeiro', FinanceiroController.painel)

        fastify.post('/financeiro/lancamentos', FinanceiroController.criarLancamento)
        fastify.patch('/financeiro/lancamentos/:id', FinanceiroController.atualizarLancamento)
        fastify.patch('/financeiro/lancamentos/:id/pagamento', FinanceiroController.pagarLancamento)
        fastify.delete('/financeiro/lancamentos/:id', FinanceiroController.excluirLancamento)

        fastify.patch('/financeiro/atendimentos/:id', FinanceiroController.editarAtendimento)
        fastify.delete('/financeiro/atendimentos/:id', FinanceiroController.excluirAtendimento)
        fastify.delete('/financeiro/repasses/:id', FinanceiroController.desfazerRepasse)
    })
}
