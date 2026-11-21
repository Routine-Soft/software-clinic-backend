import mongoose from 'mongoose'
import UserModel from './user.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import EspecialidadeModel from '../especialidade/especialidade.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import ServicoModel from '../servico/servico.model.js'
import { FORMAS_PAGAMENTO } from '../financeiro/financeiro.service.js'
import { hojeDiaPuro, inicioDoPeriodoDiaPuro, PERIODOS } from '../shared/utils/dia-puro.js'
import AppError from '../../errors/AppError.js'

// Visão só do super_admin sobre o uso de cada clínica: profissões (sem nomes de profissionais), atendimentos,
// preço das consultas, faturamento e repasses. Nenhum dado de paciente sai daqui.

const SEM_ESPECIALIDADE = 'Sem especialidade'

// Profissão de cada profissional = a primeira especialidade do cadastro (quem tem duas conta uma vez só,
// para a soma dos profissionais bater com o total da clínica).
async function profissaoPorProfissional(tenantIds) {
    const [profissionais, especialidades] = await Promise.all([
        ProfissionalModel.find({ tenantId: { $in: tenantIds } }, 'especialidadeIds tenantId').lean(),
        EspecialidadeModel.find({ tenantId: { $in: tenantIds } }, 'nome').lean(),
    ])
    const nomeEspecialidade = new Map(especialidades.map((e) => [String(e._id), e.nome]))
    return profissionais.map((p) => ({
        _id: p._id,
        tenantId: p.tenantId,
        profissao: nomeEspecialidade.get(String(p.especialidadeIds?.[0])) ?? SEM_ESPECIALIDADE,
    }))
}

function ordenarPorQuantidade(lista) {
    return lista.sort((a, b) => b.profissionais - a.profissionais || a.profissao.localeCompare(b.profissao))
}

// Para a lista de clínicas: quantos profissionais de cada profissão cada clínica tem.
export async function profissoesPorTenant(tenantIds) {
    const profissionais = await profissaoPorProfissional(tenantIds)
    const porTenant = new Map()
    for (const { tenantId, profissao } of profissionais) {
        const chave = String(tenantId)
        const contagem = porTenant.get(chave) ?? new Map()
        contagem.set(profissao, (contagem.get(profissao) ?? 0) + 1)
        porTenant.set(chave, contagem)
    }
    return (tenantId) => ordenarPorQuantidade(
        [...(porTenant.get(String(tenantId)) ?? new Map())].map(([profissao, profissionais]) => ({ profissao, profissionais }))
    )
}

function arredondar(valor) {
    return Math.round((valor ?? 0) * 100) / 100
}

// "2026-11" a partir de uma data dia puro (meia-noite UTC).
function chaveMes(data) {
    return data.toISOString().slice(0, 7)
}


