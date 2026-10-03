import { ProntuarioController } from './prontuario.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function prontuarioRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // Quem pode ler e alterar é decidido no serviço (prontuario.acesso.js), não pelo perfil do login.
        // Não há rota de exclusão: o prontuário deve ser guardado por no mínimo 20 anos (Lei 13.787/2018).
        fastify.get('/prontuarios/acesso', ProntuarioController.acesso)
        fastify.get('/prontuarios', ProntuarioController.getAllProntuarios)
        fastify.get('/prontuarios/:id', ProntuarioController.getProntuarioById)
        fastify.post('/prontuarios', ProntuarioController.createProntuario)
        fastify.patch('/prontuarios/:id', ProntuarioController.updateProntuario)
        fastify.patch('/prontuarios/:id/finalizar', ProntuarioController.finalizarAtendimento)
        fastify.post('/prontuarios/:id/adendos', ProntuarioController.adicionarAdendo)
        fastify.patch('/prontuarios/:id/compartilhamento', ProntuarioController.compartilhar)
        fastify.patch('/prontuarios/perfil/:pacienteId', ProntuarioController.atualizarPerfilClinico)
    })
}
