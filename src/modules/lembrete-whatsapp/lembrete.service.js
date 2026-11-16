import AgendaModel from '../agenda/agenda.model.js'
import UserModel from '../user/user.model.js'
import { AssinaturaService } from '../assinatura/assinatura.service.js'
import { idiomaDoPais } from '../assinatura/assinatura.emails.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import WhatsappModel from './whatsapp.model.js'
import { Evolution, evolutionConfigurada, telefoneWhatsapp } from './evolution.client.js'
import { montarTexto } from './lembrete.texto.js'

// Lembrete de consulta pelo WhatsApp da própria clínica:
//  - sai 24 horas antes da consulta, só entre 8h e 20h (Brasília); se as 24h caem de madrugada, sai às 8h;
//  - consulta marcada em cima da hora (menos de 2 horas) não recebe;
//  - só para paciente que aceita lembretes no WhatsApp, em clínica com plano que inclui o recurso,
//    WhatsApp conectado e lembretes ligados;
//  - no plano Grátis, até 10 por mês (`limites.lembretesMes`); passou disso, as consultas ficam sem lembrete;
//  - uma pausa de alguns segundos entre as mensagens, para o WhatsApp não tratar a clínica como robô.
const HORA_INICIO = 8
const HORA_FIM = 20
const ANTECEDENCIA_MS = 24 * 60 * 60 * 1000
const MINIMO_MS = 2 * 60 * 60 * 1000
const LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-419' }

const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms))
const pausaEntreMensagens = () => pausa(8000 + Math.random() * 12000)

function horaEmBrasilia(agora) {
    return Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }))
}

// Início da consulta: o dia é "dia puro" (meia-noite UTC) e a hora é de Brasília.
export function inicioDaConsulta(agenda) {
    const dia = new Date(agenda.data).toISOString().slice(0, 10)
    const hora = /^\d{2}:\d{2}$/.test(agenda.horaInicio ?? '') ? agenda.horaInicio : '00:00'
    return new Date(`${dia}T${hora}:00-03:00`)
}

export function horaDeEnviar(agenda, agora = new Date()) {
    const falta = inicioDaConsulta(agenda) - agora
    return falta <= ANTECEDENCIA_MS && falta >= MINIMO_MS
}

// "2026-11": o mês de Brasília, que conta os lembretes do plano Grátis.
export function mesEmBrasilia(agora = new Date()) {
    return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
}

export function enviadosNoMes(config, mes = mesEmBrasilia()) {
    return config?.usoMes?.mes === mes ? config.usoMes.enviados ?? 0 : 0
}

// Soma um lembrete ao mês (o contador volta a 1 quando o mês muda).
function contarNoMes(config, mes) {
    return WhatsappModel.updateOne({ _id: config._id }, [{
        $set: {
            'usoMes.enviados': { $cond: [{ $eq: ['$usoMes.mes', mes] }, { $add: [{ $ifNull: ['$usoMes.enviados', 0] }, 1] }, 1] },
            'usoMes.mes': mes,
        },
    }])
}

function primeiroNome(nome) {
    return String(nome ?? '').trim().split(/\s+/)[0] ?? ''
}

// "terça-feira, 17/11" (no idioma do país da clínica).
function dataPorExtenso(data, locale) {
    return new Date(data).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' })
}

async function enviarLembrete(agenda, config, clinica, locale) {
    // Reserva antes de enviar: duas rodadas ao mesmo tempo não mandam a mensagem duas vezes.
    const reserva = await AgendaModel.updateOne(
        { _id: agenda._id, status: 'aguardando', 'lembrete.enviadoEm': null },
        { $set: { 'lembrete.enviadoEm': new Date(), 'lembrete.situacao': 'enviando', 'lembrete.erro': null } }
    )
    if (reserva.modifiedCount === 0) return false
    const falhar = (erro) => AgendaModel.updateOne({ _id: agenda._id }, { $set: { 'lembrete.situacao': 'falhou', 'lembrete.erro': erro } })

    const numero = telefoneWhatsapp(agenda.pacienteId.telefone)
    if (!numero) {
        await falhar('Telefone do paciente inválido para WhatsApp (use DDD + número)')
        return false
    }

    const texto = montarTexto(config.texto, {
        paciente: primeiroNome(agenda.pacienteId.nome),
        clinica: clinica.nomeEmpresa,
        data: dataPorExtenso(agenda.data, locale),
        hora: agenda.horaInicio,
        profissional: agenda.profissionalId?.nome ?? '',
    })
    try {
        const mensagemId = await Evolution.enviarTexto(config.instancia, numero, texto)
        await AgendaModel.updateOne({ _id: agenda._id }, { $set: { 'lembrete.mensagemId': mensagemId, 'lembrete.situacao': 'enviado' } })
        return true
    } catch (erro) {
        await falhar(erro.message)
        return false
    }
}

export const LembreteService = {
    // Envia os lembretes que chegaram na hora. Roda de 10 em 10 minutos (ver lembrete.agendador.js).
    async enviarPendentes(agora = new Date()) {
        if (!evolutionConfigurada()) return { enviados: 0 }
        const hora = horaEmBrasilia(agora)
        if (hora < HORA_INICIO || hora >= HORA_FIM) return { enviados: 0 }

        const hoje = hojeDiaPuro(agora)
        const depoisDeAmanha = new Date(hoje)
        depoisDeAmanha.setUTCDate(depoisDeAmanha.getUTCDate() + 2)

        const mes = mesEmBrasilia(agora)
        let enviados = 0
        for (const config of await WhatsappModel.find({ ativo: true })) {
            const acesso = await AssinaturaService.verificarAcesso(config.tenantId)
            if (acesso.bloqueado || !acesso.recursos.includes('whatsapp')) continue
            const limite = acesso.limites?.lembretesMes ?? null
            let restam = limite === null ? Infinity : limite - enviadosNoMes(config, mes)
            if (restam <= 0) continue

            const agendas = (await AgendaModel.find({
                tenantId: config.tenantId,
                data: { $gte: hoje, $lte: depoisDeAmanha },
                status: 'aguardando',
                'lembrete.enviadoEm': null,
            })
                .populate('pacienteId', 'nome telefone aceitaWhatsapp')
                .populate('profissionalId', 'nome')
                .lean())
                .filter((a) => a.pacienteId?.aceitaWhatsapp && horaDeEnviar(a, agora))
                .sort((a, b) => inicioDaConsulta(a) - inicioDaConsulta(b))
            if (!agendas.length) continue

            // Celular desconectado: espera a clínica reconectar (os lembretes continuam pendentes).
            if ((await Evolution.estado(config.instancia).catch(() => null)) !== 'open') continue

            const clinica = await UserModel.findById(config.tenantId, 'nomeEmpresa pais').lean()
            const locale = LOCALE[idiomaDoPais(clinica?.pais)]
            for (const agenda of agendas) {
                if (restam <= 0) break
                if (enviados > 0) await pausaEntreMensagens()
                if (await enviarLembrete(agenda, config, clinica ?? {}, locale)) {
                    enviados++
                    restam--
                    await contarNoMes(config, mes)
                }
            }
        }
        return { enviados }
    },
}
