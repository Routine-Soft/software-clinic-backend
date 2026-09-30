import { UserService } from './user.service.js'

export const UserController = {
    async getAllUsers(req, reply) {
        const users = await UserService.findAll()
        return reply.send({ data: users })
    },

    async getUsersDaClinica(req, reply) {
        const { tenantId } = req.user
        const users = await UserService.findAllByTenant(tenantId)
        return reply.send({ data: users })
    },

    async createUsuarioDaClinica(req, reply) {
        const { tenantId } = req.user
        const user = await UserService.createUsuarioDaClinica(tenantId, req.body)
        return reply.code(201).send({ data: user, message: 'Usuário criado com sucesso' })
    },

    async updateUsuarioDaClinica(req, reply) {
        const { tenantId } = req.user
        const { id } = req.params
        const user = await UserService.updateUsuarioDaClinica(tenantId, id, req.body)
        return reply.send({ data: user, message: 'Usuário atualizado com sucesso' })
    },

    async deleteUsuarioDaClinica(req, reply) {
        const { tenantId } = req.user
        const { id } = req.params
        await UserService.deleteUsuarioDaClinica(tenantId, id)
        return reply.send({ data: null, message: 'Usuário removido com sucesso' })
    },

    async resetPasswordUsuarioDaClinica(req, reply) {
        const { tenantId } = req.user
        const { id } = req.params
        const { novaSenha } = req.body
        await UserService.resetPasswordUsuarioDaClinica(tenantId, id, novaSenha)
        return reply.send({ data: null, message: 'Senha redefinida com sucesso' })
    },

    async getMe(req, reply) {
        const user = await UserService.findMe(req.user.id)
        return reply.send({ data: user })
    },

    async updateMe(req, reply) {
        const { id, tenantId, role } = req.user
        const user = await UserService.updateMe(id, tenantId, role, req.body)
        return reply.send({ data: user, message: 'Dados atualizados com sucesso' })
    },

    async updateMyPassword(req, reply) {
        await UserService.updateMyPassword(req.user.id, req.body, req.user.via)
        return reply.send({ data: null, message: 'Senha alterada com sucesso' })
    },

    async getUserById(req, reply) {
        const { id } = req.params
        const user = await UserService.findById(id)
        return reply.send({ data: user })
    },

    async createUser(req, reply) {
        const user = await UserService.createUser(req.body)
        return reply.code(201).send({ data: user, message: 'Usuário criado com sucesso' })
    },

    async updateUser(req, reply) {
        const { id } = req.params
        const user = await UserService.updateUser(id, req.body)
        return reply.send({ data: user, message: 'Usuário atualizado com sucesso' })
    },

    async deleteUser(req, reply) {
        const { id } = req.params
        await UserService.deleteUser(id)
        return reply.send({ data: null, message: 'Usuário removido com sucesso' })
    },

    async loginUser(req, reply) {
        const result = await UserService.loginUser(req.body)
        return reply.send({ data: result, message: 'Login realizado com sucesso' })
    },

    async entrarComGoogle(req, reply) {
        const result = await UserService.entrarComGoogle(req.body)
        return reply.send({ data: result, message: result.novoCadastro ? 'Complete o cadastro da clínica' : 'Login realizado com sucesso' })
    },

    async logoutUser(req, reply) {
        await UserService.logoutUser(req.user.id)
        return reply.send({ data: null, message: 'Logout realizado com sucesso' })
    },

    async refreshToken(req, reply) {
        const { refreshToken } = req.body
        const result = await UserService.refresh(refreshToken)
        return reply.send({ data: result, message: 'Token renovado com sucesso' })
    },

    async updatePassword(req, reply) {
        const { id } = req.params
        await UserService.updatePassword(id, req.body)
        return reply.send({ data: null, message: 'Senha atualizada com sucesso' })
    },
}