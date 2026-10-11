import AssinaturaModel from '../assinatura/assinatura.model.js'
import PlanoModel from './plano.model.js'
import UserModel from '../user/user.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import AppError from '../../errors/AppError.js'

// Regras do plano Individual: só o dono da conta usa o sistema, como o único profissional da clínica.

async function nomeDoPlanoComEquipe() {
    const plano = await PlanoModel.findOne({ tipo: 'pago', ativo: true, individual: { $ne: true } }).sort({ preco: 1 })
    return plano ? `o plano ${plano.nome}` : 'outro plano'
}

async function planoDaClinica(tenantId) {
    const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 }).populate('planoId')
    return assinatura?.planoId ?? null
}

// Antes de cadastrar recepção, outro usuário ou outro profissional.
export async function exigirPlanoComEquipe(tenantId, { profissional = false } = {}) {
    const plano = await planoDaClinica(tenantId)
    if (!plano?.individual) return
    if (profissional && !(await ProfissionalModel.exists({ tenantId }))) return

    throw new AppError(
        `No plano ${plano.nome}, só você usa o sistema, como o único profissional. Para cadastrar ${profissional ? 'outros profissionais' : 'recepção ou outros usuários'}, mude para ${await nomeDoPlanoComEquipe()}.`,
        403
    )
}

// Antes de assinar o plano Individual: a clínica não pode ter equipe cadastrada.
export async function exigirCabeNoIndividual(tenantId, plano) {
    const [outrosUsuarios, profissionais] = await Promise.all([
        UserModel.countDocuments({ tenantId, _id: { $ne: tenantId } }),
        ProfissionalModel.countDocuments({ tenantId }),
    ])
    if (outrosUsuarios === 0 && profissionais <= 1) return

    const falta = [
        outrosUsuarios > 0 && `remova os outros usuários (${outrosUsuarios})`,
        profissionais > 1 && `deixe só um profissional cadastrado (hoje são ${profissionais})`,
    ].filter(Boolean).join(' e ')
    throw new AppError(`O plano ${plano.nome} é só para quem atende sozinho. Para assiná-lo, ${falta}, ou escolha ${await nomeDoPlanoComEquipe()}.`, 409)
}