// Faturamento de hoje, desta semana (domingo a sábado), deste mês e deste ano, com quanto entrou em cada forma de
// pagamento (a registrada ao agendar). O que não tem forma (convênio pago pelo plano, cobrança de pacote à vista ou
// parcelada, consulta importada) fica em `semForma`.
async function faturamentoPorPeriodo(tenantId, hoje) {
    const inicios = Object.fromEntries(PERIODOS.map((p) => [p, inicioDoPeriodoDiaPuro(p, hoje)]))
    const desde = new Date(Math.min(...Object.values(inicios).map((d) => d.getTime())))
    const match = { tenantId, status: 'realizado', data: { $gte: desde } }

    const [porDia, formasPorDia] = await Promise.all([
        AgendaModel.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$data',
                    atendimentos: { $sum: 1 },
                    faturamento: { $sum: { $ifNull: ['$financeiro.valor', 0] } },
                    repasse: { $sum: { $ifNull: ['$comissao.valor', 0] } },
                },
            },
        ]),
        AgendaModel.aggregate([
            { $match: match },
            // Nas sessões de um pacote, as formas guardam o total do pacote: cada sessão conta só a parte dela,
            // na mesma proporção entre as formas.
            { $addFields: { somaFormas: { $sum: '$financeiro.formasPagamento.valor' } } },
            { $match: { somaFormas: { $gt: 0 } } },
            { $unwind: '$financeiro.formasPagamento' },
            {
                $group: {
                    _id: { data: '$data', tipo: '$financeiro.formasPagamento.tipo' },
                    valor: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ['$financeiro.valor', 0] },
                                { $divide: [{ $ifNull: ['$financeiro.formasPagamento.valor', 0] }, '$somaFormas'] },
                            ],
                        },
                    },
                },
            },
        ]),
    ])

    const resultado = {}
    for (const periodo of PERIODOS) {
        const inicio = inicios[periodo].getTime()
        const noPeriodo = (data) => new Date(data).getTime() >= inicio
        const linha = { inicio: inicios[periodo], atendimentos: 0, faturamento: 0, repasse: 0 }
        for (const d of porDia.filter((d) => noPeriodo(d._id))) {
            linha.atendimentos += d.atendimentos
            linha.faturamento += d.faturamento
            linha.repasse += d.repasse
        }
        const formas = Object.fromEntries(FORMAS_PAGAMENTO.map((f) => [f, 0]))
        let outras = 0
        for (const f of formasPorDia.filter((f) => noPeriodo(f._id.data))) {
            if (f._id.tipo in formas) formas[f._id.tipo] += f.valor
            else outras += f.valor
        }
        const somaFormas = Object.values(formas).reduce((a, b) => a + b, 0) + outras
        resultado[periodo] = {
            ...linha,
            faturamento: arredondar(linha.faturamento),
            repasse: arredondar(linha.repasse),
            ticketMedio: linha.atendimentos ? arredondar(linha.faturamento / linha.atendimentos) : 0,
            formasPagamento: {
                ...Object.fromEntries(Object.entries(formas).map(([k, v]) => [k, arredondar(v)])),
                outras: arredondar(outras),
                semForma: arredondar(Math.max(0, linha.faturamento - somaFormas)),
            },
        }
    }
    return resultado
}

