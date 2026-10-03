import mongoose from 'mongoose'
import AgendaModel from '../agenda/agenda.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import ComissaoPagamentoModel from './comissao-pagamento.model.js'
import { PERIODOS, hojeDiaPuro, inicioDoPeriodoDiaPuro } from '../shared/utils/dia-puro.js'
import AppError from '../../errors/AppError.js'

// Comissão pendente: atendimento realizado, com comissão maior que zero, ainda não incluído em nenhum pagamento.
const PENDENTE = { status: 'realizado', 'comissao.valor': { $gt: 0 }, 'comissao.pagamentoId': null }

const oid = (id) => new mongoose.Types.ObjectId(String(id))

async function buscarProfissional(tenantId, profissionalId) {
    const profissional = mongoose.isValidObjectId(profissionalId)
        ? await ProfissionalModel.findOne({ _id: profissionalId, tenantId })
        : null
    if (!profissional) {
        throw new AppError('Profissional não encontrado', 404)
    }
    return profissional
}

async function somarPendentes(filtro) {
    const [resultado] = await AgendaModel.aggregate([
        { $match: { ...filtro, ...PENDENTE } },
        { $group: { _id: null, total: { $sum: '$comissao.valor' }, quantidade: { $sum: 1 } } },
    ])
    return { total: resultado?.total ?? 0, quantidade: resultado?.quantidade ?? 0 }
}

function pagamentoParaDTO(pagamento) {
    return {
        _id: pagamento._id,
        valor: pagamento.valor,
        quantidade: pagamento.quantidade,
        pagoEm: pagamento.createdAt,
        profissional: pagamento.profissionalId?.nome ? { _id: pagamento.profissionalId._id, nome: pagamento.profissionalId.nome } : null,
        pagoPor: pagamento.pagoPor?.nomeCompleto ?? null,
    }
}

