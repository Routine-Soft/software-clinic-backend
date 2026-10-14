import { ChamadaService } from './chamada.service.js'

export const ChamadaController = {
    async salaDeEspera(req, reply) {
        const agendas = await ChamadaService.salaDeEspera(req.user)
        return reply.send({ data: agendas })
    },

    async definirChegada(req, reply) {
        const chegou = req.body?.chegou !== false
        const agenda = await ChamadaService.definirChegada(req.params.id, req.user, chegou)
        return reply.send({ data: agenda, message: chegou ? 'Chegada registrada' : 'Chegada desfeita' })
    },

    async chamar(req, reply) {
        const agenda = await ChamadaService.chamar(req.params.id, req.user)
        return reply.send({ data: agenda, message: 'Paciente chamado na TV' })
    },
}
