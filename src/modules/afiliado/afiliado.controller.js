import { AfiliadoService } from './afiliado.service.js'

const formatarReais = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const AfiliadoController = {
    async criar(req, reply) {
        const afiliado = await AfiliadoService.criar(req.body)
        return reply.code(201).send({ data: afiliado, message: 'Conta de afiliado criada com sucesso' })
    },

    async ativar(req, reply) {
        const usuario = await AfiliadoService.ativar(req.user.id, req.body)
        return reply.send({ data: usuario, message: 'Pronto! Agora você também é afiliado da Sonelia' })
    },

    async excluir(req, reply) {
        const { contaApagada } = await AfiliadoService.excluir(req.params.id)
        return reply.send({
            data: null,
            message: contaApagada ? 'Afiliado excluído do banco de dados' : 'Removido do programa de afiliados (a conta na clínica continua)',
        })
    },

    async painel(req, reply) {
        const painel = await AfiliadoService.painel(req.user.id)
        return reply.send({ data: painel })
    },

    async listar(req, reply) {
        const afiliados = await AfiliadoService.listar()
        return reply.send({ data: afiliados })
    },

    async registrarPagamento(req, reply) {
        const { quantidade, total } = await AfiliadoService.registrarPagamento(req.params.id)
        const comissoes = quantidade === 1 ? '1 comissão marcada' : `${quantidade} comissões marcadas`
        return reply.send({ data: { quantidade, total }, message: `${comissoes} como paga (${formatarReais(total)})` })
    },

    async definirAtivo(req, reply) {
        const afiliado = await AfiliadoService.definirAtivo(req.params.id, req.body?.ativo)
        return reply.send({ data: afiliado, message: afiliado.afiliadoAtivo ? 'Afiliado reativado' : 'Afiliado desativado: o código dele não vale mais para novos cadastros' })
    },
}
