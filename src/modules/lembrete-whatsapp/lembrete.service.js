import mongoose from 'mongoose'
import AgendaModel from '../agenda/agenda.model.js'
import UserModel from '../user/user.model.js'
import { AgendaService } from '../agenda/agenda.service.js'
import { AssinaturaService } from '../assinatura/assinatura.service.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import { WhatsApp, whatsappConfigurado, telefoneWhatsapp } from './whatsapp.client.js'

// Janela de envio, no horário de Brasília. Começa de manhã e segue até a noite para que um agendamento
// feito à tarde para o dia seguinte também receba o lembrete.
const HORA_INICIO = 9
const HORA_FIM = 20

// O que a Meta informa sobre a mensagem, na ordem em que acontece (um aviso atrasado não faz voltar atrás).
const SITUACAO_DA_META = { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'falhou' }
const ORDEM_SITUACAO = ['enviando', 'enviado', 'entregue', 'lido']

function horaEmBrasilia(agora) {
    return Number(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }))
}

// Datas de agendamento são "dia puro" (meia-noite UTC): formata em UTC para não cair no dia anterior.
function diaPorExtenso(data) {
    return data.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' })
}

function primeiroNome(nome) {
    return String(nome ?? '').trim().split(/\s+/)[0] || 'tudo bem'
}

async function clinicasComAcesso() {
    const clinicas = await UserModel.find(
        { lembretesWhatsapp: true, role: { $in: ['admin', 'super_admin'] }, $expr: { $eq: ['$_id', '$tenantId'] } },
        'nomeEmpresa role'
    ).lean()

    // Sem assinatura em dia, a clínica não gera custo de mensagens.
    const comAcesso = []
    for (const clinica of clinicas) {
        if (clinica.role === 'super_admin' || (await AssinaturaService.verificarAcesso(clinica._id)).liberado) {
            comAcesso.push(clinica)
        }
    }
    return comAcesso
}

async function enviarLembrete(agenda, clinica) {
    // Reserva o agendamento antes de chamar a Meta: duas rodadas ao mesmo tempo não mandam a mensagem duas vezes.
    const reserva = await AgendaModel.updateOne(
        { _id: agenda._id, status: 'aguardando', 'lembrete.enviadoEm': null },
        { $set: { 'lembrete.enviadoEm': new Date(), 'lembrete.situacao': 'enviando', 'lembrete.erro': null } }
    )
    if (reserva.modifiedCount === 0) return false

    const falhar = (erro) => AgendaModel.updateOne({ _id: agenda._id }, { $set: { 'lembrete.situacao': 'falhou', 'lembrete.erro': erro } })

    const telefone = telefoneWhatsapp(agenda.pacienteId.telefone)
    if (!telefone) {
        await falhar('Telefone do paciente inválido para WhatsApp (use DDD + número)')
        return false
    }

    try {
        const mensagemId = await WhatsApp.enviarLembrete(telefone, {
            nome: primeiroNome(agenda.pacienteId.nome),
            clinica: clinica.nomeEmpresa,
            dia: diaPorExtenso(agenda.data),
            hora: agenda.horaInicio,
            agendaId: agenda._id,
        })
        await AgendaModel.updateOne({ _id: agenda._id }, { $set: { 'lembrete.mensagemId': mensagemId, 'lembrete.situacao': 'enviado' } })
        return true
    } catch (erro) {
        await falhar(erro.message)
        return false
    }
}

async function atualizarSituacao(status) {
    const situacao = SITUACAO_DA_META[status.status]
    if (!situacao || !status.id) return

    if (situacao === 'falhou') {
        const erro = status.errors?.[0]
        await AgendaModel.updateOne(
            { 'lembrete.mensagemId': status.id },
            { $set: { 'lembrete.situacao': 'falhou', 'lembrete.erro': erro?.error_data?.details || erro?.title || 'Não entregue' } }
        )
        return
    }

    const anteriores = ORDEM_SITUACAO.slice(0, ORDEM_SITUACAO.indexOf(situacao))
    await AgendaModel.updateOne(
        { 'lembrete.mensagemId': status.id, 'lembrete.situacao': { $in: anteriores } },
        { $set: { 'lembrete.situacao': situacao } }
    )
}

