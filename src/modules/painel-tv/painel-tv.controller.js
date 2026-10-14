import { PainelTvService } from './painel-tv.service.js'

export const PainelTvController = {
    async iniciarPareamento(req, reply) {
        const pareamento = await PainelTvService.iniciarPareamento()
        return reply.code(201).send({ data: pareamento })
    },

    async situacaoDoPareamento(req, reply) {
        const situacao = await PainelTvService.situacaoDoPareamento(req.body?.segredo)
        return reply.send({ data: situacao })
    },

    async telaDaTv(req, reply) {
        const tela = await PainelTvService.telaDaTv(req.painel)
        return reply.send({ data: tela })
    },

    async listar(req, reply) {
        const paineis = await PainelTvService.listar(req.user.tenantId)
        return reply.send({ data: paineis })
    },

    async conectar(req, reply) {
        const painel = await PainelTvService.conectar(req.user.tenantId, req.user.id, req.body ?? {})
        return reply.code(201).send({ data: painel, message: 'TV conectada. Em alguns segundos ela mostra o painel.' })
    },

    async renomear(req, reply) {
        const painel = await PainelTvService.renomear(req.user.tenantId, req.params.id, req.body?.nome)
        return reply.send({ data: painel, message: 'Nome da TV atualizado' })
    },

    async desconectar(req, reply) {
        await PainelTvService.desconectar(req.user.tenantId, req.params.id)
        return reply.send({ data: null, message: 'TV desconectada' })
    },
}
