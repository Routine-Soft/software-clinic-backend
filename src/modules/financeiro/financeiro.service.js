import mongoose from 'mongoose'
import AgendaModel from '../agenda/agenda.model.js'
import CobrancaModel from '../cobranca/cobranca.model.js'
import ConvenioModel, { pagaOPlano } from '../convenio/convenio.model.js'
import ComissaoPagamentoModel from '../comissao/comissao-pagamento.model.js'
import DespesaModel from './despesa.model.js'
import {
    PERIODOS, hojeDiaPuro, inicioDoPeriodoDiaPuro, fimDoPeriodoDiaPuro, diaPuroDe, instanteDeBrasilia,
} from '../shared/utils/dia-puro.js'

// Financeiro da clínica (só a dona): faturamento, recebimentos, despesas, repasses, lucro e o extrato do período.
//  - Faturamento (competência): valor dos atendimentos realizados no período, pela data da consulta.
//  - Recebido (caixa): pagamentos registrados no período (do atendimento ou da parcela do pacote), pela hora do registro.
//  - Lucro = faturamento − repasses dos atendimentos do período − despesas do período.

// Formas de pagamento registradas no agendamento (as mesmas da tela de agendar).
export const FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito']

// O extrato de um ano inteiro pode ser grande: acima disso, a tela avisa para escolher um período menor.
const LIMITE_EXTRATO = 3000

const oid = (id) => new mongoose.Types.ObjectId(String(id))

function arredondar(valor) {
    return Math.round((valor ?? 0) * 100) / 100
}

function horaDeBrasilia(instante) {
    return new Date(instante).toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}

// Período pedido na tela: diario, semanal, mensal ou anual, contendo o dia `data` (padrão: hoje).
export function periodoDaConsulta(query = {}) {
    const chave = PERIODOS.includes(query.periodo) ? query.periodo : 'mensal'
    const referencia = diaPuroDe(query.data) ?? hojeDiaPuro()
    const inicio = inicioDoPeriodoDiaPuro(chave, referencia)
    const fim = fimDoPeriodoDiaPuro(chave, inicio)
    return { chave, inicio, fim }
}

// O período imediatamente anterior, para comparar (mês passado, ano passado...).
function periodoAnterior({ chave, inicio }) {
    const referencia = new Date(inicio.getTime() - 24 * 60 * 60 * 1000)
    const inicioAnterior = inicioDoPeriodoDiaPuro(chave, referencia)
    return { chave, inicio: inicioAnterior, fim: inicio }
}

// Quanto do valor do atendimento entrou em cada forma. Nas sessões de um pacote as formas guardam o total do pacote:
// cada sessão fica com a sua parte, na mesma proporção entre as formas.
function formasDoAtendimento(agenda) {
    const formas = agenda.financeiro?.formasPagamento ?? []
    const soma = formas.reduce((s, f) => s + (Number(f.valor) || 0), 0)
    const valor = agenda.financeiro?.valor ?? 0
    if (!soma || !valor) return []
    return formas.map((f) => ({ tipo: f.tipo, valor: arredondar(valor * ((Number(f.valor) || 0) / soma)) }))
}

// Situação do pagamento de um atendimento realizado.
//  pago | a_receber | convenio (o plano paga à clínica) | gratuito | pacote (cobrança à vista ou parcelada à parte)
function situacaoDoAtendimento(agenda, planoPaga, cobranca) {
    const valor = agenda.financeiro?.valor ?? 0
    if (cobranca) {
        const pagas = cobranca.parcelas.filter((p) => p.pagoEm).length
        return { situacao: 'pacote', parcelas: { pagas, total: cobranca.parcelas.length } }
    }
    if (planoPaga) {
        const copart = agenda.financeiro?.coparticipacao ?? 0
        return { situacao: 'convenio', coparticipacao: copart, coparticipacaoPaga: copart > 0 && !!agenda.financeiro?.pagoEm }
    }
    if (!valor) return { situacao: 'gratuito' }
    return { situacao: agenda.financeiro?.pagoEm ? 'pago' : 'a_receber' }
}

// Faturamento, repasses e despesas de um período, só em números (para comparar com o período anterior).
async function numerosDoPeriodo(tenantId, { inicio, fim }) {
    const [[atendimentos], [despesas]] = await Promise.all([
        AgendaModel.aggregate([
            { $match: { tenantId, status: 'realizado', data: { $gte: inicio, $lt: fim } } },
            { $group: { _id: null, faturamento: { $sum: { $ifNull: ['$financeiro.valor', 0] } }, repasse: { $sum: { $ifNull: ['$comissao.valor', 0] } } } },
        ]),
        DespesaModel.aggregate([
            { $match: { tenantId, data: { $gte: inicio, $lt: fim } } },
            { $group: { _id: null, total: { $sum: '$valor' } } },
        ]),
    ])
    const faturamento = arredondar(atendimentos?.faturamento)
    const repasse = arredondar(atendimentos?.repasse)
    const despesa = arredondar(despesas?.total)
    return { faturamento, lucro: arredondar(faturamento - repasse - despesa) }
}

