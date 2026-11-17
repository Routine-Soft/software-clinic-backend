import AssinaturaModel from './assinatura.model.js'
import UserModel from '../user/user.model.js'
import { enviarEmail } from '../shared/utils/email.js'
import { FUSO, TEXTOS, idiomaDoPais, montarEmail, urlDoSistema } from './assinatura.emails.js'

// E-mails de ajuda durante o período de teste, para a clínica começar a usar de verdade:
//  - dia1: um dia depois do cadastro, marcar a primeira consulta;
//  - dia3: três dias depois, registrar o primeiro atendimento no prontuário;
//  - fim: na véspera do fim do teste, avisando que a clínica continua no plano Grátis se não assinar.
// Cada etapa sai uma vez só (`emailsDoTeste`); se o servidor ficou parado e várias venceram, sai só a mais recente.
const DIA_EM_MS = 24 * 60 * 60 * 1000

const ETAPAS = {
    pt: {
        dia1: {
            assunto: 'Marque sua primeira consulta na Sonelia',
            titulo: 'Vamos marcar a primeira consulta?',
            texto: 'Sua clínica já vem com o serviço "Consulta", uma sala e você como profissional. Abra a agenda, clique num horário e cadastre o paciente ali mesmo: leva menos de dois minutos.',
            botao: 'Abrir a agenda',
            rota: '/home',
        },
        dia3: {
            assunto: 'Seu primeiro prontuário eletrônico',
            titulo: 'Registre um atendimento no prontuário',
            texto: 'Em Pacientes, clique em "Abrir" e depois em "Iniciar atendimento". O histórico vira uma linha do tempo, com CID-10, alergias em destaque e sigilo garantido.',
            botao: 'Abrir pacientes',
            rota: '/pacientes',
        },
        fim: {
            assunto: 'Seu teste da Sonelia termina amanhã',
            titulo: 'Seu teste termina amanhã',
            texto: 'Depois do teste, sua clínica continua no plano Grátis, com a agenda e até 20 pacientes. Prontuário, anamnese, TCLE, convênios e a equipe ficam nos planos pagos, a partir de R$ 99 por mês. Nada do que você já registrou é perdido.',
            botao: 'Ver os planos',
            rota: '/assinaturas',
        },
    },
    en: {
        dia1: {
            assunto: 'Book your first appointment on Sonelia',
            titulo: 'Shall we book the first appointment?',
            texto: 'Your clinic already comes with a "Consultation" service, a room and you as a professional. Open the schedule, click a time slot and register the patient right there: it takes less than two minutes.',
            botao: 'Open the schedule',
            rota: '/home',
        },
        dia3: {
            assunto: 'Your first electronic health record',
            titulo: 'Record an appointment in the health record',
            texto: 'In Patients, click "Open" and then "Start appointment". The history becomes a timeline, with ICD-10, highlighted allergies and guaranteed confidentiality.',
            botao: 'Open patients',
            rota: '/pacientes',
        },
        fim: {
            assunto: 'Your Sonelia trial ends tomorrow',
            titulo: 'Your trial ends tomorrow',
            texto: 'After the trial, your clinic stays on the Free plan, with the schedule and up to 20 patients. Health records, intake forms, consent forms, insurance plans and the team are in the paid plans. Nothing you have already recorded is lost.',
            botao: 'See the plans',
            rota: '/assinaturas',
        },
    },
    es: {
        dia1: {
            assunto: 'Agenda tu primera consulta en Sonelia',
            titulo: '¿Agendamos la primera consulta?',
            texto: 'Tu clínica ya viene con el servicio "Consulta", una sala y tú como profesional. Abre la agenda, haz clic en un horario y registra al paciente ahí mismo: toma menos de dos minutos.',
            botao: 'Abrir la agenda',
            rota: '/home',
        },
        dia3: {
            assunto: 'Tu primera historia clínica electrónica',
            titulo: 'Registra una atención en la historia clínica',
            texto: 'En Pacientes, haz clic en "Abrir" y luego en "Iniciar atención". El historial se convierte en una línea de tiempo, con CIE-10, alergias destacadas y confidencialidad garantizada.',
            botao: 'Abrir pacientes',
            rota: '/pacientes',
        },
        fim: {
            assunto: 'Tu prueba de Sonelia termina mañana',
            titulo: 'Tu prueba termina mañana',
            texto: 'Después de la prueba, tu clínica sigue en el plan Gratis, con la agenda y hasta 20 pacientes. La historia clínica, la anamnesis, el consentimiento informado, los seguros y el equipo están en los planes pagos. No pierdes nada de lo que ya registraste.',
            botao: 'Ver los planes',
            rota: '/assinaturas',
        },
    },
}

// A etapa mais recente que já venceu para esta assinatura, ou null.
export function etapaDoTeste(assinatura, agora = new Date()) {
    const desde = agora - new Date(assinatura.dataInicio)
    const faltam = new Date(assinatura.dataFimTrial) - agora
    if (faltam > 0 && faltam <= DIA_EM_MS) return 'fim'
    if (desde >= 3 * DIA_EM_MS) return 'dia3'
    if (desde >= DIA_EM_MS) return 'dia1'
    return null
}

const ORDEM = ['dia1', 'dia3', 'fim']

async function enviarEtapa(assinatura, etapa) {
    // Marca antes de enviar (com as etapas anteriores): mesmo com o servidor reiniciando, ninguém recebe duas vezes.
    const marcar = ORDEM.slice(0, ORDEM.indexOf(etapa) + 1)
    const reservada = await AssinaturaModel.findOneAndUpdate(
        { _id: assinatura._id, emailsDoTeste: { $ne: etapa } },
        { $addToSet: { emailsDoTeste: { $each: marcar } } }
    )
    if (!reservada) return false

    try {
        const dono = await UserModel.findById(assinatura.tenantId, 'nomeCompleto email pais')
        if (!dono?.email) return false
        const idioma = idiomaDoPais(dono.pais)
        const E = ETAPAS[idioma][etapa]
        const { html, texto } = montarEmail(TEXTOS[idioma], dono.nomeCompleto, E.titulo, E.texto, { botao: E.botao, url: urlDoSistema(E.rota) })
        await enviarEmail({ para: dono.email, assunto: E.assunto, html, texto })
        return true
    } catch (error) {
        console.error(`Não foi possível enviar o e-mail do teste (${etapa}) da clínica ${assinatura.tenantId}: ${error.message}`)
        await AssinaturaModel.updateOne({ _id: assinatura._id }, { $pull: { emailsDoTeste: etapa } })
        return false
    }
}

export async function enviarEmailsDoTeste(agora = new Date()) {
    const hora = Number(agora.toLocaleString('en-US', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' }))
    if (hora < 8 || hora >= 20) return 0

    const assinaturas = await AssinaturaModel.find({
        status: 'trial',
        acessoRevogado: { $ne: true },
        dataFimTrial: { $gt: agora },
        emailsDoTeste: { $ne: 'fim' },
    })

    let enviados = 0
    for (const assinatura of assinaturas) {
        const etapa = etapaDoTeste(assinatura, agora)
        if (etapa && !(assinatura.emailsDoTeste ?? []).includes(etapa) && await enviarEtapa(assinatura, etapa)) enviados += 1
    }
    return enviados
}
