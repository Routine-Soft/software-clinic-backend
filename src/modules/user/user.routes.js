import { UserController } from './user.controller.js'
import { ClinicaAdminController } from './clinica-admin.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function userRoutes(fastify) {

    // rotas públicas
    fastify.post('/users', UserController.createUser)
    fastify.post('/users/login', UserController.loginUser)
    fastify.post('/users/google', UserController.entrarComGoogle)
    fastify.post('/users/refresh', UserController.refreshToken)

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        // rotas protegidas
        fastify.get('/users',
            {
                preHandler: authorize(['super_admin'])
            }, UserController.getAllUsers)

        // Painel do super_admin: gestão das clínicas (cada uma é um usuário "admin") e suas assinaturas.
        const soSuperAdmin = { preHandler: authorize(['super_admin']) }
        fastify.get('/users/admins/resumo', soSuperAdmin, ClinicaAdminController.resumo)
        fastify.get('/users/admins/receita', soSuperAdmin, ClinicaAdminController.receita)
        fastify.get('/users/admins', soSuperAdmin, ClinicaAdminController.listar)
        fastify.post('/users/admins', soSuperAdmin, ClinicaAdminController.criar)
        fastify.patch('/users/admins/:id', soSuperAdmin, ClinicaAdminController.editar)
        fastify.delete('/users/admins/:id', soSuperAdmin, ClinicaAdminController.apagar)
        fastify.patch('/users/admins/:id/plano', soSuperAdmin, ClinicaAdminController.trocarPlano)
        fastify.patch('/users/admins/:id/estender-teste', soSuperAdmin, ClinicaAdminController.estenderTeste)
        fastify.patch('/users/admins/:id/senha', soSuperAdmin, ClinicaAdminController.redefinirSenha)
        fastify.patch('/users/admins/:id/acesso', soSuperAdmin, ClinicaAdminController.definirRevogacao)
        fastify.get('/users/tenant',
            {
                preHandler: authorize(['admin', 'super_admin', 'recepcao'])
            }, UserController.getUsersDaClinica)
        fastify.post('/users/tenant',
            {
                preHandler: authorize(['admin', 'super_admin', 'recepcao'])
            }, UserController.createUsuarioDaClinica)
        fastify.patch('/users/tenant/:id',
            {
                preHandler: authorize(['admin', 'super_admin', 'recepcao'])
            }, UserController.updateUsuarioDaClinica)
        fastify.patch('/users/tenant/:id/senha',
            {
                preHandler: authorize(['admin', 'super_admin', 'recepcao'])
            }, UserController.resetPasswordUsuarioDaClinica)
        fastify.delete('/users/tenant/:id',
            {
                preHandler: authorize(['admin', 'super_admin', 'recepcao'])
            }, UserController.deleteUsuarioDaClinica)
        fastify.get('/users/me', UserController.getMe)
        fastify.patch('/users/me', UserController.updateMe)
        fastify.post('/users/me/password', UserController.updateMyPassword)
        fastify.get('/users/:id', UserController.getUserById)
        fastify.patch('/users/:id', UserController.updateUser)
        fastify.post('/users/:id/password', UserController.updatePassword)
        fastify.delete('/users/:id', {
                preHandler: authorize(['super_admin'])
            }, UserController.deleteUser)
        fastify.post('/users/logout', UserController.logoutUser)
    })
}