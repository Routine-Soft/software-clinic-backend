import mongoose from 'mongoose'
import AgendaModel from './agenda.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import ServicoModel from '../servico/servico.model.js'
import CobrancaModel from '../cobranca/cobranca.model.js'
import ConvenioModel, { pagaOPlano } from '../convenio/convenio.model.js'
import UserModel from '../user/user.model.js'
import { createAgendaDTO, updateAgendaDTO } from './agenda.dto.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import { regraDoServico, calcularComissao } from '../servico/servico.regras.js'
import { AcompanhamentoService } from '../paciente/acompanhamento.service.js'
import AppError from '../../errors/AppError.js'

const COMISSAO_PAGA = 'O repasse deste atendimento já foi pago ao profissional'

// Quem pode confirmar um atendimento na clínica em que a recepção confirma. É um controle sobre o repasse, por isso
// o profissional não confirma o próprio atendimento (o médico dono da clínica entra como admin).
const QUEM_CONFIRMA = ['admin', 'recepcao', 'super_admin']

const LEMBRETE_VAZIO = { enviadoEm: null, mensagemId: null, situacao: null, erro: null, resposta: null, respondidoEm: null }

async function buscarCompleta(id, tenantId) {
    return await AgendaModel.findOne({ _id: id, tenantId })
        .populate('pacienteId')
        .populate('profissionalId')
        .populate('salaId')
        .populate('servicoId')
        .populate('convenioId')
        .populate('cobrancaId')
}

// As datas dos agendamentos são "dia puro" gravado como meia-noite UTC. Por isso o dia da semana e o
// avanço de dia usam métodos UTC: com getDay()/setDate() locais, num fuso negativo (Brasil) a meia-noite
// UTC cai na noite do dia anterior e a série sai um dia deslocada (escolhe quarta, cria quinta).
function gerarDatasRecorrencia(dataInicio, dataFim, diasSemana) {
    const datas = []
    const atual = new Date(dataInicio)
    const fim = new Date(dataFim)

    while (atual <= fim) {
        if (diasSemana.includes(atual.getUTCDay())) {
            datas.push(new Date(atual))
        }
        atual.setUTCDate(atual.getUTCDate() + 1)
    }

    return datas
}

// As sessões de uma série: as próximas `quantas` datas nos dias da semana escolhidos, a partir da data inicial.
function gerarDatasDasSessoes(dataInicio, quantas, diasSemana) {
    const datas = []
    const atual = new Date(dataInicio)

    while (datas.length < quantas) {
        if (diasSemana.includes(atual.getUTCDay())) {
            datas.push(new Date(atual))
        }
        atual.setUTCDate(atual.getUTCDate() + 1)
    }

    return datas
}

// Divide o total em partes iguais, em centavos; o que sobra do arredondamento fica na última.
function dividirValor(total, partes) {
    const centavos = Math.round(Number(total) * 100)
    const parte = Math.floor(centavos / partes)
    return Array.from({ length: partes }, (_, i) => (i === partes - 1 ? centavos - parte * (partes - 1) : parte) / 100)
}

// Mesmo dia do mês seguinte; se o mês não tiver esse dia, o último dia dele.
function somarMeses(data, meses) {
    const base = new Date(data)
    const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses + 1, 0)).getUTCDate()
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, Math.min(base.getUTCDate(), ultimoDia)))
}

// O plano paga o atendimento: o paciente só deve a coparticipação, se houver.
async function regraDoConvenio(convenioId, tenantId) {
    const convenio = convenioId ? await ConvenioModel.findOne({ _id: convenioId, tenantId }).lean() : null
    const plano = pagaOPlano(convenio)
    return { plano, coparticipacao: plano ? (convenio.coparticipacao ?? 0) : 0 }
}

async function criarCobranca({ modo, total, parcelas, vencimento, grupoRecorrenciaId, tenantId }) {
    const quantas = modo === 'avista' ? 1 : parcelas
    if (modo === 'parcelado' && (!Number.isInteger(quantas) || quantas < 1 || quantas > 120)) {
        throw new AppError('Informe a quantidade de parcelas', 400)
    }
    const valores = dividirValor(total, quantas)
    return await CobrancaModel.create({
        modo,
        total,
        grupoRecorrenciaId,
        tenantId,
        parcelas: valores.map((valor, i) => ({ numero: i + 1, valor, vencimento: somarMeses(vencimento, i) })),
    })
}

