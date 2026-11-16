import AgendaModel from './agenda.model.js'
import UserModel from '../user/user.model.js'
import { avisarNoTelegram } from '../shared/utils/telegram.js'

// Avisa o Stanley no Telegram quando uma clínica marca o primeiro agendamento: é o sinal de que ela começou a usar.
// `criados`: quantos agendamentos acabaram de ser gravados (consultas que se repetem gravam vários de uma vez).
export async function alertarPrimeiroAgendamento(tenantId, criados) {
    try {
        if ((await AgendaModel.countDocuments({ tenantId })) !== criados) return
        const dono = await UserModel.findById(tenantId, 'nomeEmpresa nomeCompleto email area createdAt').lean()
        if (!dono) return
        const dias = Math.floor((Date.now() - new Date(dono.createdAt).getTime()) / (24 * 60 * 60 * 1000))
        avisarNoTelegram([
            '📅 Primeiro agendamento de uma clínica na Sonelia!',
            '',
            `Clínica: ${dono.nomeEmpresa || '-'}`,
            `Dono: ${dono.nomeCompleto} (${dono.email})`,
            `Área: ${dono.area || '-'}`,
            `Dias desde o cadastro: ${dias}`,
            `ID: ${tenantId}`,
        ].join('\n'))
    } catch (erro) {
        console.error(`Falha no alerta do primeiro agendamento: ${erro.message}`)
    }
}
