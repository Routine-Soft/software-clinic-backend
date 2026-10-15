import { randomBytes, randomInt, createHash } from 'node:crypto'
import PainelTvModel from './painel-tv.model.js'
import PareamentoTvModel from './pareamento-tv.model.js'
import UserModel from '../user/user.model.js'
import { ChamadaService } from '../chamada/chamada.service.js'
import { AssinaturaService } from '../assinatura/assinatura.service.js'
import AppError from '../../errors/AppError.js'

const VALIDADE_DO_CODIGO_MS = 10 * 60 * 1000
// Grava o "visto por último" no máximo uma vez por minuto (a TV consulta a cada poucos segundos).
const INTERVALO_ULTIMO_ACESSO_MS = 60 * 1000
const MAXIMO_DE_TVS = 10

export function hashDaChave(valor) {
    return createHash('sha256').update(valor).digest('hex')
}

export const PainelTvService = {
    // Chamado pela TV ainda sem conexão: gera o código que aparece na tela.
    async iniciarPareamento() {
        for (let tentativa = 0; tentativa < 5; tentativa++) {
            const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
            const segredo = randomBytes(32).toString('hex')
            try {
                await PareamentoTvModel.create({ codigo, segredoHash: hashDaChave(segredo), expiraEm: new Date(Date.now() + VALIDADE_DO_CODIGO_MS) })
                return { codigo, segredo, expiraEm: new Date(Date.now() + VALIDADE_DO_CODIGO_MS) }
            } catch (error) {
                if (error.code !== 11000) throw error
            }
        }
        throw new AppError('Não foi possível gerar o código. Tente de novo.', 500)
    },

    // A TV pergunta se a clínica já digitou o código. Quando sim, recebe a chave (uma vez só) e o pedido é apagado.
    async situacaoDoPareamento(segredo) {
        if (typeof segredo !== 'string' || !/^[0-9a-f]{64}$/.test(segredo)) throw new AppError('Pedido de conexão inválido', 400)
        const pareamento = await PareamentoTvModel.findOne({ segredoHash: hashDaChave(segredo), expiraEm: { $gt: new Date() } })
        if (!pareamento) throw new AppError('O código venceu. A TV vai gerar outro.', 410)
        if (!pareamento.painelId) return { conectada: false }

        const apagado = await PareamentoTvModel.findOneAndDelete({ _id: pareamento._id, painelId: { $ne: null } })
        if (!apagado) throw new AppError('O código venceu. A TV vai gerar outro.', 410)

        const chave = randomBytes(32).toString('hex')
        const painel = await PainelTvModel.findByIdAndUpdate(apagado.painelId, { $set: { chaveHash: hashDaChave(chave) } }, { returnDocument: 'after' })
        if (!painel) throw new AppError('A conexão foi cancelada na clínica. A TV vai gerar outro código.', 410)
        return { conectada: true, chave, nome: painel.nome }
    },

    // Alguém da clínica digita o código que aparece na TV.
    async conectar(tenantId, usuarioId, { codigo, nome }) {
        const limpo = String(codigo ?? '').replace(/\D/g, '')
        if (limpo.length !== 6) throw new AppError('Digite os 6 números que aparecem na TV', 400)
        if (await PainelTvModel.countDocuments({ tenantId }) >= MAXIMO_DE_TVS) {
            throw new AppError(`A clínica já tem ${MAXIMO_DE_TVS} TVs conectadas. Desconecte uma antes.`, 409)
        }

        const pareamento = await PareamentoTvModel.findOne({ codigo: limpo, painelId: null, expiraEm: { $gt: new Date() } })
        if (!pareamento) throw new AppError('Código não encontrado ou vencido. Confira o número na TV.', 404)

        // A chave de verdade só é criada quando a TV vier buscar; até lá fica um valor que ninguém conhece.
        const painel = await PainelTvModel.create({
            nome: String(nome ?? '').trim() || 'TV da sala de espera',
            chaveHash: hashDaChave(randomBytes(32).toString('hex')),
            conectadaPor: usuarioId,
            tenantId,
        })
        const marcado = await PareamentoTvModel.updateOne({ _id: pareamento._id, painelId: null }, { $set: { painelId: painel._id } })
        if (!marcado.modifiedCount) {
            await PainelTvModel.deleteOne({ _id: painel._id })
            throw new AppError('Este código acabou de ser usado. Peça um novo na TV.', 409)
        }
        return painel
    },

    async listar(tenantId) {
        return await PainelTvModel.find({ tenantId }).sort({ createdAt: 1 })
    },

    async renomear(tenantId, id, nome) {
        const limpo = String(nome ?? '').trim()
        if (!limpo) throw new AppError('Dê um nome para a TV', 400)
        const painel = await PainelTvModel.findOneAndUpdate({ _id: id, tenantId }, { $set: { nome: limpo } }, { returnDocument: 'after' })
        if (!painel) throw new AppError('TV não encontrada', 404)
        return painel
    },

    async desconectar(tenantId, id) {
        const painel = await PainelTvModel.findOneAndDelete({ _id: id, tenantId })
        if (!painel) throw new AppError('TV não encontrada', 404)
    },

    // O que a TV mostra. A TV de uma clínica com a assinatura vencida mostra o aviso em vez das chamadas.
    async telaDaTv(painel) {
        const agora = new Date()
        if (!painel.ultimoAcessoEm || agora - painel.ultimoAcessoEm > INTERVALO_ULTIMO_ACESSO_MS) {
            await PainelTvModel.updateOne({ _id: painel._id }, { $set: { ultimoAcessoEm: agora } })
        }

        const [clinica, acesso] = await Promise.all([
            UserModel.findById(painel.tenantId, 'nomeEmpresa'),
            AssinaturaService.verificarAcesso(painel.tenantId),
        ])
        return {
            clinica: clinica?.nomeEmpresa ?? '',
            tv: painel.nome,
            liberado: acesso.liberado,
            chamadas: acesso.liberado ? await ChamadaService.ultimasDoDia(painel.tenantId) : [],
        }
    },
}
