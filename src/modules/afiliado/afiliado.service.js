import argon2 from 'argon2'
import mongoose from 'mongoose'
import UserModel from '../user/user.model.js'
import IndicacaoModel from '../indicacao/indicacao.model.js'
import { IndicacaoService, COMISSAO_AFILIADO, DIAS_DE_CARENCIA } from '../indicacao/indicacao.service.js'
import { criarAfiliadoDTO, dadosDeAfiliadoDTO } from './afiliado.dto.js'
import AppError from '../../errors/AppError.js'

export const TERMOS_AFILIADO_VERSAO = '2026-10-11'

// Separa as comissões pelo que o afiliado (ou o super_admin) precisa saber: o que já pode ser pago e o que ainda
// está nos 7 dias em que o cliente pode desistir.
function situacao(indicacao, agora = new Date()) {
    if (indicacao.status === 'liberada') return indicacao.disponivelEm <= agora ? 'a_pagar' : 'carencia'
    return indicacao.status
}

function resumir(indicacoes) {
    const agora = new Date()
    const totais = { aPagar: 0, emCarencia: 0, recebido: 0, aguardando: 0 }
    const lista = indicacoes.map((i) => {
        const s = situacao(i, agora)
        if (s === 'a_pagar') totais.aPagar += i.valor
        if (s === 'carencia') totais.emCarencia += i.valor
        if (s === 'paga') totais.recebido += i.valor
        if (s === 'aguardando') totais.aguardando += 1
        return {
            id: i._id,
            clinica: i.indicadoTenantId?.nomeEmpresa ?? 'Clínica removida',
            situacao: s,
            valor: i.valor,
            criadaEm: i.createdAt,
            liberadaEm: i.liberadaEm,
            disponivelEm: i.disponivelEm,
            pagaEm: i.pagaEm,
        }
    })
    return { totais, indicacoes: lista }
}

async function comissoesDe(afiliadoId) {
    return await IndicacaoModel.find({ indicadorTenantId: afiliadoId, tipo: 'afiliado' })
        .populate('indicadoTenantId', 'nomeEmpresa')
        .sort({ createdAt: -1 })
}

function marcasDeAfiliado() {
    return {
        afiliadoDesde: new Date(),
        afiliadoAtivo: true,
        termosAfiliadoEm: new Date(),
        termosAfiliadoVersao: TERMOS_AFILIADO_VERSAO,
    }
}

