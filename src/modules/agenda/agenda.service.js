import mongoose from 'mongoose'
import AgendaModel from './agenda.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
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

        if (!body.repetir) {
            const agenda = await AgendaModel.create({ ...agendaDTO, tenantId })
            await AcompanhamentoService.registrarConsulta(tenantId, agenda.pacienteId, agenda.profissionalId, agenda.data)
            return agenda
        }

        const { diasSemana, dataFim } = body.repetir
        const datas = gerarDatasRecorrencia(agendaDTO.data, dataFim, diasSemana)

        if (datas.length === 0) {
            throw new AppError('Nenhuma data válida encontrada para a recorrência informada', 400)
        }

        const grupoRecorrenciaId = new mongoose.Types.ObjectId()

        const documentos = datas.map((data) => ({
            ...agendaDTO,
            data,
            tenantId,
            grupoRecorrenciaId,
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
        const alteracoes = trocaHorario ? { ...agendaDTO, lembrete: LEMBRETE_VAZIO } : agendaDTO

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

    // Como a clínica confirma os atendimentos e, para quem confirma, as consultas que já aconteceram (ou que o
    // profissional finalizou) e ninguém confirmou. Vem do servidor a cada tela: a sessão salva no navegador envelhece.
    async confirmacoes(usuario) {
        const clinica = await UserModel.findById(usuario.tenantId, 'confirmacaoAtendimento confirmacaoDesde').lean()
        const modo = clinica?.confirmacaoAtendimento ?? 'automatica'
        if (modo !== 'recepcao' || !QUEM_CONFIRMA.includes(usuario.role)) return { modo, pendentes: [] }

        const hoje = hojeDiaPuro()
        const agendas = await AgendaModel.find({
            tenantId: usuario.tenantId,
            status: 'aguardando',
            data: { $gte: clinica.confirmacaoDesde ?? hoje, $lte: hoje },
        })
            .populate('pacienteId', 'nome')
            .populate('profissionalId', 'nome')
            .populate('servicoId', 'nome')
            .sort({ data: 1, horaInicio: 1 })

        const agora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
        return { modo, pendentes: agendas.filter((a) => a.data < hoje || a.finalizadoEm || a.horaFim <= agora) }
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
        return null
    },
}