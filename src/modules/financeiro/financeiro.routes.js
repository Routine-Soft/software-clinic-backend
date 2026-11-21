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
        fastify.post('/financeiro/despesas', FinanceiroController.criarDespesa)
        fastify.patch('/financeiro/despesas/:id', FinanceiroController.atualizarDespesa)
        fastify.patch('/financeiro/despesas/:id/pagamento', FinanceiroController.pagarDespesa)
        fastify.delete('/financeiro/despesas/:id', FinanceiroController.excluirDespesa)
    })
}
