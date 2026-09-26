import { EmpresaController } from './empresa.controller.js'
import { authenticate } from '../shared/middlewares/auth.middleware.js'

export async function empresaRoutes(fastify) {

    fastify.register(async function (fastify) {

        fastify.addHook('preHandler', authenticate)

        fastify.get('/empresas', EmpresaController.getAllEmpresas)
        fastify.get('/empresas/:id', EmpresaController.getEmpresaById)
        fastify.post('/empresas', EmpresaController.createEmpresa)
        fastify.patch('/empresas/:id', EmpresaController.updateEmpresa)
        fastify.delete('/empresas/:id', EmpresaController.deleteEmpresa)
    })
}
