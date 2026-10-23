import { AnamneseController } from './anamnese.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function anamneseRoutes(fastify) {
    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // Modelos (só as perguntas, sem dado de paciente): a dona da clínica, a recepção (auxiliar dela) e quem atende
        // montam. As anamneses preenchidas continuam sigilosas: a recepção não lê nem preenche.
        const autores = { preHandler: authorize(['admin', 'profissional', 'recepcao', 'super_admin']) }
        fastify.get('/anamneses/modelos', autores, AnamneseController.listarModelos)
        fastify.get('/anamneses/modelos/:id', autores, AnamneseController.obterModelo)
        fastify.post('/anamneses/modelos', autores, AnamneseController.criarModelo)
        fastify.patch('/anamneses/modelos/:id', autores, AnamneseController.atualizarModelo)
        fastify.post('/anamneses/modelos/:id/duplicar', autores, AnamneseController.duplicarModelo)
        fastify.delete('/anamneses/modelos/:id', autores, AnamneseController.excluirModelo)

        // Anamneses do prontuário: o sigilo (cadastro de profissional, autor e especialidades) é decidido no serviço.
        fastify.get('/anamneses', AnamneseController.listar)
        fastify.get('/anamneses/:id', AnamneseController.obter)
        fastify.post('/anamneses', AnamneseController.criar)
        fastify.patch('/anamneses/:id', AnamneseController.atualizar)
    })
}
