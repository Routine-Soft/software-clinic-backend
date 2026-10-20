import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from '@fastify/cors'
import db from './src/db/db.js'
import { idiomaDaRequisicao, traduzirMensagem } from './src/modules/shared/utils/idioma.js'
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
import { reuniaoRoutes } from "./src/modules/reuniao/reuniao.routes.js";
import { indicacaoRoutes } from "./src/modules/indicacao/indicacao.routes.js";
import { afiliadoRoutes } from "./src/modules/afiliado/afiliado.routes.js";
import { prontuarioRoutes } from "./src/modules/prontuario/prontuario.routes.js";
import { listaEsperaRoutes } from "./src/modules/lista-espera/lista-espera.routes.js";
import { planoRoutes } from "./src/modules/plano/plano.routes.js";
import { assinaturaRoutes } from "./src/modules/assinatura/assinatura.routes.js";
import { printRoutes } from "./src/modules/print/print.routes.js";
import { comissaoRoutes } from "./src/modules/comissao/comissao.routes.js";
import { chamadaRoutes } from "./src/modules/chamada/chamada.routes.js";
import { painelTvRoutes } from "./src/modules/painel-tv/painel-tv.routes.js";
import { avaliacaoNeuropsicologicaRoutes } from "./src/modules/avaliacao-neuropsicologica/avaliacao-neuropsicologica.routes.js";
import { termoRoutes } from "./src/modules/termo/termo.routes.js";
import { anamneseRoutes } from "./src/modules/anamnese/anamnese.routes.js";
import { lembreteWhatsappRoutes } from "./src/modules/lembrete-whatsapp/lembrete.routes.js";
import { iniciarLembretesWhatsapp } from "./src/modules/lembrete-whatsapp/lembrete.agendador.js";
import { AcompanhamentoService } from "./src/modules/paciente/acompanhamento.service.js";

const fastify = Fastify({ logger: true })

await fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
})

// Avisos e erros no idioma do site (Accept-Language): troca o campo "message" das respostas em JSON.
fastify.addHook('onSend', async (req, reply, payload) => {
  if (idiomaDaRequisicao(req) !== 'en' || typeof payload !== 'string' || !payload.includes('"message"')) return payload
  if (!String(reply.getHeader('content-type') ?? '').includes('application/json')) return payload
  try {
    const corpo = JSON.parse(payload)
    if (typeof corpo?.message !== 'string') return payload
    corpo.message = traduzirMensagem(corpo.message, 'en')
    return JSON.stringify(corpo)
  } catch {
    return payload
  }
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
await fastify.register(reuniaoRoutes, { prefix: '/api' })
await fastify.register(indicacaoRoutes, { prefix: '/api' })
await fastify.register(afiliadoRoutes, { prefix: '/api' })
await fastify.register(prontuarioRoutes, { prefix: '/api' })
await fastify.register(listaEsperaRoutes, { prefix: '/api' })
await fastify.register(planoRoutes, { prefix: '/api' })
await fastify.register(assinaturaRoutes, { prefix: '/api' })
await fastify.register(printRoutes, { prefix: '/api' })
await fastify.register(comissaoRoutes, { prefix: '/api' })
await fastify.register(avaliacaoNeuropsicologicaRoutes, { prefix: '/api' })
await fastify.register(chamadaRoutes, { prefix: '/api' })
await fastify.register(painelTvRoutes, { prefix: '/api' })
await fastify.register(lembreteWhatsappRoutes, { prefix: '/api' })
await fastify.register(termoRoutes, { prefix: '/api' })
await fastify.register(anamneseRoutes, { prefix: '/api' })

const start = async () => {
  try {
    await db()

    await fastify.listen({ port: process.env.PORT || 8080, host: '0.0.0.0' })
    console.log(`🚀 Servidor rodando na porta ${process.env.PORT || 8080}`)
    iniciarLembretesWhatsapp(fastify.log)
    // Pacientes de antes do "profissionais que acompanham": monta a lista pelas consultas (uma vez só).
    // Só no servidor: o ambiente de desenvolvimento usa o mesmo banco e não deve mexer nos dados reais.
    if (process.env.NODE_ENV === 'production') {
      AcompanhamentoService.preencherPacientesAntigos()
        .then((n) => { if (n > 0) fastify.log.info(`Acompanhamentos montados para ${n} paciente(s) antigos`) })
        .catch((erro) => fastify.log.error(erro, 'Falha ao montar os acompanhamentos dos pacientes antigos'))
    }
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()