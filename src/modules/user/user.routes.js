import { UserController } from './user.controller.js'
import { authenticate, authorize } from '../shared/middlewares/auth.middleware.js'

export async function userRoutes(fastify) {

    // rotas públicas
    fastify.post('/users', UserController.createUser)
    fastify.post('/users/login', UserController.loginUser)
    fastify.post('/users/refresh', UserController.refreshToken)

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        // rotas protegidas
        fastify.get('/users',
            {
                preHandler: authorize(['super_admin'])
            }, UserController.getAllUsers)
        fastify.get('/users/tenant',
            {
                preHandler: authorize(['admin', 'super_admin'])
            }, UserController.getUsersDaClinica)
        fastify.post('/users/tenant',
            {
                preHandler: authorize(['admin', 'super_admin'])
            }, UserController.createUsuarioDaClinica)
        fastify.patch('/users/tenant/:id',
            {
                preHandler: authorize(['admin', 'super_admin'])
            }, UserController.updateUsuarioDaClinica)
        fastify.patch('/users/tenant/:id/senha',
            {
                preHandler: authorize(['admin', 'super_admin'])
            }, UserController.resetPasswordUsuarioDaClinica)
        fastify.delete('/users/tenant/:id',
            {
                preHandler: authorize(['admin', 'super_admin'])
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