export const AfiliadoService = {
    // Quem ainda não tem conta na Sonelia: cria uma conta só de afiliado.
    async criar(body) {
        const dto = criarAfiliadoDTO(body)
        if (await UserModel.exists({ email: dto.email.toLowerCase().replace(/\s+/g, '') })) {
            throw new AppError('Este e-mail já tem conta na Sonelia. Entre com ele e ative o programa de afiliados na sua conta.', 409)
        }

        const id = new mongoose.Types.ObjectId()
        try {
            await UserModel.create({
                ...dto,
                ...marcasDeAfiliado(),
                _id: id,
                tenantId: id,
                role: 'afiliado',
                password: await argon2.hash(dto.password),
            })
        } catch (error) {
            if (error.code === 11000) throw new AppError('Este e-mail já tem conta na Sonelia. Entre com ele e ative o programa de afiliados na sua conta.', 409)
            throw error
        }
        await IndicacaoService.obterCodigoAfiliado(id)
        return await UserModel.findById(id)
    },

    // Quem já usa a Sonelia (recepção, profissional, dona da clínica) vira afiliado sem criar outra conta.
    async ativar(userId, body) {
        const dados = dadosDeAfiliadoDTO(body)
        const usuario = await UserModel.findOneAndUpdate(
            { _id: userId, afiliadoDesde: { $in: [null] } },
            { $set: { ...dados, ...marcasDeAfiliado() } },
            { returnDocument: 'after' }
        )
        if (!usuario) {
            if (await UserModel.exists({ _id: userId })) throw new AppError('Você já é afiliado. Abra o Painel do afiliado.', 409)
            throw new AppError('Usuário não encontrado', 404)
        }
        await IndicacaoService.obterCodigoAfiliado(userId)
        return await UserModel.findById(userId)
    },

    async painel(afiliadoId) {
        const afiliado = await UserModel.findById(afiliadoId)
        if (!afiliado?.afiliadoDesde) throw new AppError('Você ainda não é afiliado', 403)

        return {
            codigo: await IndicacaoService.obterCodigoAfiliado(afiliadoId),
            ativo: afiliado.afiliadoAtivo !== false,
            comissaoPorClinica: COMISSAO_AFILIADO,
            diasDeCarencia: DIAS_DE_CARENCIA,
            chavePix: afiliado.chavePix,
            ...resumir(await comissoesDe(afiliadoId)),
        }
    },

    // Tela do super_admin: todos os afiliados com quanto há para pagar a cada um.
    async listar() {
        const afiliados = await UserModel.find({ afiliadoDesde: { $ne: null } }).sort({ afiliadoDesde: -1 })
        const comissoes = await IndicacaoModel.find({ tipo: 'afiliado' })
            .populate('indicadoTenantId', 'nomeEmpresa')
            .sort({ createdAt: -1 })

        return afiliados.map((afiliado) => ({
            ...afiliado.toJSON(),
            ...resumir(comissoes.filter((c) => String(c.indicadorTenantId) === String(afiliado._id))),
        }))
    },

    // Marca como pagas as comissões que já passaram da carência (depois de o super_admin mandar o Pix).
    async registrarPagamento(afiliadoId) {
        const agora = new Date()
        const filtro = { indicadorTenantId: afiliadoId, tipo: 'afiliado', status: 'liberada', disponivelEm: { $lte: agora } }
        const devidas = await IndicacaoModel.find(filtro, '_id valor')
        if (!devidas.length) throw new AppError('Este afiliado não tem comissão para receber agora', 409)

        const { modifiedCount } = await IndicacaoModel.updateMany(
            { ...filtro, _id: { $in: devidas.map((d) => d._id) } },
            { $set: { status: 'paga', pagaEm: agora } }
        )
        const total = devidas.reduce((soma, d) => soma + d.valor, 0)
        return { quantidade: modifiedCount, total }
    },

    // Desativado, o código do afiliado deixa de valer para novos cadastros. O que ele já ganhou continua valendo.
    async definirAtivo(afiliadoId, ativo) {
        const afiliado = await UserModel.findOneAndUpdate(
            { _id: afiliadoId, afiliadoDesde: { $ne: null } },
            { $set: { afiliadoAtivo: ativo === true } },
            { returnDocument: 'after' }
        )
        if (!afiliado) throw new AppError('Afiliado não encontrado', 404)
        return afiliado
    },

    // Tira a pessoa do programa e apaga as comissões dela. Conta só de afiliado é apagada do banco;
    // quem trabalha numa clínica continua com o acesso da clínica, só deixa de ser afiliado.
    async excluir(afiliadoId) {
        const afiliado = await UserModel.findOne({ _id: afiliadoId, afiliadoDesde: { $ne: null } }, 'role')
        if (!afiliado) throw new AppError('Afiliado não encontrado', 404)

        await IndicacaoModel.deleteMany({ indicadorTenantId: afiliado._id, tipo: 'afiliado' })
        if (afiliado.role === 'afiliado') {
            await UserModel.deleteOne({ _id: afiliado._id })
            return { contaApagada: true }
        }
        await UserModel.updateOne(
            { _id: afiliado._id },
            { $unset: { afiliadoDesde: 1, codigoAfiliado: 1, afiliadoAtivo: 1, termosAfiliadoEm: 1, termosAfiliadoVersao: 1 }, $set: { documento: null, chavePix: null } }
        )
        return { contaApagada: false }
    },
}
