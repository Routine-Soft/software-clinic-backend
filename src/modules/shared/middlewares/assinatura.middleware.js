import AppError from '../../../errors/AppError.js'
import { AssinaturaService } from '../../assinatura/assinatura.service.js'
import { erroDeRecurso } from '../../plano/plano.limites.js'

// Carrega o que a clínica pode usar (plano Grátis, Basic ou Pro) em `req.acesso`, para `exigirRecurso` e os serviços.
// Vem DEPOIS de `authenticate`. Sem plano pago valendo a clínica cai no plano Grátis; só fica barrada de vez (402)
// quando o suporte revogou o acesso. As rotas de assinatura, login e conta ficam de fora para ela conseguir regularizar.
export async function exigirAssinaturaAtiva(req) {
    if (req.user?.role === 'super_admin') return
    // Afiliado não é clínica: não tem assinatura nem acesso às telas da clínica.
    if (req.user?.role === 'afiliado') throw new AppError('Conta de afiliado não acessa as telas da clínica', 403)

    const acesso = await AssinaturaService.verificarAcesso(req.user.tenantId)
    if (acesso.bloqueado) {
        throw new AppError(acesso.motivo, 402, 'ASSINATURA_INATIVA')
    }
    req.acesso = acesso
}

const MENSAGEM_DO_RECURSO = {
    prontuario: 'Escrever no prontuário é um recurso dos planos pagos. Os registros já salvos continuam disponíveis para leitura.',
    anamnese: 'Anamneses são um recurso dos planos pagos. As já preenchidas continuam disponíveis para leitura.',
    termo: 'O termo de consentimento (TCLE) é um recurso dos planos pagos.',
    convenio: 'Convênios são um recurso dos planos pagos.',
    avaliacoes: 'As avaliações são um recurso dos planos pagos. As já registradas continuam disponíveis para leitura.',
    empresas: 'Empresas clientes são um recurso dos planos pagos.',
    reunioes: 'A agenda de reuniões é um recurso dos planos pagos.',
    repasse: 'Repasses são um recurso do plano Pro.',
}

// Barra as rotas de um recurso que o plano da clínica não tem. Vem depois de `exigirAssinaturaAtiva`.
// `soEscrita`: a leitura continua liberada (o que já foi registrado nunca fica preso), só criar e alterar são barrados.
export function exigirRecurso(recurso, { soEscrita = true } = {}) {
    return async function (req) {
        if (!req.acesso || req.acesso.recursos.includes(recurso)) return
        if (soEscrita && req.method === 'GET') return
        throw erroDeRecurso(MENSAGEM_DO_RECURSO[recurso], recurso)
    }
}
