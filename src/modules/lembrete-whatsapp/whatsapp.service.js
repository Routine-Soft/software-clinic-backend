import AppError from '../../errors/AppError.js'
import UserModel from '../user/user.model.js'
import WhatsappModel, { TEXTO_PADRAO } from './whatsapp.model.js'
import { Evolution, evolutionConfigurada, telefoneWhatsapp } from './evolution.client.js'
import { montarTexto } from './lembrete.texto.js'
import { enviadosNoMes } from './lembrete.service.js'

// Nome da conexão da clínica na Evolution.
const instanciaDa = (tenantId) => `sonelia-${tenantId}`

async function configDa(tenantId) {
    return await WhatsappModel.findOne({ tenantId })
        ?? await WhatsappModel.create({ tenantId, instancia: instanciaDa(tenantId) })
}

// Quando a conexão abre, guarda o número e o nome do perfil (aparecem na tela).
async function registrarConexao(config) {
    if (config.conectadoEm && config.numero) return config
    const { numero, nome } = await Evolution.perfil(config.instancia)
    config.numero = numero
    config.nomePerfil = nome
    config.conectadoEm = new Date()
    return await config.save()
}

// `limiteMes`: lembretes por mês do plano (null = sem limite); `enviadosMes`: quantos já saíram neste mês.
function paraDTO(config, estado, qrcode = null, limiteMes = null) {
    return {
        disponivel: evolutionConfigurada(),
        conectado: estado === 'open',
        estado: estado ?? 'desconectado',
        numero: estado === 'open' ? config.numero : null,
        nomePerfil: estado === 'open' ? config.nomePerfil : null,
        ativo: config.ativo,
        texto: config.texto,
        textoPadrao: TEXTO_PADRAO,
        qrcode,
        limiteMes,
        enviadosMes: enviadosNoMes(config),
    }
}

export const WhatsappService = {
    async situacao(tenantId, limiteMes = null) {
        const config = await configDa(tenantId)
        if (!evolutionConfigurada()) return paraDTO(config, null, null, limiteMes)
        const estado = await Evolution.estado(config.instancia)
        if (estado === 'open') await registrarConexao(config)
        return paraDTO(config, estado, null, limiteMes)
    },

    // Começa (ou continua) a conexão e devolve o QR Code para o celular da clínica ler.
    // Chamada de novo a cada poucos segundos pela tela: o QR Code muda sozinho até alguém ler.
    async conectar(tenantId) {
        const config = await configDa(tenantId)
        let estado = await Evolution.estado(config.instancia)
        if (estado === 'open') return paraDTO(await registrarConexao(config), estado)
        if (estado === null) {
            await Evolution.criar(config.instancia)
            estado = 'connecting'
        }
        const qrcode = await Evolution.qrCode(config.instancia)
        return paraDTO(config, estado === 'close' ? 'connecting' : estado, qrcode)
    },

    async desconectar(tenantId) {
        const config = await configDa(tenantId)
        await Evolution.apagar(config.instancia)
        config.numero = null
        config.nomePerfil = null
        config.conectadoEm = null
        await config.save()
        return paraDTO(config, null)
    },

    async atualizar(tenantId, body, limiteMes = null) {
        const config = await configDa(tenantId)
        if (typeof body?.ativo === 'boolean') config.ativo = body.ativo
        if (typeof body?.texto === 'string') {
            const texto = body.texto.trim()
            if (!texto) throw new AppError('Escreva o texto do lembrete', 400)
            if (texto.length > 1000) throw new AppError('O texto do lembrete pode ter no máximo 1000 caracteres', 400)
            config.texto = texto
        }
        await config.save()
        return await this.situacao(tenantId, limiteMes)
    },

    // Mensagem de teste para um número escolhido, com dados de exemplo no texto.
    async enviarTeste(tenantId, telefone) {
        const config = await configDa(tenantId)
        if ((await Evolution.estado(config.instancia)) !== 'open') {
            throw new AppError('Conecte o WhatsApp da clínica antes de enviar o teste', 400)
        }
        const numero = telefoneWhatsapp(telefone)
        if (!numero) throw new AppError('Telefone inválido. Use DDD + número (ou + e o código do país).', 400)
        const clinica = await UserModel.findById(tenantId, 'nomeEmpresa').lean()
        const texto = montarTexto(config.texto, {
            paciente: 'Maria',
            clinica: clinica?.nomeEmpresa ?? '',
            data: 'amanhã',
            hora: '14:00',
            profissional: 'Dra. Ana',
        })
        try {
            await Evolution.enviarTexto(config.instancia, numero, `${texto}\n\n(teste da Sonelia)`)
        } catch (erro) {
            throw new AppError(erro.message, 400)
        }
    },
}
