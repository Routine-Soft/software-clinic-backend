import { AfiliadoController } from './afiliado.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function afiliadoRoutes(fastify) {
    // Cadastro público ("Seja afiliado").
    fastify.post('/afiliados', AfiliadoController.criar)

    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)

        // Qualquer pessoa logada pode virar afiliada; o painel confere se ela já é.
        fastify.post('/afiliados/ativar', AfiliadoController.ativar)
        fastify.get('/afiliados/painel', AfiliadoController.painel)

        const soSuperAdmin = { preHandler: authorize(['super_admin']) }
        fastify.get('/afiliados', soSuperAdmin, AfiliadoController.listar)
        fastify.post('/afiliados/:id/pagamentos', soSuperAdmin, AfiliadoController.registrarPagamento)
        fastify.patch('/afiliados/:id/ativo', soSuperAdmin, AfiliadoController.definirAtivo)
        fastify.delete('/afiliados/:id', soSuperAdmin, AfiliadoController.excluir)
    })
}
