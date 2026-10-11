import { randomInt } from 'node:crypto'
import IndicacaoModel from './indicacao.model.js'
import UserModel from '../user/user.model.js'
import AppError from '../../errors/AppError.js'

// Desconto que a clínica ganha, na próxima mensalidade, por cada clínica indicada que pagar.
export const VALOR_POR_INDICACAO = 100
// Comissão do afiliado por clínica que pagar a primeira mensalidade.
export const COMISSAO_AFILIADO = 100
// O Código de Defesa do Consumidor (art. 49) dá 7 dias para desistir de compra feita pela internet e receber
// o dinheiro de volta. A comissão só pode ser paga depois disso: a partir do 8º dia após o pagamento.
export const DIAS_DE_CARENCIA = 7
const DIA_EM_MS = 24 * 60 * 60 * 1000

// Sem letras e números que se confundem (O/0, I/1/L), para quem digita o código.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const TAMANHO_CODIGO = 6

function gerarCodigo() {
    return Array.from({ length: TAMANHO_CODIGO }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
}

export function normalizarCodigo(codigo) {
    return typeof codigo === 'string' ? codigo.replace(/\s+/g, '').toUpperCase() : ''
}

// Grava um código novo em `campo` do usuário, sem repetir nenhum código (de clínica ou de afiliado) já existente.
async function gerarCodigoUnico(userId, campo) {
    for (let tentativa = 0; tentativa < 8; tentativa++) {
        const codigo = gerarCodigo()
        if (await UserModel.exists({ $or: [{ codigoIndicacao: codigo }, { codigoAfiliado: codigo }] })) continue
        try {
            const atualizado = await UserModel.findOneAndUpdate(
                { _id: userId, [campo]: { $exists: false } },
                { $set: { [campo]: codigo } },
                { returnDocument: 'after', projection: campo }
            )
            // Duas abas abrindo a tela juntas: a outra já gravou um código.
            return atualizado?.[campo] ?? (await UserModel.findById(userId, campo))?.[campo]
        } catch (error) {
            if (error.code !== 11000) throw error
        }
    }
    throw new AppError('Não foi possível gerar o código de indicação. Tente de novo.', 500)
}

export const IndicacaoService = {
    // Código do "Indique e ganhe" da clínica: criado na primeira vez que a dona abre a tela.
    async obterCodigo(tenantId) {
        const admin = await UserModel.findById(tenantId, 'codigoIndicacao')
        if (!admin) throw new AppError('Clínica não encontrada', 404)
        return admin.codigoIndicacao ?? await gerarCodigoUnico(tenantId, 'codigoIndicacao')
    },

    // Código de afiliado: separado do da clínica (a dona que também é afiliada tem os dois links).
    async obterCodigoAfiliado(userId) {
        const usuario = await UserModel.findById(userId, 'codigoAfiliado')
        if (!usuario) throw new AppError('Usuário não encontrado', 404)
        return usuario.codigoAfiliado ?? await gerarCodigoUnico(userId, 'codigoAfiliado')
    },

    async resumo(tenantId) {
        const codigo = await this.obterCodigo(tenantId)
        const indicacoes = await IndicacaoModel.find({ indicadorTenantId: tenantId, tipo: 'clinica' })
            .populate('indicadoTenantId', 'nomeEmpresa')
            .sort({ createdAt: -1 })

        const lista = indicacoes.map((i) => ({
            id: i._id,
            clinica: i.indicadoTenantId?.nomeEmpresa ?? 'Clínica removida',
            status: i.status,
            valor: i.valor,
            criadaEm: i.createdAt,
            liberadaEm: i.liberadaEm,
            usadaEm: i.usadaEm,
        }))

        return {
            codigo,
            valorPorIndicacao: VALOR_POR_INDICACAO,
            descontoGuardado: lista.filter((i) => i.status === 'liberada').reduce((soma, i) => soma + i.valor, 0),
            indicacoes: lista,
        }
    },

    // Chamado antes de criar a conta: código digitado errado não pode virar conta sem indicação.
    // Devolve { tipo, indicadorId }: o código pode ser de uma clínica (desconto) ou de um afiliado (comissão).
    async buscarIndicador(codigo) {
        const normalizado = normalizarCodigo(codigo)
        if (!normalizado) return null

        const clinica = await UserModel.findOne({ codigoIndicacao: normalizado, role: { $in: ['admin', 'super_admin'] } }, 'tenantId')
        if (clinica) return { tipo: 'clinica', indicadorId: clinica.tenantId }

        const afiliado = await UserModel.findOne(
            { codigoAfiliado: normalizado, afiliadoDesde: { $ne: null }, afiliadoAtivo: { $ne: false } },
            '_id'
        )
        if (afiliado) return { tipo: 'afiliado', indicadorId: afiliado._id }

        throw new AppError('Código de indicação não encontrado. Confira o código ou deixe o campo em branco.', 400)
    },

    async registrar(indicador, indicadoTenantId) {
        if (!indicador || String(indicador.indicadorId) === String(indicadoTenantId)) return
        await IndicacaoModel.create({
            tipo: indicador.tipo,
            indicadorTenantId: indicador.indicadorId,
            indicadoTenantId,
            valor: indicador.tipo === 'afiliado' ? COMISSAO_AFILIADO : VALOR_POR_INDICACAO,
        }).catch((error) => {
            if (error.code !== 11000) throw error
        })
    },

    // Primeiro pagamento aprovado da clínica indicada: libera o desconto de quem indicou (uma vez só).
    // Na comissão de afiliado, `disponivelEm` marca quando acaba o prazo de desistência do cliente.
    async liberarPeloPagamento(indicadoTenantId, pagamentoId) {
        const indicacao = await IndicacaoModel.findOne({ indicadoTenantId, status: 'aguardando' }, 'tipo')
        if (!indicacao) return

        const agora = new Date()
        const carencia = indicacao.tipo === 'afiliado' ? (DIAS_DE_CARENCIA + 1) * DIA_EM_MS : 0
        await IndicacaoModel.updateOne(
            { _id: indicacao._id, status: 'aguardando' },
            { $set: { status: 'liberada', liberadaEm: agora, liberadaPorPagamentoId: pagamentoId, disponivelEm: new Date(agora.getTime() + carencia) } }
        )
    },

    // O pagamento que liberou o prêmio foi devolvido (desistência ou contestação no cartão): o prêmio que ainda
    // não foi usado nem pago volta a esperar um novo pagamento da clínica indicada.
    async cancelarPorPagamento(pagamentoId) {
        await IndicacaoModel.updateMany(
            { liberadaPorPagamentoId: pagamentoId, status: 'liberada' },
            { $set: { status: 'aguardando', liberadaEm: null, liberadaPorPagamentoId: null, disponivelEm: null } }
        )
    },

    // Os descontos se somam: pega os mais antigos até o valor da mensalidade. O que passar fica para depois.
    async descontosDisponiveis(tenantId, limite) {
        const guardados = await IndicacaoModel.find({ indicadorTenantId: tenantId, tipo: 'clinica', status: 'liberada' }).sort({ liberadaEm: 1 })
        const escolhidos = []
        let total = 0
        for (const indicacao of guardados) {
            if (total + indicacao.valor > limite) break
            escolhidos.push(indicacao)
            total += indicacao.valor
        }
        return { indicacoes: escolhidos, total }
    },

    // Atômico por desconto: o mesmo crédito nunca entra em dois pagamentos. Devolve os que foram de fato usados.
    async usar(indicacaoIds, pagamentoId) {
        if (!indicacaoIds?.length) return []
        await IndicacaoModel.updateMany(
            { _id: { $in: indicacaoIds }, status: 'liberada' },
            { $set: { status: 'usada', usadaEm: new Date(), usadaNoPagamentoId: pagamentoId } }
        )
        return await IndicacaoModel.find({ _id: { $in: indicacaoIds }, status: 'usada', usadaNoPagamentoId: pagamentoId })
    },

    // Desfaz o uso quando a devolução no cartão falha: os descontos voltam a ficar guardados.
    async devolver(pagamentoId) {
        await IndicacaoModel.updateMany(
            { usadaNoPagamentoId: pagamentoId, status: 'usada' },
            { $set: { status: 'liberada', usadaEm: null, usadaNoPagamentoId: null } }
        )
    },
}