export const ClinicaMetricasService = {

    async obter(id) {
        if (!mongoose.isValidObjectId(id)) {
            throw new AppError('Administrador não encontrado', 404)
        }
        const admin = await UserModel.findOne({ _id: id, role: 'admin' }, '_id').lean()
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }
        const tenantId = admin._id

        const hoje = hojeDiaPuro()
        const inicio12Meses = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 11, 1))

        const [profissionais, porProfissional, porServico, porMes, servicos, periodos] = await Promise.all([
            profissaoPorProfissional([tenantId]),
            AgendaModel.aggregate([
                { $match: { tenantId } },
                {
                    $group: {
                        _id: { profissionalId: '$profissionalId', status: '$status' },
                        total: { $sum: 1 },
                        valor: { $sum: { $ifNull: ['$financeiro.valor', 0] } },
                        repasse: { $sum: { $ifNull: ['$comissao.valor', 0] } },
                        repassePago: {
                            $sum: { $cond: [{ $ifNull: ['$comissao.pagamentoId', false] }, { $ifNull: ['$comissao.valor', 0] }, 0] },
                        },
                    },
                },
            ]),
            AgendaModel.aggregate([
                { $match: { tenantId, status: 'realizado' } },
                {
                    $group: {
                        _id: '$servicoId',
                        atendimentos: { $sum: 1 },
                        faturamento: { $sum: { $ifNull: ['$financeiro.valor', 0] } },
                        repasse: { $sum: { $ifNull: ['$comissao.valor', 0] } },
                    },
                },
            ]),
            AgendaModel.aggregate([
                { $match: { tenantId, status: 'realizado', data: { $gte: inicio12Meses } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$data' } },
                        atendimentos: { $sum: 1 },
                        faturamento: { $sum: { $ifNull: ['$financeiro.valor', 0] } },
                        repasse: { $sum: { $ifNull: ['$comissao.valor', 0] } },
                    },
                },
            ]),
            ServicoModel.find({ tenantId }, 'nome tipo preco').lean(),
            faturamentoPorPeriodo(tenantId, hoje),
        ])

        // Por profissão
        const profissaoDe = new Map(profissionais.map((p) => [String(p._id), p.profissao]))
        const profissoes = new Map()
        const linhaDe = (profissao) => {
            if (!profissoes.has(profissao)) {
                profissoes.set(profissao, {
                    profissao,
                    profissionais: 0,
                    atendimentos: { realizados: 0, agendados: 0, faltas: 0, cancelados: 0 },
                    faturamento: 0,
                    repasse: 0,
                    repassePago: 0,
                })
            }
            return profissoes.get(profissao)
        }
        for (const p of profissionais) linhaDe(p.profissao).profissionais += 1

        const campoStatus = { realizado: 'realizados', aguardando: 'agendados', faltou: 'faltas', cancelado: 'cancelados' }
        for (const { _id, total, valor, repasse, repassePago } of porProfissional) {
            // Profissional apagado: os atendimentos dele continuam contando, sob "Sem especialidade".
            const linha = linhaDe(profissaoDe.get(String(_id.profissionalId)) ?? SEM_ESPECIALIDADE)
            const campo = campoStatus[_id.status]
            if (campo) linha.atendimentos[campo] += total
            if (_id.status === 'realizado') {
                linha.faturamento += valor
                linha.repasse += repasse
                linha.repassePago += repassePago
            }
        }

        const listaProfissoes = ordenarPorQuantidade([...profissoes.values()]).map((l) => ({
            ...l,
            faturamento: arredondar(l.faturamento),
            repasse: arredondar(l.repasse),
            repassePago: arredondar(l.repassePago),
            repassePendente: arredondar(l.repasse - l.repassePago),
            ticketMedio: l.atendimentos.realizados ? arredondar(l.faturamento / l.atendimentos.realizados) : 0,
            atendimentosPorProfissional: l.profissionais ? arredondar(l.atendimentos.realizados / l.profissionais) : 0,
        }))

        // Preço de cada consulta (serviço): o de tabela e a média do que foi cobrado de fato
        const usoServico = new Map(porServico.map((s) => [String(s._id), s]))
        const listaServicos = servicos.map((s) => {
            const uso = usoServico.get(String(s._id))
            return {
                nome: s.nome,
                tipo: s.tipo,
                precoTabela: arredondar(s.preco),
                atendimentos: uso?.atendimentos ?? 0,
                precoMedioCobrado: uso?.atendimentos ? arredondar(uso.faturamento / uso.atendimentos) : 0,
                faturamento: arredondar(uso?.faturamento),
                repasse: arredondar(uso?.repasse),
            }
        }).sort((a, b) => b.atendimentos - a.atendimentos || a.nome.localeCompare(b.nome))

        // Faturamento mês a mês (últimos 12 meses, incluindo os sem atendimento)
        const mesPorChave = new Map(porMes.map((m) => [m._id, m]))
        const meses = []
        for (let i = 0; i < 12; i++) {
            const chave = chaveMes(new Date(Date.UTC(inicio12Meses.getUTCFullYear(), inicio12Meses.getUTCMonth() + i, 1)))
            const m = mesPorChave.get(chave)
            meses.push({
                mes: chave,
                atendimentos: m?.atendimentos ?? 0,
                faturamento: arredondar(m?.faturamento),
                repasse: arredondar(m?.repasse),
            })
        }

        const total = listaProfissoes.reduce((acc, l) => ({
            atendimentos: acc.atendimentos + l.atendimentos.realizados,
            faturamento: arredondar(acc.faturamento + l.faturamento),
            repasse: arredondar(acc.repasse + l.repasse),
        }), { atendimentos: 0, faturamento: 0, repasse: 0 })

        return {
            // Faturamento = soma do valor dos atendimentos realizados (pela data da consulta).
            faturamento: {
                total,
                ticketMedio: total.atendimentos ? arredondar(total.faturamento / total.atendimentos) : 0,
                meses,
                // Filtro da tela: diario, semanal, mensal e anual (período atual de cada um).
                periodos,
            },
            profissoes: listaProfissoes,
            servicos: listaServicos,
        }
    },
}
