import { TermoService } from './termo.service.js'

// Atrás do Caddy, o IP de quem assinou vem no X-Forwarded-For.
function ipDaRequisicao(req) {
    const encaminhado = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
    return encaminhado || req.ip
}

export const TermoController = {
    async listarModelos(req, reply) {
        const modelos = await TermoService.listarModelos(req.user.tenantId)
        return reply.send({ data: modelos })
    },

    async criarModelo(req, reply) {
        const modelo = await TermoService.criarModelo(req.user.tenantId, req.body)
        return reply.code(201).send({ data: modelo, message: 'Modelo de termo criado com sucesso' })
    },

    async atualizarModelo(req, reply) {
        const modelo = await TermoService.atualizarModelo(req.user.tenantId, req.params.id, req.body)
        return reply.send({ data: modelo, message: 'Modelo de termo atualizado com sucesso' })
    },

    async excluirModelo(req, reply) {
        await TermoService.excluirModelo(req.user.tenantId, req.params.id)
        return reply.send({ data: null, message: 'Modelo de termo excluído' })
    },

    async listar(req, reply) {
        const termos = await TermoService.listar(req.user.tenantId, req.query ?? {})
        return reply.send({ data: termos })
    },

    async obter(req, reply) {
        const termo = await TermoService.obter(req.user.tenantId, req.params.id)
        return reply.send({ data: termo })
    },

    async enviar(req, reply) {
        const termo = await TermoService.enviar(req.user.tenantId, req.user.id, req.body)
        return reply.code(201).send({ data: termo, message: 'Termo criado. Envie o link para o paciente assinar.' })
    },

    async cancelar(req, reply) {
        await TermoService.cancelar(req.user.tenantId, req.params.id)
        return reply.send({ data: null, message: 'Termo cancelado: o link não vale mais' })
    },

    async publico(req, reply) {
        const termo = await TermoService.publico(req.params.token)
        return reply.send({ data: termo })
    },

    async assinar(req, reply) {
        const termo = await TermoService.assinar(req.params.token, req.body, {
            ip: ipDaRequisicao(req),
            aparelho: req.headers['user-agent'],
        })
        return reply.send({ data: termo, message: 'Termo assinado com sucesso' })
    },
}