function contatoDaClinica(clinica) {
    return clinica?.telefone ? `a ${clinica.nomeEmpresa} pelo ${clinica.telefone}` : `a ${clinica?.nomeEmpresa ?? 'clínica'}`
}

// Botão "Confirmar" ou "Desmarcar" do lembrete. Só vale para a mensagem que foi enviada para aquele agendamento
// (context.id), então ninguém confirma ou desmarca a consulta de outra pessoa forjando o payload.
async function tratarResposta(mensagem) {
    const payload = mensagem.button?.payload ?? mensagem.interactive?.button_reply?.id
    const [acao, agendaId] = String(payload ?? '').split(':')
    if (!['confirmar', 'desmarcar'].includes(acao) || !mongoose.isValidObjectId(agendaId) || !mensagem.context?.id) return

    const agenda = await AgendaModel.findOne({ _id: agendaId, 'lembrete.mensagemId': mensagem.context.id })
    if (!agenda || agenda.status === 'realizado') return

    const resposta = acao === 'confirmar' ? 'confirmado' : 'desmarcado'
    if (agenda.lembrete.resposta === resposta) return // aviso repetido da Meta

    const clinica = await UserModel.findById(agenda.tenantId, 'nomeEmpresa telefone').lean()
    let texto

    if (agenda.status === 'cancelado') {
        texto = `Esta consulta já está desmarcada. Para remarcar, fale com ${contatoDaClinica(clinica)}.`
    } else if (resposta === 'confirmado') {
        await AgendaModel.updateOne({ _id: agenda._id }, { $set: { 'lembrete.resposta': 'confirmado', 'lembrete.respondidoEm': new Date() } })
        texto = 'Presença confirmada. Até amanhã!'
    } else {
        try {
            await AgendaService.cancelarAgenda(agenda._id, agenda.tenantId)
            await AgendaModel.updateOne({ _id: agenda._id }, { $set: { 'lembrete.resposta': 'desmarcado', 'lembrete.respondidoEm': new Date() } })
            texto = `Consulta desmarcada. Para remarcar, fale com ${contatoDaClinica(clinica)}.`
        } catch {
            texto = `Não conseguimos desmarcar por aqui. Por favor, fale com ${contatoDaClinica(clinica)}.`
        }
    }

    await WhatsApp.enviarTexto(mensagem.from, texto)
}

export const LembreteService = {
    // Envia o lembrete das consultas de amanhã que ainda não receberam. Roda de tempos em tempos (ver lembrete.agendador.js).
    async enviarPendentes(agora = new Date()) {
        if (!whatsappConfigurado()) return { enviados: 0 }

        const hora = horaEmBrasilia(agora)
        if (hora < HORA_INICIO || hora >= HORA_FIM) return { enviados: 0 }

        const amanha = hojeDiaPuro(agora)
        amanha.setUTCDate(amanha.getUTCDate() + 1)

        let enviados = 0
        for (const clinica of await clinicasComAcesso()) {
            const agendas = await AgendaModel.find({ tenantId: clinica._id, data: amanha, status: 'aguardando', 'lembrete.enviadoEm': null })
                .populate('pacienteId', 'nome telefone aceitaWhatsapp')
                .lean()

            for (const agenda of agendas) {
                if (!agenda.pacienteId?.aceitaWhatsapp) continue
                if (await enviarLembrete(agenda, clinica)) enviados++
            }
        }
        return { enviados }
    },

    async processarWebhook(corpo) {
        for (const entrada of corpo?.entry ?? []) {
            for (const mudanca of entrada.changes ?? []) {
                const valor = mudanca.value ?? {}
                for (const status of valor.statuses ?? []) await atualizarSituacao(status)
                for (const mensagem of valor.messages ?? []) await tratarResposta(mensagem)
            }
        }
    },
}
