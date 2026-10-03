import { AvaliacaoNeuropsicologicaService } from './avaliacao-neuropsicologica.service.js'

const contexto = (req) => ({ usuario: req.user, ip: req.ip })

export const AvaliacaoNeuropsicologicaController = {
    async listar(req, reply) {
        return reply.send({ data: await AvaliacaoNeuropsicologicaService.findAll(contexto(req)) })
    },

    async buscar(req, reply) {
        return reply.send({ data: await AvaliacaoNeuropsicologicaService.findById(contexto(req), req.params.id) })
    },

    async criar(req, reply) {
        const avaliacao = await AvaliacaoNeuropsicologicaService.create(contexto(req), req.body)
        return reply.code(201).send({ data: avaliacao, message: 'Avaliação iniciada' })
    },

    async atualizar(req, reply) {
        const avaliacao = await AvaliacaoNeuropsicologicaService.update(contexto(req), req.params.id, req.body)
        return reply.send({ data: avaliacao, message: 'Avaliação salva' })
    },

    async finalizar(req, reply) {
        const avaliacao = await AvaliacaoNeuropsicologicaService.finalizar(contexto(req), req.params.id, req.body)
        return reply.send({ data: avaliacao, message: 'Avaliação finalizada' })
    },

    async remover(req, reply) {
        await AvaliacaoNeuropsicologicaService.remove(contexto(req), req.params.id)
        return reply.send({ data: null, message: 'Avaliação excluída' })
    },
}
