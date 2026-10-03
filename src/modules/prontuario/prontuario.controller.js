import { ProntuarioService } from './prontuario.service.js'

const contexto = (req) => ({ usuario: req.user, ip: req.ip })

export const ProntuarioController = {
    async acesso(req, reply) {
        return reply.send({ data: await ProntuarioService.acesso(contexto(req)) })
    },

    async getAllProntuarios(req, reply) {
        const { pacienteId } = req.query
        const { prontuarios, perfilClinico } = await ProntuarioService.findAll(contexto(req), { pacienteId })
        return reply.send({ data: prontuarios, perfilClinico })
    },

    async getProntuarioById(req, reply) {
        const prontuario = await ProntuarioService.findById(contexto(req), req.params.id)
        return reply.send({ data: prontuario })
    },

    async createProntuario(req, reply) {
        const prontuario = await ProntuarioService.createProntuario(contexto(req), req.body)
        return reply.code(201).send({ data: prontuario, message: 'Atendimento iniciado' })
    },

    async updateProntuario(req, reply) {
        const prontuario = await ProntuarioService.updateProntuario(contexto(req), req.params.id, req.body)
        return reply.send({ data: prontuario, message: 'Rascunho salvo' })
    },

    async finalizarAtendimento(req, reply) {
        const prontuario = await ProntuarioService.finalizarAtendimento(contexto(req), req.params.id, req.body)
        return reply.send({ data: prontuario, message: 'Atendimento finalizado com sucesso' })
    },

    async compartilhar(req, reply) {
        const prontuario = await ProntuarioService.compartilhar(contexto(req), req.params.id, req.body)
        return reply.send({ data: prontuario, message: 'Acesso ao atendimento atualizado' })
    },

    async adicionarAdendo(req, reply) {
        const prontuario = await ProntuarioService.adicionarAdendo(contexto(req), req.params.id, req.body)
        return reply.code(201).send({ data: prontuario, message: 'Adendo registrado' })
    },

    async atualizarPerfilClinico(req, reply) {
        const perfil = await ProntuarioService.atualizarPerfilClinico(contexto(req), req.params.pacienteId, req.body)
        return reply.send({ data: perfil, message: 'Perfil clínico salvo' })
    },
}