// Recebimentos registrados no período (caixa): atendimentos sem pacote e parcelas de pacotes.
async function recebidoNoPeriodo(tenantId, { inicio, fim }) {
    const desde = instanteDeBrasilia(inicio)
    const ate = instanteDeBrasilia(fim)
    const [[atendimentos], [parcelas]] = await Promise.all([
        AgendaModel.aggregate([
            { $match: { tenantId, cobrancaId: null, 'financeiro.pagoEm': { $gte: desde, $lt: ate } } },
            {
                $group: {
                    _id: null,
                    // Pelo convênio, o paciente paga só a coparticipação.
                    total: { $sum: { $cond: [{ $gt: ['$financeiro.coparticipacao', 0] }, '$financeiro.coparticipacao', { $ifNull: ['$financeiro.valor', 0] }] } },
                    quantidade: { $sum: 1 },
                },
            },
        ]),
        CobrancaModel.aggregate([
            { $match: { tenantId, 'parcelas.pagoEm': { $gte: desde, $lt: ate } } },
            { $unwind: '$parcelas' },
            { $match: { 'parcelas.pagoEm': { $gte: desde, $lt: ate } } },
            { $group: { _id: null, total: { $sum: '$parcelas.valor' }, quantidade: { $sum: 1 } } },
        ]),
    ])
    return {
        total: arredondar((atendimentos?.total ?? 0) + (parcelas?.total ?? 0)),
        quantidade: (atendimentos?.quantidade ?? 0) + (parcelas?.quantidade ?? 0),
    }
}