// Atendimento realizado: gera a comissão (repasse) pendente do profissional, com a regra que o serviço tem agora.
// `agenda` precisa vir com o servicoId populado.
function marcarComoRealizado(agenda) {
    agenda.status = 'realizado'
    agenda.realizadoEm = new Date()
    const regra = regraDoServico(agenda.servicoId, agenda.convenioId)
    agenda.comissao = {
        valor: calcularComissao(regra, agenda.financeiro?.valor),
        percentual: regra.comissaoTipo === 'percentual' ? regra.comissao : null,
        pagamentoId: null,
    }
}

function voltarParaAguardando(agenda) {
    agenda.status = 'aguardando'
    agenda.realizadoEm = null
    agenda.comissao = { valor: 0, percentual: null, pagamentoId: null }
}

// Agendamento que o usuário pode marcar como realizado ou falta, com o servicoId populado.
async function agendaParaConfirmar(id, usuario) {
    const { tenantId } = usuario
    const agenda = await AgendaModel.findOne({ _id: id, tenantId }).populate('servicoId')
    if (!agenda) {
        throw new AppError('Agendamento não encontrado', 404)
    }

    const clinica = await UserModel.findById(tenantId, 'confirmacaoAtendimento').lean()
    if (clinica?.confirmacaoAtendimento === 'recepcao') {
        if (!QUEM_CONFIRMA.includes(usuario.role)) {
            throw new AppError('Nesta clínica, o atendimento é confirmado pela recepção ou pela administração', 403)
        }
    } else if (usuario.role === 'profissional') {
        const doProprio = await ProfissionalModel.exists({ _id: agenda.profissionalId, tenantId, usuarioId: usuario.id })
        if (!doProprio) {
            throw new AppError('Você só pode marcar os seus próprios atendimentos', 403)
        }
    }
    return agenda
}

