import { AnamneseService } from './anamnese.service.js'

const contexto = (req) => ({ usuario: req.user, ip: req.ip })

export const AnamneseController = {
    async listarModelos(req, reply) {
        return reply.send({ data: await AnamneseService.listarModelos(req.user.tenantId) })
    },

    async obterModelo(req, reply) {
        return reply.send({ data: await AnamneseService.obterModelo(req.user.tenantId, req.params.id) })
    },

    async criarModelo(req, reply) {
        const modelo = await AnamneseService.criarModelo(req.user.tenantId, req.body)
        return reply.code(201).send({ data: modelo, message: 'Modelo de anamnese criado com sucesso' })
    },

    async atualizarModelo(req, reply) {
        const modelo = await AnamneseService.atualizarModelo(req.user.tenantId, req.params.id, req.body)
        return reply.send({ data: modelo, message: 'Modelo de anamnese salvo com sucesso' })
    },

    async duplicarModelo(req, reply) {
        const modelo = await AnamneseService.duplicarModelo(req.user.tenantId, req.params.id)
        return reply.code(201).send({ data: modelo, message: 'Cópia do modelo criada' })
    },

    async excluirModelo(req, reply) {
        await AnamneseService.excluirModelo(req.user.tenantId, req.params.id)
        return reply.send({ data: null, message: 'Modelo de anamnese excluído' })
    },

    async listar(req, reply) {
        return reply.send({ data: await AnamneseService.listar(contexto(req), req.query?.pacienteId) })
    },

    async obter(req, reply) {
        return reply.send({ data: await AnamneseService.obter(contexto(req), req.params.id) })
    },

    async criar(req, reply) {
        const anamnese = await AnamneseService.criar(contexto(req), req.body)
        return reply.code(201).send({ data: anamnese, message: 'Anamnese criada' })
    },

    async atualizar(req, reply) {
        const anamnese = await AnamneseService.atualizar(contexto(req), req.params.id, req.body)
        return reply.send({ data: anamnese, message: 'Anamnese salva' })
    },
}
