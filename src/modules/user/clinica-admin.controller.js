import { ClinicaAdminService } from './clinica-admin.service.js'
import { avaliarAcesso } from '../assinatura/assinatura.service.js'

function comAcesso(assinatura) {
    return { ...assinatura.toJSON(), acesso: avaliarAcesso(assinatura) }
}

export const ClinicaAdminController = {
    async resumo(req, reply) {
        const resumo = await ClinicaAdminService.obterResumo()
        return reply.send({ data: resumo })
    },

    async receita(req, reply) {
        const receita = await ClinicaAdminService.obterReceita(req.query?.periodo)
        return reply.send({ data: receita })
    },

    async listar(req, reply) {
        const admins = await ClinicaAdminService.listar(req.query?.busca)
        return reply.send({ data: admins })
    },

    async criar(req, reply) {
        const admin = await ClinicaAdminService.criar(req.body)
        return reply.code(201).send({ data: admin, message: 'Administrador cadastrado com sucesso' })
    },

    async editar(req, reply) {
        const admin = await ClinicaAdminService.editar(req.params.id, req.body)
        return reply.send({ data: admin, message: 'Administrador atualizado com sucesso' })
    },

    async apagar(req, reply) {
        await ClinicaAdminService.apagar(req.params.id)
        return reply.send({ data: null, message: 'Administrador removido com sucesso' })
    },

    async trocarPlano(req, reply) {
        const assinatura = await ClinicaAdminService.trocarPlano(req.params.id, req.body?.planoId)
        return reply.send({ data: comAcesso(assinatura), message: 'Plano atualizado com sucesso' })
    },

    async redefinirSenha(req, reply) {
        await ClinicaAdminService.redefinirSenha(req.params.id, req.body?.novaSenha)
        return reply.send({ data: null, message: 'Senha redefinida. Passe a nova senha ao administrador da clínica.' })
    },

    async estenderTeste(req, reply) {
        const assinatura = await ClinicaAdminService.estenderTeste(req.params.id)
        return reply.send({ data: comAcesso(assinatura), message: 'Teste estendido por mais 3 dias' })
    },

    async definirRevogacao(req, reply) {
        const assinatura = await ClinicaAdminService.definirRevogacao(req.params.id, req.body?.revogado)
        return reply.send({
            data: comAcesso(assinatura),
            message: req.body?.revogado ? 'Acesso revogado' : 'Acesso restabelecido',
        })
    },
}