export const AgendaService = {
    async findAll(tenantId, filtros = {}) {
        const query = { tenantId }

        if (filtros.profissionalId) {
            query.profissionalId = filtros.profissionalId
        }

        if (filtros.dataInicio && filtros.dataFim) {
            query.data = { $gte: new Date(filtros.dataInicio), $lte: new Date(filtros.dataFim) }
        }

        return await AgendaModel.find(query)
            .populate('pacienteId')
            .populate('profissionalId')
            .populate('salaId')
            .populate('servicoId')
            .populate('convenioId')
            .populate('cobrancaId')
            .sort({ data: 1, horaInicio: 1 })
    },

    async findById(id, tenantId) {
        const agenda = await buscarCompleta(id, tenantId)

        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        return agenda
    },

    async createAgenda(body, tenantId) {
        const agendaDTO = createAgendaDTO(body)
        const { plano, coparticipacao } = await regraDoConvenio(agendaDTO.convenioId, tenantId)
        agendaDTO.financeiro.coparticipacao = coparticipacao
        if (plano) {
            agendaDTO.financeiro.formasPagamento = []
            agendaDTO.financeiro.parcelamento = 1
        }

        if (!body.repetir) {
            const agenda = await AgendaModel.create({ ...agendaDTO, tenantId })
            await AcompanhamentoService.registrarConsulta(tenantId, agenda.pacienteId, agenda.profissionalId, agenda.data)
            return agenda
        }

        const { diasSemana, dataFim } = body.repetir
        const servico = await ServicoModel.findOne({ _id: agendaDTO.servicoId, tenantId }, 'tipo qtdDias').lean()
        // Serviço por sessões: a quantidade vem da receita do paciente e é escolhida ao agendar.
        const sessoes = servico?.tipo === 'pacote' ? Number(body.repetir.sessoes ?? servico.qtdDias) : null
        if (servico?.tipo === 'pacote' && (!Number.isInteger(sessoes) || sessoes < 1 || sessoes > 200)) {
            throw new AppError('Informe a quantidade de sessões', 400)
        }
        if (sessoes && !diasSemana?.length) {
            throw new AppError('Escolha os dias da semana das sessões', 400)
        }
        const datas = sessoes ? gerarDatasDasSessoes(agendaDTO.data, sessoes, diasSemana) : gerarDatasRecorrencia(agendaDTO.data, dataFim, diasSemana)

        if (datas.length === 0) {
            throw new AppError('Nenhuma data válida encontrada para a recorrência informada', 400)
        }

        const grupoRecorrenciaId = new mongoose.Types.ObjectId()

        // O total da série vem da tela (sessões × preço, com desconto se houver): cada sessão fica com a sua parte,
        // e é sobre ela que o repasse é calculado.
        const total = Number(agendaDTO.financeiro.valor)
        const valores = sessoes ? dividirValor(total, sessoes) : null
        const modo = plano ? 'sessao' : (body.financeiro.modoPagamento ?? 'sessao')
        if (sessoes && !['avista', 'sessao', 'parcelado'].includes(modo)) {
            throw new AppError('Forma de pagar as sessões inválida', 400)
        }
        const cobranca = sessoes && total > 0 && modo !== 'sessao'
            ? await criarCobranca({ modo, total, parcelas: Number(agendaDTO.financeiro.parcelamento), vencimento: agendaDTO.financeiro.vencimento, grupoRecorrenciaId, tenantId })
            : null

        const documentos = datas.map((data, i) => ({
            ...agendaDTO,
            data,
            tenantId,
            grupoRecorrenciaId,
            cobrancaId: cobranca?._id ?? null,
            financeiro: sessoes
                ? { ...agendaDTO.financeiro, valor: valores[i], vencimento: data, parcelamento: cobranca?.parcelas.length ?? 1 }
                : agendaDTO.financeiro,
        }))

        const agendas = await AgendaModel.insertMany(documentos)
        await AcompanhamentoService.registrarConsulta(tenantId, agendaDTO.pacienteId, agendaDTO.profissionalId, datas[0])
        return agendas
    },

    async updateAgenda(id, tenantId, body) {
        const agendaDTO = updateAgendaDTO(body)

        // A comissão de um atendimento realizado foi calculada com o profissional, o serviço, o convênio e o valor
        // dele; trocar qualquer um deixaria a comissão errada.
        const atual = await AgendaModel.findOne({ _id: id, tenantId })
        if (!atual) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        const trocaRegra = ['profissionalId', 'servicoId', 'convenioId'].some((campo) => campo in agendaDTO && String(agendaDTO[campo] ?? null) !== String(atual[campo] ?? null))
        const trocaValor = 'financeiro' in agendaDTO && Number(agendaDTO.financeiro?.valor) !== Number(atual.financeiro?.valor)
        if (atual.status === 'realizado' && (trocaRegra || trocaValor)) {
            throw new AppError('Desmarque o atendimento como realizado antes de trocar o profissional, o serviço, o convênio ou o valor', 409)
        }

        // Lembrete já enviado vale para o horário antigo: com outro dia, horário ou paciente, um novo será enviado.
        const trocaDia = 'data' in agendaDTO && new Date(agendaDTO.data).getTime() !== atual.data?.getTime()
        const trocaHorario = trocaDia || ['horaInicio', 'pacienteId'].some((campo) => campo in agendaDTO && String(agendaDTO[campo] ?? null) !== String(atual[campo] ?? null))
        const alteracoes = trocaHorario ? { ...agendaDTO, lembrete: LEMBRETE_VAZIO } : { ...agendaDTO }
        // Editar o agendamento não mexe no pagamento: isso só muda por marcarPagamento.
        if (alteracoes.financeiro) {
            const trocaConvenio = 'convenioId' in agendaDTO && String(agendaDTO.convenioId ?? null) !== String(atual.convenioId ?? null)
            const coparticipacao = trocaConvenio
                ? (await regraDoConvenio(agendaDTO.convenioId, tenantId)).coparticipacao
                : (atual.financeiro?.coparticipacao ?? 0)
            alteracoes.financeiro = { ...alteracoes.financeiro, pagoEm: atual.financeiro?.pagoEm ?? null, coparticipacao }
        }

        const agenda = await AgendaModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: alteracoes },
            { new: true, runValidators: true }
        )

        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        // Trocou o paciente ou o profissional: o novo par também passa a constar como acompanhamento.
        if (agenda.status !== 'cancelado') {
            await AcompanhamentoService.registrarConsulta(tenantId, agenda.pacienteId, agenda.profissionalId, agenda.data)
        }

        return agenda
    },

    // Marca (ou desmarca) o atendimento como realizado. Marcar gera a comissão pendente do profissional, com o valor
    // que o serviço tem agora; desmarcar só é possível enquanto essa comissão não foi paga.
    async definirRealizado(id, usuario, realizado) {
        const agenda = await agendaParaConfirmar(id, usuario)

        if (realizado) {
            if (agenda.status === 'cancelado') {
                throw new AppError('Um agendamento cancelado não pode ser marcado como realizado', 400)
            }
            if (agenda.data > hojeDiaPuro()) {
                throw new AppError('Só é possível marcar como realizado a partir do dia do atendimento', 400)
            }
            if (agenda.status !== 'realizado') marcarComoRealizado(agenda)
        } else if (agenda.status === 'realizado') {
            if (agenda.comissao?.pagamentoId) {
                throw new AppError(`${COMISSAO_PAGA}; não dá para desmarcar`, 409)
            }
            voltarParaAguardando(agenda)
        }

        await agenda.save()
        return await buscarCompleta(agenda._id, usuario.tenantId)
    },

    // Paciente não veio: diferente de cancelado, e sem repasse para o profissional.
    async definirFalta(id, usuario, faltou) {
        const agenda = await agendaParaConfirmar(id, usuario)

        if (faltou) {
            if (agenda.status === 'cancelado') {
                throw new AppError('Um agendamento cancelado não pode ser marcado como falta', 400)
            }
            if (agenda.data > hojeDiaPuro()) {
                throw new AppError('Só é possível marcar a falta a partir do dia do atendimento', 400)
            }
            if (agenda.comissao?.pagamentoId) {
                throw new AppError(`${COMISSAO_PAGA}; não dá para marcar a falta`, 409)
            }
            agenda.status = 'faltou'
            agenda.realizadoEm = null
            agenda.comissao = { valor: 0, percentual: null, pagamentoId: null }
        } else if (agenda.status === 'faltou') {
            voltarParaAguardando(agenda)
        }

        await agenda.save()
        return await buscarCompleta(agenda._id, usuario.tenantId)
    },

    // Registra (ou desfaz) o pagamento do paciente: do agendamento ou, em pacote com cobrança, de uma parcela dela.
    async marcarPagamento(id, usuario, { pago, parcela }) {
        const { tenantId } = usuario
        if (!QUEM_CONFIRMA.includes(usuario.role)) {
            throw new AppError('Só a recepção ou a administração marca o pagamento', 403)
        }
        const agenda = await AgendaModel.findOne({ _id: id, tenantId })
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        const pagoEm = pago ? new Date() : null
        if (agenda.cobrancaId) {
            const cobranca = await CobrancaModel.findOne({ _id: agenda.cobrancaId, tenantId })
            const linha = cobranca?.parcelas.find((p) => p.numero === (parcela ?? 1))
            if (!linha) {
                throw new AppError('Parcela não encontrada', 404)
            }
            linha.pagoEm = pagoEm
            await cobranca.save()
        } else {
            const { plano } = await regraDoConvenio(agenda.convenioId, tenantId)
            if (plano && !(agenda.financeiro?.coparticipacao > 0)) {
                throw new AppError('Este atendimento é pago pelo plano', 400)
            }
            if (!plano && Number(agenda.financeiro?.valor) === 0) {
                throw new AppError('Este atendimento é gratuito', 400)
            }
            await AgendaModel.updateOne({ _id: id, tenantId }, { $set: { 'financeiro.pagoEm': pagoEm } })
        }
        return await buscarCompleta(id, tenantId)
    },

    // Chamado ao finalizar o atendimento no prontuário. Na clínica sem confirmação, a consulta passa a contar como
    // realizada e gera o repasse; na clínica em que a recepção confirma, fica só o aviso de que o profissional finalizou.
    async realizarPeloAtendimento(agendaId, tenantId) {
        const agenda = await AgendaModel.findOne({ _id: agendaId, tenantId }).populate('servicoId')
        if (!agenda) return null
        agenda.finalizadoEm = new Date()
        const clinica = await UserModel.findById(tenantId, 'confirmacaoAtendimento').lean()
        if (agenda.status === 'aguardando' && clinica?.confirmacaoAtendimento !== 'recepcao') marcarComoRealizado(agenda)
        await agenda.save()
        return agenda
    },

    // A clínica deixou de confirmar: o que o profissional já finalizou segue a regra nova e conta como realizado.
    async realizarFinalizados(tenantId) {
        const agendas = await AgendaModel.find({ tenantId, status: 'aguardando', finalizadoEm: { $ne: null } }).populate('servicoId')
        for (const agenda of agendas) {
            marcarComoRealizado(agenda)
            await agenda.save()
        }
    },

    // Como a clínica confirma os atendimentos e, para quem resolve, o que ficou em aberto: em qualquer modo, consulta de
    // dia anterior sem desfecho; na clínica em que a recepção confirma, também a de hoje que já passou ou foi finalizada.
    // Vem do servidor a cada tela: a sessão salva no navegador envelhece.
    async confirmacoes(usuario) {
        const clinica = await UserModel.findById(usuario.tenantId, 'confirmacaoAtendimento').lean()
        const modo = clinica?.confirmacaoAtendimento ?? 'automatica'
        if (!QUEM_CONFIRMA.includes(usuario.role)) return { modo, pendentes: [] }

        const hoje = hojeDiaPuro()
        const agendas = await AgendaModel.find({ tenantId: usuario.tenantId, status: 'aguardando', data: { $lte: hoje } })
            .populate('pacienteId', 'nome')
            .populate('profissionalId', 'nome')
            .populate('servicoId', 'nome')
            .sort({ data: 1, horaInicio: 1 })
            .limit(300)

        const agora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
        const emAberto = (a) => a.data < hoje || (modo === 'recepcao' && (a.finalizadoEm || a.horaFim <= agora))
        return { modo, pendentes: agendas.filter(emAberto) }
    },

    async cancelarAgenda(id, tenantId) {
        const agenda = await AgendaModel.findOne({ _id: id, tenantId })
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        if (agenda.comissao?.pagamentoId) {
            throw new AppError(`${COMISSAO_PAGA}; não dá para cancelar`, 409)
        }

        agenda.status = 'cancelado'
        agenda.realizadoEm = null
        agenda.comissao = { valor: 0, percentual: null, pagamentoId: null }
        await agenda.save()
        return agenda
    },

    // Cancela só as sessões que ainda não aconteceram: as já realizadas continuam valendo (e com a comissão delas).
    async cancelarGrupoRecorrencia(grupoRecorrenciaId, tenantId) {
        await AgendaModel.updateMany(
            { grupoRecorrenciaId, tenantId, status: 'aguardando' },
            { $set: { status: 'cancelado' } }
        )
        return null
    },

    async deleteAgenda(id, tenantId) {
        const agenda = await AgendaModel.findOne({ _id: id, tenantId })
        if (!agenda) {
            throw new AppError('Agendamento não encontrado', 404)
        }
        if (agenda.comissao?.pagamentoId) {
            throw new AppError(`${COMISSAO_PAGA}; não dá para remover`, 409)
        }
        await agenda.deleteOne()
        // Última sessão da série: a cobrança sai junto.
        if (agenda.cobrancaId && !(await AgendaModel.exists({ tenantId, cobrancaId: agenda.cobrancaId }))) {
            await CobrancaModel.deleteOne({ _id: agenda.cobrancaId, tenantId })
        }
        return null
    },
}