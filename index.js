import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from '@fastify/cors'
import db from './src/db/db.js'
import { userRoutes } from "./src/modules/user/user.routes.js";
import { pacienteRoutes } from "./src/modules/paciente/paciente.routes.js";
import { especialidadeRoutes } from "./src/modules/especialidade/especialidade.routes.js";
import { profissionalRoutes } from "./src/modules/profissional/profissional.routes.js";
import { salaRoutes } from "./src/modules/sala/sala.routes.js";
import { convenioRoutes } from "./src/modules/convenio/convenio.routes.js";
import { empresaRoutes } from "./src/modules/empresa/empresa.routes.js";
import { avaliacaoNr01Routes } from "./src/modules/avaliacao-nr01/avaliacao-nr01.routes.js";
import { servicoRoutes } from "./src/modules/servico/servico.routes.js";
import { agendaRoutes } from "./src/modules/agenda/agenda.routes.js";
import { prontuarioRoutes } from "./src/modules/prontuario/prontuario.routes.js";
import { listaEsperaRoutes } from "./src/modules/lista-espera/lista-espera.routes.js";
import { planoRoutes } from "./src/modules/plano/plano.routes.js";
import { assinaturaRoutes } from "./src/modules/assinatura/assinatura.routes.js";
import { printRoutes } from "./src/modules/print/print.routes.js";
import { comissaoRoutes } from "./src/modules/comissao/comissao.routes.js";

const fastify = Fastify({ logger: true })

await fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)

  return reply.status(error.statusCode || 500).send({
    success: false,
    message: error.message || 'Erro interno do servidor',
    ...(error.codigo ? { code: error.codigo } : {})
  })
})

await fastify.register(userRoutes, { prefix: '/api' })
await fastify.register(pacienteRoutes, { prefix: '/api' })
await fastify.register(especialidadeRoutes, { prefix: '/api' })
await fastify.register(profissionalRoutes, { prefix: '/api' })
await fastify.register(salaRoutes, { prefix: '/api' })
await fastify.register(convenioRoutes, { prefix: '/api' })
await fastify.register(empresaRoutes, { prefix: '/api' })
await fastify.register(avaliacaoNr01Routes, { prefix: '/api' })
await fastify.register(servicoRoutes, { prefix: '/api' })
await fastify.register(agendaRoutes, { prefix: '/api' })
await fastify.register(prontuarioRoutes, { prefix: '/api' })
await fastify.register(listaEsperaRoutes, { prefix: '/api' })
await fastify.register(planoRoutes, { prefix: '/api' })
await fastify.register(assinaturaRoutes, { prefix: '/api' })
await fastify.register(printRoutes, { prefix: '/api' })
await fastify.register(comissaoRoutes, { prefix: '/api' })

const start = async () => {
  try {
    await db()

    await fastify.listen({ port: process.env.PORT || 8080, host: '0.0.0.0' })
    console.log(`🚀 Servidor rodando na porta ${process.env.PORT || 8080}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()