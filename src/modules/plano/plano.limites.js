import PlanoModel from './plano.model.js'
import UserModel from '../user/user.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import PacienteModel from '../paciente/paciente.model.js'
import AppError from '../../errors/AppError.js'

// Níveis de acesso da clínica (o nível do plano pago está em `plano.nivel`):
//  - rede: plano Rede: tudo liberado, até 100 profissionais e pacientes sem limite;
//  - pro: plano Pro e o período de teste: tudo liberado, até 25 profissionais e pacientes sem limite;
//  - basic: plano Basic: até 2 profissionais e 100 pacientes, sem recepção e sem repasses;
//  - gratis: sem plano pago valendo (teste acabou, pagamento venceu): agenda, até 10 pacientes e 1 profissional.
// O que não está em RECURSOS é livre em qualquer nível: agenda, pacientes, lista de espera, sala de espera, cadastros.
// Ninguém perde o que já registrou: sem o recurso, a leitura continua liberada e só a criação e a edição ficam barradas.
export const RECURSOS = ['prontuario', 'anamnese', 'termo', 'convenio', 'avaliacoes', 'empresas', 'reunioes', 'repasse', 'recepcao']

const RECURSOS_DO_NIVEL = {
    gratis: [],
    basic: RECURSOS.filter((r) => !['repasse', 'recepcao'].includes(r)),
    pro: RECURSOS,
    rede: RECURSOS,
}

// null = sem limite. Os mesmos números estão na página de preços (`precos.comparacao` em landing.textos.js).
const LIMITES_DO_NIVEL = {
    gratis: { pacientes: 10, profissionais: 1 },
    basic: { pacientes: 100, profissionais: 2 },
    pro: { pacientes: null, profissionais: 25 },
    rede: { pacientes: null, profissionais: 100 },
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

// "o plano Pro" (ou o nome que o super admin der ao plano desse nível).
async function nomeDoPlano(nivel) {
    const plano = await PlanoModel.findOne({ tipo: 'pago', ativo: true, nivel, moeda: { $ne: 'USD' } }).sort({ preco: 1 })
    return plano ? `o plano ${plano.nome}` : 'outro plano'
}

const nomeDoPlanoPro = () => nomeDoPlano('pro')

// Antes de cadastrar um usuário da clínica (recepção ou profissional) ou mudar o papel de um.
export async function exigirPlanoParaUsuario(tenantId, role) {
    const nivel = await nivelDaClinica(tenantId)
    if (['pro', 'rede'].includes(nivel)) return
    if (nivel === 'gratis') {
        throw erroDeRecurso('No plano Grátis, só você usa o sistema. Assine um plano para cadastrar a sua equipe.', 'recepcao')
    }
    if (role === 'recepcao') {
        throw erroDeRecurso(`A recepção não faz parte do plano Basic. Para cadastrá-la, mude para ${await nomeDoPlanoPro()}.`, 'recepcao')
    }
}

// Antes de cadastrar outro profissional: Grátis tem 1, Basic até 2, Pro até 25 e Rede até 100.
export async function exigirVagaDeProfissional(tenantId) {
    const { limites, nivel } = acessoDoNivel(await nivelDaClinica(tenantId))
    if (limites.profissionais === null) return
    const total = await ProfissionalModel.countDocuments({ tenantId })
    if (total < limites.profissionais) return
    if (nivel === 'gratis') {
        throw erroDeRecurso('No plano Grátis, a clínica tem um profissional. Assine um plano para cadastrar outros.', 'profissionais')
    }
    if (nivel === 'basic') {
        throw erroDeRecurso(`O plano Basic tem até ${limites.profissionais} profissionais. Para cadastrar mais, mude para ${await nomeDoPlanoPro()}.`, 'profissionais')
    }
    if (nivel === 'pro') {
        throw erroDeRecurso(`O plano Pro tem até ${limites.profissionais} profissionais. Para cadastrar mais, mude para ${await nomeDoPlano('rede')}.`, 'profissionais')
    }
    throw erroDeRecurso(`O plano Rede tem até ${limites.profissionais} profissionais. Para cadastrar mais, fale com o suporte da Sonelia.`, 'profissionais')
}

// Antes de cadastrar paciente: Grátis tem até 10 e Basic até 100.
export async function exigirVagaDePaciente(tenantId) {
    const { limites, nivel } = acessoDoNivel(await nivelDaClinica(tenantId))
    if (limites.pacientes === null) return
    const total = await PacienteModel.countDocuments({ tenantId })
    if (total < limites.pacientes) return
    if (nivel === 'gratis') {
        throw erroDeRecurso(`O plano Grátis tem até ${limites.pacientes} pacientes. Assine um plano para cadastrar mais.`, 'pacientes')
    }
    throw erroDeRecurso(`O plano Basic tem até ${limites.pacientes} pacientes. Para cadastrar mais, mude para ${await nomeDoPlanoPro()}.`, 'pacientes')
}

// Antes de assinar um plano: a clínica não pode passar dos limites dele. O Basic também não tem recepção.
export async function exigirCabeNoPlano(tenantId, plano) {
    if (plano.nivel === 'pro') {
        const maximoPro = LIMITES_DO_NIVEL.pro.profissionais
        const total = await ProfissionalModel.countDocuments({ tenantId })
        if (total > maximoPro) {
            throw new AppError(`A clínica tem ${total} profissionais e o plano ${plano.nome} vai até ${maximoPro}. Escolha ${await nomeDoPlano('rede')}.`, 409)
        }
        return
    }
    if (plano.nivel !== 'basic') return

    const { profissionais: maximo, pacientes: maximoPacientes } = LIMITES_DO_NIVEL.basic
    const [recepcao, profissionais, pacientes] = await Promise.all([
        UserModel.countDocuments({ tenantId, role: 'recepcao' }),
        ProfissionalModel.countDocuments({ tenantId }),
        PacienteModel.countDocuments({ tenantId }),
    ])
    // Paciente não se apaga (o prontuário fica guardado por 20 anos): com mais do que o limite, só o Pro serve.
    if (pacientes > maximoPacientes) {
        throw new AppError(`A clínica já tem ${pacientes} pacientes e o plano ${plano.nome} vai até ${maximoPacientes}. Escolha ${await nomeDoPlanoPro()}.`, 409)
    }
    if (recepcao === 0 && profissionais <= maximo) return

    const falta = [
        recepcao > 0 && `remova os usuários da recepção (${recepcao})`,
        profissionais > maximo && `deixe no máximo ${maximo} profissionais (hoje são ${profissionais})`,
    ].filter(Boolean).join(' e ')
    throw new AppError(`O plano ${plano.nome} não tem recepção e vai até ${maximo} profissionais. Para assiná-lo, ${falta}, ou escolha ${await nomeDoPlanoPro()}.`, 409)
}
