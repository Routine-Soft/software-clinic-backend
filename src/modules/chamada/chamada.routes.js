import { ChamadaController } from './chamada.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'
import { exigirAssinaturaAtiva } from '../shared/middlewares/assinatura.middleware.js'

export async function chamadaRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)
        fastify.addHook('preHandler', exigirAssinaturaAtiva)

        // Recepção e profissional chamam; o profissional, só os próprios pacientes (regra no service).
        const daClinica = { preHandler: authorize(['admin', 'recepcao', 'profissional', 'super_admin']) }
        fastify.get('/sala-de-espera', daClinica, ChamadaController.salaDeEspera)
        fastify.patch('/sala-de-espera/:id/chegada', daClinica, ChamadaController.definirChegada)
        fastify.post('/sala-de-espera/:id/chamar', daClinica, ChamadaController.chamar)
    })
}