export const ComissaoService = {

    // Visão do admin: uma linha por profissional com o que está pendente e o que já foi pago.
    async resumoDaClinica(tenantId) {
        const [profissionais, pendentes, pagos] = await Promise.all([
            ProfissionalModel.find({ tenantId }).sort({ nome: 1 }),
            AgendaModel.aggregate([
                { $match: { tenantId: oid(tenantId), ...PENDENTE } },
                { $group: { _id: '$profissionalId', total: { $sum: '$comissao.valor' }, quantidade: { $sum: 1 } } },
            ]),
            ComissaoPagamentoModel.aggregate([
                { $match: { tenantId: oid(tenantId) } },
                { $sort: { createdAt: -1 } },
                { $group: { _id: '$profissionalId', total: { $sum: '$valor' }, ultimoEm: { $first: '$createdAt' }, ultimoValor: { $first: '$valor' } } },
            ]),
        ])

        const pendentePor = new Map(pendentes.map((p) => [String(p._id), p]))
        const pagoPor = new Map(pagos.map((p) => [String(p._id), p]))

        return profissionais.map((profissional) => {
            const pendente = pendentePor.get(String(profissional._id))
            const pago = pagoPor.get(String(profissional._id))
            return {
                profissional: { _id: profissional._id, nome: profissional.nome, temLogin: !!profissional.usuarioId },
                pendente: { total: pendente?.total ?? 0, quantidade: pendente?.quantidade ?? 0 },
                pago: { total: pago?.total ?? 0, ultimoEm: pago?.ultimoEm ?? null, ultimoValor: pago?.ultimoValor ?? null },
            }
        })
    },

    // Atendimentos que entram no próximo pagamento, com a divisão entre profissional e clínica.
    async pendentesDoProfissional(tenantId, profissionalId) {
        const profissional = await buscarProfissional(tenantId, profissionalId)
        const agendas = await AgendaModel.find({ tenantId, profissionalId: profissional._id, ...PENDENTE })
            .populate('pacienteId', 'nome')
            .populate('servicoId', 'nome')
            .populate('convenioId', 'nome')
            .sort({ data: 1, horaInicio: 1 })

        return agendas.map((agenda) => ({
            _id: agenda._id,
            data: agenda.data,
            horaInicio: agenda.horaInicio,
            paciente: agenda.pacienteId?.nome ?? null,
            servico: agenda.servicoId?.nome ?? null,
            valorAtendimento: agenda.financeiro?.valor ?? 0,
            comissao: agenda.comissao.valor,
            comissaoPercentual: agenda.comissao.percentual ?? null,
            convenio: agenda.convenioId?.nome ?? null,
            parteClinica: (agenda.financeiro?.valor ?? 0) - agenda.comissao.valor,
        }))
    },

    // Paga de uma vez tudo o que está pendente para o profissional.
    async pagar(tenantId, profissionalId, usuarioId) {
        const profissional = await buscarProfissional(tenantId, profissionalId)
        const filtro = { tenantId, profissionalId: profissional._id, ...PENDENTE }

        const pendentes = await AgendaModel.find(filtro, '_id comissao.valor')
        if (pendentes.length === 0) {
            throw new AppError('Não há repasse pendente para este profissional', 400)
        }

        const pagamento = await ComissaoPagamentoModel.create({
            tenantId,
            profissionalId: profissional._id,
            valor: pendentes.reduce((soma, agenda) => soma + agenda.comissao.valor, 0),
            quantidade: pendentes.length,
            pagoPor: usuarioId,
        })

        // O filtro de pendente se repete aqui: se outro admin pagou ou alguém desmarcou um atendimento entre a leitura
        // e esta gravação, esses atendimentos ficam de fora e o total do pagamento é refeito com o que de fato entrou.
        const { modifiedCount } = await AgendaModel.updateMany(
            { _id: { $in: pendentes.map((a) => a._id) }, ...PENDENTE },
            { $set: { 'comissao.pagamentoId': pagamento._id } }
        )

        if (modifiedCount !== pendentes.length) {
            const [real] = await AgendaModel.aggregate([
                { $match: { 'comissao.pagamentoId': pagamento._id } },
                { $group: { _id: null, total: { $sum: '$comissao.valor' }, quantidade: { $sum: 1 } } },
            ])
            if (!real) {
                await pagamento.deleteOne()
                throw new AppError('Os repasses deste profissional mudaram enquanto o pagamento era feito. Confira e tente de novo.', 409)
            }
            pagamento.valor = real.total
            pagamento.quantidade = real.quantidade
            await pagamento.save()
        }

        return { _id: pagamento._id, valor: pagamento.valor, quantidade: pagamento.quantidade, pagoEm: pagamento.createdAt, profissional: { _id: profissional._id, nome: profissional.nome } }
    },

    async historico(tenantId, profissionalId) {
        const filtro = { tenantId }
        if (profissionalId) filtro.profissionalId = (await buscarProfissional(tenantId, profissionalId))._id

        const pagamentos = await ComissaoPagamentoModel.find(filtro)
            .populate('profissionalId', 'nome')
            .populate('pagoPor', 'nomeCompleto')
            .sort({ createdAt: -1 })
            .limit(50)

        return pagamentos.map(pagamentoParaDTO)
    },

    // Visão do próprio profissional (pelo login): quanto tem a receber e os atendimentos feitos no período.
    async minhas(usuario, periodo) {
        const { tenantId } = usuario
        const profissional = await ProfissionalModel.findOne({ tenantId, usuarioId: usuario.id })
        if (!profissional) {
            return { vinculado: false }
        }

        const chave = PERIODOS.includes(periodo) ? periodo : 'mensal'
        const ate = hojeDiaPuro()
        const desde = inicioDoPeriodoDiaPuro(chave, ate)

        const [aReceber, agendas, pagamentos] = await Promise.all([
            somarPendentes({ tenantId: oid(tenantId), profissionalId: profissional._id }),
            AgendaModel.find({ tenantId, profissionalId: profissional._id, status: 'realizado', data: { $gte: desde, $lte: ate } })
                .populate('pacienteId', 'nome')
                .populate('servicoId', 'nome')
                .populate('convenioId', 'nome')
                .sort({ data: -1, horaInicio: -1 }),
            ComissaoPagamentoModel.find({ tenantId, profissionalId: profissional._id }).sort({ createdAt: -1 }).limit(5),
        ])

        const atendimentos = agendas.map((agenda) => ({
            _id: agenda._id,
            data: agenda.data,
            horaInicio: agenda.horaInicio,
            paciente: agenda.pacienteId?.nome ?? null,
            servico: agenda.servicoId?.nome ?? null,
            comissao: agenda.comissao?.valor ?? 0,
            comissaoPercentual: agenda.comissao?.percentual ?? null,
            convenio: agenda.convenioId?.nome ?? null,
            paga: !!agenda.comissao?.pagamentoId,
        }))

        return {
            vinculado: true,
            profissional: { _id: profissional._id, nome: profissional.nome },
            aReceber,
            periodo: { chave, desde, ate },
            noPeriodo: {
                atendimentos: atendimentos.length,
                comissao: atendimentos.reduce((soma, a) => soma + a.comissao, 0),
                recebida: atendimentos.filter((a) => a.paga).reduce((soma, a) => soma + a.comissao, 0),
            },
            atendimentos,
            pagamentos: pagamentos.map(pagamentoParaDTO),
        }
    },
}
