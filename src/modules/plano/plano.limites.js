import PlanoModel from './plano.model.js'
import UserModel from '../user/user.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import PacienteModel from '../paciente/paciente.model.js'
import AppError from '../../errors/AppError.js'

// Três níveis de acesso da clínica:
//  - pro: plano Pro e o período de teste (tudo liberado, sem limites);
//  - basic: plano Basic (campo `individual` do plano): até 5 profissionais, sem recepção e sem repasses;
//  - gratis: sem plano pago valendo (teste acabou, pagamento venceu): agenda, até 10 pacientes e 1 profissional.
// O que não está em RECURSOS é livre em qualquer nível: agenda, pacientes, lista de espera, sala de espera, cadastros.
// Ninguém perde o que já registrou: sem o recurso, a leitura continua liberada e só a criação e a edição ficam barradas.
export const RECURSOS = ['prontuario', 'anamnese', 'termo', 'convenio', 'avaliacoes', 'empresas', 'reunioes', 'repasse', 'recepcao']

const RECURSOS_DO_NIVEL = {
    gratis: [],
    basic: RECURSOS.filter((r) => !['repasse', 'recepcao'].includes(r)),
    pro: RECURSOS,
}

export const LIMITE_PACIENTES_GRATIS = 10
const LIMITES_DO_NIVEL = {
    gratis: { pacientes: LIMITE_PACIENTES_GRATIS, profissionais: 1 },
    basic: { pacientes: null, profissionais: 5 },
    pro: { pacientes: null, profissionais: null },
}

export function acessoDoNivel(nivel) {
    return { nivel, recursos: RECURSOS_DO_NIVEL[nivel], limites: LIMITES_DO_NIVEL[nivel] }
}

// Erro que o site transforma na janela "recurso do plano pago" (código e recurso vão na resposta).
export function erroDeRecurso(mensagem, recurso) {
    return new AppError(mensagem, 402, 'RECURSO_DO_PLANO', { recurso })
}

async function nivelDaClinica(tenantId) {
    // Import tardio: o serviço de assinatura também importa este arquivo.
    const { AssinaturaService } = await import('../assinatura/assinatura.service.js')
    return (await AssinaturaService.verificarAcesso(tenantId)).nivel
}

async function nomeDoPlanoPro() {
    const plano = await PlanoModel.findOne({ tipo: 'pago', ativo: true, individual: { $ne: true }, moeda: { $ne: 'USD' } }).sort({ preco: 1 })
    return plano ? `o plano ${plano.nome}` : 'outro plano'
}

// Antes de cadastrar um usuário da clínica (recepção ou profissional) ou mudar o papel de um.
export async function exigirPlanoParaUsuario(tenantId, role) {
    const nivel = await nivelDaClinica(tenantId)
    if (nivel === 'pro') return
    if (nivel === 'gratis') {
        throw erroDeRecurso('No plano Grátis, só você usa o sistema. Assine um plano para cadastrar a sua equipe.', 'recepcao')
    }
    if (role === 'recepcao') {
        throw erroDeRecurso(`A recepção não faz parte do plano Basic. Para cadastrá-la, mude para ${await nomeDoPlanoPro()}.`, 'recepcao')
    }
}

// Antes de cadastrar outro profissional: Grátis tem 1, Basic tem até 5.
export async function exigirVagaDeProfissional(tenantId) {
    const { limites, nivel } = acessoDoNivel(await nivelDaClinica(tenantId))
    if (limites.profissionais === null) return
    const total = await ProfissionalModel.countDocuments({ tenantId })
    if (total < limites.profissionais) return
    throw erroDeRecurso(
        nivel === 'gratis'
            ? 'No plano Grátis, a clínica tem um profissional. Assine um plano para cadastrar outros.'
            : `O plano Basic tem até ${limites.profissionais} profissionais. Para cadastrar mais, mude para ${await nomeDoPlanoPro()}.`,
        'profissionais',
    )
}

// Antes de cadastrar paciente: o plano Grátis tem até 10.
export async function exigirVagaDePaciente(tenantId) {
    const { limites } = acessoDoNivel(await nivelDaClinica(tenantId))
    if (limites.pacientes === null) return
    const total = await PacienteModel.countDocuments({ tenantId })
    if (total < limites.pacientes) return
    throw erroDeRecurso(`O plano Grátis tem até ${limites.pacientes} pacientes. Assine um plano para cadastrar pacientes sem limite.`, 'pacientes')
}

// Antes de assinar o plano Basic: a clínica não pode ter recepção nem mais de 5 profissionais.
export async function exigirCabeNoIndividual(tenantId, plano) {
    const maximo = LIMITES_DO_NIVEL.basic.profissionais
    const [recepcao, profissionais] = await Promise.all([
        UserModel.countDocuments({ tenantId, role: 'recepcao' }),
        ProfissionalModel.countDocuments({ tenantId }),
    ])
    if (recepcao === 0 && profissionais <= maximo) return

    const falta = [
        recepcao > 0 && `remova os usuários da recepção (${recepcao})`,
        profissionais > maximo && `deixe no máximo ${maximo} profissionais (hoje são ${profissionais})`,
    ].filter(Boolean).join(' e ')
    throw new AppError(`O plano ${plano.nome} não tem recepção e vai até ${maximo} profissionais. Para assiná-lo, ${falta}, ou escolha ${await nomeDoPlanoPro()}.`, 409)
}