export const FinanceiroService = {

    async painel(tenantIdBruto, query) {
        const tenantId = oid(tenantIdBruto)
        const periodo = periodoDaConsulta(query)
        const { inicio, fim } = periodo
        const hoje = hojeDiaPuro()

        const [agendas, convenios, despesas, repassesPagos, recebido, anterior] = await Promise.all([
            AgendaModel.find({ tenantId, status: 'realizado', data: { $gte: inicio, $lt: fim } })
                .select('data horaInicio horaFim pacienteId profissionalId servicoId convenioId financeiro comissao cobrancaId importado')
                .populate('pacienteId', 'nome')
                .populate('profissionalId', 'nome')
                .populate('servicoId', 'nome')
                .populate('financeiro.recebidoPor', 'nomeCompleto role')
                .sort({ data: -1, horaInicio: -1 })
                .lean(),
            ConvenioModel.find({ tenantId }, 'nome quemPaga').lean(),
            DespesaModel.find({ tenantId, data: { $gte: inicio, $lt: fim } })
                .populate('criadoPor', 'nomeCompleto')
                .populate('pagoPor', 'nomeCompleto')
                .sort({ data: -1, createdAt: -1 })
                .lean(),
            ComissaoPagamentoModel.find({ tenantId, createdAt: { $gte: instanteDeBrasilia(inicio), $lt: instanteDeBrasilia(fim) } })
                .populate('profissionalId', 'nome')
                .populate('pagoPor', 'nomeCompleto')
                .sort({ createdAt: -1 })
                .lean(),
            recebidoNoPeriodo(tenantId, periodo),
            numerosDoPeriodo(tenantId, periodoAnterior(periodo)),
        ])

        const convenioPorId = new Map(convenios.map((c) => [String(c._id), c]))
        const idsCobranca = [...new Set(agendas.filter((a) => a.cobrancaId).map((a) => String(a.cobrancaId)))]
        const cobrancas = idsCobranca.length
            ? await CobrancaModel.find({ _id: { $in: idsCobranca }, tenantId }, 'modo parcelas').lean()
            : []
        const cobrancaPorId = new Map(cobrancas.map((c) => [String(c._id), c]))

        // Atendimentos: totais, formas de pagamento e o que falta receber
        const formas = Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0]))
        Object.assign(formas, { outras: 0, convenio: 0, pacote: 0, semForma: 0 })
        const aReceber = { total: 0, quantidade: 0 }
        let faturamento = 0
        let repasse = 0
        let repasseJaPago = 0

        const entradas = agendas.map((agenda) => {
            const valor = agenda.financeiro?.valor ?? 0
            const convenio = agenda.convenioId ? convenioPorId.get(String(agenda.convenioId)) : null
            const planoPaga = pagaOPlano(convenio)
            const cobranca = agenda.cobrancaId ? cobrancaPorId.get(String(agenda.cobrancaId)) : null
            const formasAtendimento = formasDoAtendimento(agenda)
            const situacao = situacaoDoAtendimento(agenda, planoPaga, cobranca)

            faturamento += valor
            repasse += agenda.comissao?.valor ?? 0
            if (agenda.comissao?.pagamentoId) repasseJaPago += agenda.comissao?.valor ?? 0

            if (formasAtendimento.length) {
                for (const f of formasAtendimento) {
                    if (f.tipo in formas && FORMAS_PAGAMENTO.includes(f.tipo)) formas[f.tipo] += f.valor
                    else formas.outras += f.valor
                }
            } else if (planoPaga) formas.convenio += valor
            else if (cobranca) formas.pacote += valor
            else formas.semForma += valor

            if (situacao.situacao === 'a_receber') {
                aReceber.total += valor
                aReceber.quantidade += 1
            }

            const recebidoPor = agenda.financeiro?.recebidoPor
            return {
                _id: agenda._id,
                tipo: 'entrada',
                origem: 'atendimento',
                data: agenda.data,
                hora: agenda.horaInicio,
                paciente: agenda.pacienteId?.nome ?? null,
                servico: agenda.servicoId?.nome ?? null,
                profissional: agenda.profissionalId?.nome ?? null,
                convenio: convenio?.nome ?? null,
                valor: arredondar(valor),
                formas: formasAtendimento,
                ...situacao,
                pagoEm: agenda.financeiro?.pagoEm ?? null,
                recebidoPor: recebidoPor ? { nome: recebidoPor.nomeCompleto, papel: recebidoPor.role } : null,
                repasse: arredondar(agenda.comissao?.valor),
                importado: !!agenda.importado,
            }
        })

        // Despesas do período
        const despesasPorCategoria = new Map()
        const totaisDespesa = { total: 0, pagas: 0, aPagar: 0, vencidas: 0, quantidade: despesas.length }
        const saidasDespesa = despesas.map((d) => {
            totaisDespesa.total += d.valor
            if (d.pagoEm) totaisDespesa.pagas += d.valor
            else {
                totaisDespesa.aPagar += d.valor
                if (d.data < hoje) totaisDespesa.vencidas += 1
            }
            despesasPorCategoria.set(d.categoria, (despesasPorCategoria.get(d.categoria) ?? 0) + d.valor)
            return {
                _id: d._id,
                tipo: 'saida',
                origem: 'despesa',
                data: d.data,
                hora: null,
                descricao: d.descricao,
                categoria: d.categoria,
                fornecedor: d.fornecedor || null,
                observacao: d.observacao || null,
                valor: arredondar(d.valor),
                formaPagamento: d.formaPagamento ?? null,
                situacao: d.pagoEm ? 'pago' : (d.data < hoje ? 'vencida' : 'a_pagar'),
                pagoEm: d.pagoEm ?? null,
                pagoPor: d.pagoPor?.nomeCompleto ?? null,
                lancadoPor: d.criadoPor?.nomeCompleto ?? null,
                recorrente: !!d.grupoRecorrenciaId,
            }
        })

        // Repasses pagos no período (saem do caixa no dia do pagamento)
        const saidasRepasse = repassesPagos.map((p) => ({
            _id: p._id,
            tipo: 'saida',
            origem: 'repasse',
            data: hojeDiaPuro(p.createdAt),
            hora: horaDeBrasilia(p.createdAt),
            profissional: p.profissionalId?.nome ?? null,
            quantidade: p.quantidade,
            valor: arredondar(p.valor),
            situacao: 'pago',
            pagoEm: p.createdAt,
            pagoPor: p.pagoPor?.nomeCompleto ?? null,
        }))

        const extrato = [...entradas, ...saidasDespesa, ...saidasRepasse].sort((a, b) =>
            new Date(b.data) - new Date(a.data) || String(b.hora ?? '').localeCompare(String(a.hora ?? '')))

        const lucro = faturamento - repasse - totaisDespesa.total
        const atendimentos = agendas.length

        return {
            periodo: { chave: periodo.chave, inicio, fim: new Date(fim.getTime() - 24 * 60 * 60 * 1000) },
            resumo: {
                atendimentos,
                faturamento: arredondar(faturamento),
                ticketMedio: atendimentos ? arredondar(faturamento / atendimentos) : 0,
                recebido,
                aReceber: { total: arredondar(aReceber.total), quantidade: aReceber.quantidade },
                repasse: { total: arredondar(repasse), pago: arredondar(repasseJaPago), pendente: arredondar(repasse - repasseJaPago) },
                repassesPagosNoPeriodo: arredondar(repassesPagos.reduce((s, p) => s + p.valor, 0)),
                despesas: {
                    total: arredondar(totaisDespesa.total),
                    pagas: arredondar(totaisDespesa.pagas),
                    aPagar: arredondar(totaisDespesa.aPagar),
                    vencidas: totaisDespesa.vencidas,
                    quantidade: totaisDespesa.quantidade,
                },
                lucro: arredondar(lucro),
                margem: faturamento > 0 ? Math.round((lucro / faturamento) * 1000) / 10 : null,
                anterior,
            },
            formasPagamento: Object.fromEntries(Object.entries(formas).map(([k, v]) => [k, arredondar(v)])),
            despesasPorCategoria: [...despesasPorCategoria]
                .map(([categoria, total]) => ({ categoria, total: arredondar(total) }))
                .sort((a, b) => b.total - a.total),
            extrato: extrato.slice(0, LIMITE_EXTRATO),
            extratoCortado: extrato.length > LIMITE_EXTRATO,
        }
    },
}
