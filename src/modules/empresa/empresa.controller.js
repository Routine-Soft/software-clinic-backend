import { EmpresaService } from './empresa.service.js'

export const EmpresaController = {
    async getAllEmpresas(req, reply) {
        const { tenantId } = req.user
        const empresas = await EmpresaService.findAll(tenantId)
        return reply.send({ data: empresas })
    },

    async getEmpresaById(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const empresa = await EmpresaService.findById(id, tenantId)
        return reply.send({ data: empresa })
    },

    async createEmpresa(req, reply) {
        const { tenantId } = req.user
        const empresa = await EmpresaService.createEmpresa(req.body, tenantId)
        return reply.code(201).send({ data: empresa, message: 'Empresa cadastrada com sucesso' })
    },

    async updateEmpresa(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        const empresa = await EmpresaService.updateEmpresa(id, tenantId, req.body)
        return reply.send({ data: empresa, message: 'Empresa atualizada com sucesso' })
    },

    async deleteEmpresa(req, reply) {
        const { id } = req.params
        const { tenantId } = req.user
        await EmpresaService.deleteEmpresa(id, tenantId)
        return reply.send({ data: null, message: 'Empresa removida com sucesso' })
    },
}
