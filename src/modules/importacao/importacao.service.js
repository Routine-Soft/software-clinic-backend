import crypto from 'node:crypto'
import argon2 from 'argon2'
import PacienteModel from '../paciente/paciente.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import EspecialidadeModel from '../especialidade/especialidade.model.js'
import SalaModel from '../sala/sala.model.js'
import ServicoModel from '../servico/servico.model.js'
import ConvenioModel from '../convenio/convenio.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import ProntuarioModel from '../prontuario/prontuario.model.js'
import UserModel from '../user/user.model.js'
import { ProntuarioAcesso } from '../prontuario/prontuario.acesso.js'
import { AcompanhamentoService } from '../paciente/acompanhamento.service.js'
import { exigirVagaDePaciente, exigirVagaDeProfissional, exigirPlanoParaUsuario, erroDeRecurso } from '../plano/plano.limites.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import AppError from '../../errors/AppError.js'
import {
    texto, normalizar, soDigitos, formatarCpf, email, emailValido,
    lerData, lerHora, somarMinutos, lerValor, lerSimNao, lerLista,
} from './importacao.utils.js'

// Importação de dados vindos de outro sistema (planilha CSV ou Excel lida no site, que manda as linhas já com os
// campos do Sonelia). Cada linha é independente: a que tem problema volta com o motivo e as outras entram.
// Linha repetida (já cadastrada) é ignorada, então importar o mesmo arquivo de novo não duplica nada.

export const MAX_LINHAS = 500
const DURACAO_PADRAO = 50

// Tipos que a recepção e a dona importam. Prontuário é sigiloso: só o profissional de saúde (regras em sonelia-sigilo).
const TIPOS_DA_GESTAO = ['pacientes', 'profissionais', 'usuarios', 'especialidades', 'salas', 'servicos', 'convenios', 'consultas']
export const TIPOS = [...TIPOS_DA_GESTAO, 'prontuarios']

class ErroDaLinha extends Error {
    constructor(motivo, ignorado = false) {
        super(motivo)
        this.ignorado = ignorado
    }
}

const erro = (motivo) => new ErroDaLinha(motivo)
const jaExiste = (motivo) => new ErroDaLinha(motivo, true)

function porNome(lista, campo = 'nome') {
    const mapa = new Map()
    for (const item of lista) {
        const chave = normalizar(item[campo])
        if (!mapa.has(chave)) mapa.set(chave, [])
        mapa.get(chave).push(item)
    }
    return mapa
}

function adicionarAoMapa(mapa, chave, item) {
    if (!mapa.has(chave)) mapa.set(chave, [])
    mapa.get(chave).push(item)
}

// Cadastro simples por nome (sala, especialidade, serviço, convênio): acha pelo nome sem acento ou cria.
function cadastrosPorNome(Model, tenantId) {
    let mapa = null
    return {
        async carregar() {
            if (!mapa) mapa = porNome(await Model.find({ tenantId }))
            return mapa
        },
        async achar(nome) {
            return (await this.carregar()).get(normalizar(nome))?.[0] ?? null
        },
        async acharOuCriar(nome, extra = {}) {
            const existente = await this.achar(nome)
            if (existente) return { item: existente, criado: false }
            const item = await Model.create({ nome: texto(nome), ...extra, tenantId })
            adicionarAoMapa(mapa, normalizar(nome), item)
            return { item, criado: true }
        },
        async primeiro() {
            const todos = [...(await this.carregar()).values()].flat()
            return todos.sort((a, b) => a.createdAt - b.createdAt)[0] ?? null
        },
    }
}

// Pacientes da clínica, para achar o de cada consulta ou prontuário pelo CPF ou pelo nome.
async function indiceDePacientes(tenantId) {
    const pacientes = await PacienteModel.find({ tenantId }).select('nome cpf dataNascimento')
    const porCpf = new Map()
    for (const p of pacientes) if (soDigitos(p.cpf)) porCpf.set(soDigitos(p.cpf), p)
    return { porCpf, porNome: porNome(pacientes), total: pacientes.length }
}

function acharPaciente(indice, campos) {
    const cpf = soDigitos(campos.pacienteCpf)
    if (cpf) {
        const achado = indice.porCpf.get(cpf)
        if (achado) return achado
        if (!texto(campos.paciente)) throw erro(`Nenhum paciente com o CPF ${formatarCpf(cpf)}. Importe os pacientes antes.`)
    }
    const nome = texto(campos.paciente)
    if (!nome) throw erro('Informe o nome ou o CPF do paciente')
    let lista = indice.porNome.get(normalizar(nome)) ?? []
    const nascimento = lerData(campos.pacienteNascimento)?.data
    if (lista.length > 1 && nascimento) {
        lista = lista.filter((p) => p.dataNascimento?.getTime() === nascimento.getTime())
    }
    if (lista.length === 0) throw erro(`Paciente não encontrado: ${nome}. Importe os pacientes antes.`)
    if (lista.length > 1) throw erro(`Há mais de um paciente chamado ${nome}: informe o CPF ou a data de nascimento.`)
    return lista[0]
}

async function indiceDeProfissionais(tenantId) {
    const profissionais = await ProfissionalModel.find({ tenantId }).populate('usuarioId', 'email')
    const porRegistro = new Map()
    const porEmail = new Map()
    for (const p of profissionais) {
        porRegistro.set(`${normalizar(p.tipoRegistro)}|${soDigitos(p.numeroRegistro) || normalizar(p.numeroRegistro)}`, p)
        if (soDigitos(p.numeroRegistro)) adicionarAoMapa(porRegistro, soDigitos(p.numeroRegistro), p)
        if (p.usuarioId?.email) porEmail.set(p.usuarioId.email, p)
    }
    return { porRegistro, porEmail, porNome: porNome(profissionais), total: profissionais.length, lista: profissionais }
}

function acharProfissional(indice, campos) {
    const registro = soDigitos(campos.profissionalRegistro)
    if (registro) {
        const lista = indice.porRegistro.get(registro) ?? []
        if (lista.length === 1) return lista[0]
    }
    const mail = email(campos.profissionalEmail)
    if (mail && indice.porEmail.has(mail)) return indice.porEmail.get(mail)
    const nome = texto(campos.profissional)
    if (!nome) {
        if (indice.total === 1) return indice.lista[0]
        throw erro('Informe o profissional')
    }
    const lista = indice.porNome.get(normalizar(nome)) ?? []
    if (lista.length === 1) return lista[0]
    if (lista.length > 1) throw erro(`Há mais de um profissional chamado ${nome}: informe o número do registro.`)
    throw erro(`Profissional não encontrado: ${nome}. Cadastre ou importe os profissionais antes.`)
}

function dataObrigatoria(valor, mensagemSeFaltar) {
    if (!texto(valor)) throw erro(mensagemSeFaltar)
    const lida = lerData(valor)
    if (!lida) throw erro(`Data inválida: ${texto(valor)}`)
    return lida
}

// Status das consultas de outros sistemas. Sem status, a consulta passada conta como realizada e a futura como marcada.
function lerStatus(valor, data) {
    const t = normalizar(valor)
    if (!t) return data < hojeDiaPuro() ? 'realizado' : 'aguardando'
    if (/(cancel|desmarc|remarc)/.test(t)) return 'cancelado'
    if (/(falt|nao compareceu|nao veio|ausente|no.?show)/.test(t)) return 'faltou'
    if (/(realiz|atendid|compareceu|conclu|finaliz|presen|feito|done|complet)/.test(t)) return 'realizado'
    if (/(agend|marcad|confirm|aguard|pendente|aberto|scheduled)/.test(t)) return 'aguardando'
    throw erro(`Situação da consulta não reconhecida: ${texto(valor)}`)
}

// Hora em Brasília de um dia puro, como instante (para a data do atendimento no prontuário).
function instanteEmBrasilia(dia, hora) {
    const [h, m] = (hora ?? '12:00').split(':').map(Number)
    return new Date(dia.getTime() + ((h + 3) * 60 + m) * 60000)
}

function senhaAleatoria() {
    return crypto.randomBytes(24).toString('base64url')
}

// ---------------------------------------------------------------------------------------------------------------
// Um importador por tipo: `preparar` carrega o que for preciso uma vez; `linha` grava uma linha e devolve um aviso
// opcional (a linha entrou, mas algo ficou de fora).

const IMPORTADORES = {
    async especialidades(ctx) {
        const especialidades = cadastrosPorNome(EspecialidadeModel, ctx.tenantId)
        return async (c) => {
            if (!texto(c.nome)) throw erro('Informe o nome')
            const { criado } = await especialidades.acharOuCriar(c.nome)
            if (!criado) throw jaExiste('Já cadastrada')
        }
    },

    async salas(ctx) {
        const salas = cadastrosPorNome(SalaModel, ctx.tenantId)
        return async (c) => {
            if (!texto(c.nome)) throw erro('Informe o nome')
            const { criado } = await salas.acharOuCriar(c.nome)
            if (!criado) throw jaExiste('Já cadastrada')
        }
    },

    async convenios(ctx) {
        exigirRecursoDoPlano(ctx, 'convenio', 'Convênios são um recurso dos planos pagos.')
        const convenios = cadastrosPorNome(ConvenioModel, ctx.tenantId)
        return async (c) => {
            if (!texto(c.nome)) throw erro('Informe o nome')
            const extra = {}
            const quem = normalizar(c.quemPaga)
            if (quem) extra.quemPaga = /(pacient|particular)/.test(quem) ? 'paciente' : 'plano'
            const copart = lerValor(c.coparticipacao)
            if (Number.isNaN(copart)) throw erro(`Valor inválido: ${texto(c.coparticipacao)}`)
            if (copart) extra.coparticipacao = copart
            const { criado } = await convenios.acharOuCriar(c.nome, extra)
            if (!criado) throw jaExiste('Já cadastrado')
        }
    },

    async servicos(ctx) {
        const servicos = cadastrosPorNome(ServicoModel, ctx.tenantId)
        return async (c) => {
            if (!texto(c.nome)) throw erro('Informe o nome')
            const preco = lerValor(c.preco)
            if (Number.isNaN(preco) || preco < 0) throw erro(`Valor inválido: ${texto(c.preco)}`)
            const tipo = /(sess|pacote)/.test(normalizar(c.tipo)) ? 'pacote' : 'consulta'
            const { criado } = await servicos.acharOuCriar(c.nome, { preco: preco ?? 0, tipo })
            if (!criado) throw jaExiste('Já cadastrado')
        }
    },

    async pacientes(ctx) {
        const indice = await indiceDePacientes(ctx.tenantId)
        const convenios = cadastrosPorNome(ConvenioModel, ctx.tenantId)
        const podeConvenio = temRecurso(ctx, 'convenio')
        const limite = ctx.acesso?.limites?.pacientes ?? null
        let total = indice.total

        return async (c) => {
            const nome = texto(c.nome)
            if (!nome) throw erro('Informe o nome do paciente')
            const nascimento = dataObrigatoria(c.dataNascimento, 'Informe a data de nascimento').data
            const cpf = formatarCpf(c.cpf)
            if (cpf && indice.porCpf.has(soDigitos(cpf))) throw jaExiste('Já cadastrado (mesmo CPF)')
            const mesmoNome = (indice.porNome.get(normalizar(nome)) ?? [])
                .some((p) => p.dataNascimento?.getTime() === nascimento.getTime())
            if (mesmoNome) throw jaExiste('Já cadastrado (mesmo nome e nascimento)')
            const mail = email(c.email)
            if (mail && !emailValido(mail)) throw erro(`E-mail inválido: ${mail}`)

            if (limite !== null && total >= limite) await exigirVagaDePaciente(ctx.tenantId).catch((e) => { throw erro(e.message) })

            let aviso = null
            let convenioId = null
            if (texto(c.convenio)) {
                const existente = await convenios.achar(c.convenio)
                if (existente) convenioId = existente._id
                else if (podeConvenio) convenioId = (await convenios.acharOuCriar(c.convenio)).item._id
                else aviso = 'Convênio não incluído: convênios são um recurso dos planos pagos.'
            }

            const responsaveis = []
            if (texto(c.responsavel)) {
                responsaveis.push({
                    nome: texto(c.responsavel),
                    parentesco: texto(c.responsavelParentesco),
                    cpf: formatarCpf(c.responsavelCpf),
                    telefone: texto(c.responsavelTelefone),
                    email: email(c.responsavelEmail),
                })
            }

            const paciente = await PacienteModel.create({
                nome,
                dataNascimento: nascimento,
                cpf,
                telefone: texto(c.telefone),
                email: mail,
                convenioId,
                responsaveis,
                tenantId: ctx.tenantId,
            })
            total++
            if (cpf) indice.porCpf.set(soDigitos(cpf), paciente)
            adicionarAoMapa(indice.porNome, normalizar(nome), paciente)
            return aviso
        }
    },

    async profissionais(ctx) {
        const indice = await indiceDeProfissionais(ctx.tenantId)
        const especialidades = cadastrosPorNome(EspecialidadeModel, ctx.tenantId)
        const limite = ctx.acesso?.limites?.profissionais ?? null
        const criador = await UserModel.findById(ctx.tenantId).select('nomeEmpresa pais')
        const podeEquipe = ctx.acesso ? ctx.acesso.nivel !== 'gratis' : true
        let total = indice.total

        return async (c) => {
            const nome = texto(c.nome)
            if (!nome) throw erro('Informe o nome do profissional')
            const tipoRegistro = texto(c.tipoRegistro).toUpperCase()
            const numeroRegistro = texto(c.numeroRegistro)
            if (!tipoRegistro || !numeroRegistro) throw erro('Informe o conselho (ex.: CRP) e o número do registro')
            const chave = `${normalizar(tipoRegistro)}|${soDigitos(numeroRegistro) || normalizar(numeroRegistro)}`
            if (indice.porRegistro.has(chave)) throw jaExiste('Já cadastrado (mesmo registro)')
            const nomesDasEspecialidades = lerLista(c.especialidades)
            if (nomesDasEspecialidades.length === 0) throw erro('Informe ao menos uma especialidade')
            const mail = email(c.email)
            if (mail && !emailValido(mail)) throw erro(`E-mail inválido: ${mail}`)

            if (limite !== null && total >= limite) await exigirVagaDeProfissional(ctx.tenantId).catch((e) => { throw erro(e.message) })

            const especialidadeIds = []
            for (const n of nomesDasEspecialidades) especialidadeIds.push((await especialidades.acharOuCriar(n)).item._id)

            // Login do profissional: liga ao usuário da clínica com o mesmo e-mail ou cria um novo (planos pagos).
            let aviso = null
            let usuarioId = null
            if (mail) {
                const usuario = await UserModel.findOne({ email: mail }).select('tenantId role')
                if (usuario && String(usuario.tenantId) === String(ctx.tenantId)) {
                    const ligado = await ProfissionalModel.exists({ tenantId: ctx.tenantId, usuarioId: usuario._id })
                    if (ligado) aviso = 'Login não ligado: este e-mail já é de outro profissional da clínica.'
                    else usuarioId = usuario._id
                } else if (usuario) {
                    aviso = 'Login não criado: este e-mail já é usado em outra conta da Sonelia.'
                } else if (!podeEquipe) {
                    aviso = 'Login não criado: no plano Grátis, só você usa o sistema.'
                } else if (!texto(c.telefone)) {
                    aviso = 'Login não criado: informe o telefone para criar o acesso do profissional.'
                } else {
                    const novo = await UserModel.create({
                        nomeCompleto: nome,
                        email: mail,
                        telefone: texto(c.telefone),
                        password: await argon2.hash(senhaAleatoria()),
                        role: 'profissional',
                        nomeEmpresa: criador?.nomeEmpresa ?? '',
                        pais: criador?.pais ?? 'BR',
                        tenantId: ctx.tenantId,
                    })
                    usuarioId = novo._id
                    aviso = 'Login criado: o profissional entra com "Esqueci minha senha" para criar a senha.'
                }
            }

            const profissional = await ProfissionalModel.create({
                nome, tipoRegistro, numeroRegistro, especialidadeIds, usuarioId, tenantId: ctx.tenantId,
            })
            total++
            indice.porRegistro.set(chave, profissional)
            if (soDigitos(numeroRegistro)) adicionarAoMapa(indice.porRegistro, soDigitos(numeroRegistro), profissional)
            return aviso
        }
    },

    async usuarios(ctx) {
        if (ctx.acesso?.nivel === 'gratis') await exigirPlanoParaUsuario(ctx.tenantId)
        const criador = await UserModel.findById(ctx.tenantId).select('nomeEmpresa pais')
        return async (c) => {
            const nome = texto(c.nome)
            if (!nome) throw erro('Informe o nome')
            const mail = email(c.email)
            if (!mail) throw erro('Informe o e-mail')
            if (!emailValido(mail)) throw erro(`E-mail inválido: ${mail}`)
            if (!texto(c.telefone)) throw erro('Informe o telefone')
            const role = /\b(profission\w*|medic\w*|psic\w*|terapeut\w*|doutor\w*|dr)\b/.test(normalizar(c.papel)) ? 'profissional' : 'recepcao'
            const existente = await UserModel.findOne({ email: mail }).select('tenantId')
            if (existente && String(existente.tenantId) === String(ctx.tenantId)) throw jaExiste('Já cadastrado (mesmo e-mail)')
            if (existente) throw erro('Este e-mail já é usado em outra conta da Sonelia')
            await UserModel.create({
                nomeCompleto: nome,
                email: mail,
                telefone: texto(c.telefone),
                password: await argon2.hash(senhaAleatoria()),
                role,
                nomeEmpresa: criador?.nomeEmpresa ?? '',
                pais: criador?.pais ?? 'BR',
                tenantId: ctx.tenantId,
            })
        }
    },

    async consultas(ctx) {
        const pacientes = await indiceDePacientes(ctx.tenantId)
        const profissionais = await indiceDeProfissionais(ctx.tenantId)
        const salas = cadastrosPorNome(SalaModel, ctx.tenantId)
        const servicos = cadastrosPorNome(ServicoModel, ctx.tenantId)
        const convenios = cadastrosPorNome(ConvenioModel, ctx.tenantId)

        return async (c) => {
            const paciente = acharPaciente(pacientes, c)
            const profissional = acharProfissional(profissionais, c)
            const { data, hora: horaDaData } = dataObrigatoria(c.data, 'Informe a data da consulta')
            const horaInicio = lerHora(c.horaInicio) ?? horaDaData
            if (!horaInicio) throw erro(texto(c.horaInicio) ? `Hora inválida: ${texto(c.horaInicio)}` : 'Informe a hora da consulta')
            let horaFim = lerHora(c.horaFim)
            if (!horaFim) {
                const duracao = Number(soDigitos(c.duracao)) || DURACAO_PADRAO
                horaFim = somarMinutos(horaInicio, duracao)
            }
            if (horaFim <= horaInicio) throw erro('A hora de término precisa ser depois da hora de início')

            const repetida = await AgendaModel.exists({
                tenantId: ctx.tenantId, pacienteId: paciente._id, profissionalId: profissional._id, data, horaInicio,
            })
            if (repetida) throw jaExiste('Já cadastrada (mesmo paciente, profissional, dia e hora)')

            const valorInformado = lerValor(c.valor)
            if (Number.isNaN(valorInformado) || valorInformado < 0) throw erro(`Valor inválido: ${texto(c.valor)}`)

            const servico = texto(c.servico)
                ? (await servicos.acharOuCriar(c.servico, { preco: valorInformado ?? 0, tipo: 'consulta' })).item
                : (await servicos.acharOuCriar('Consulta', { preco: valorInformado ?? 0, tipo: 'consulta' })).item
            const sala = texto(c.sala)
                ? (await salas.acharOuCriar(c.sala)).item
                : (await salas.primeiro()) ?? (await salas.acharOuCriar('Consultório')).item
            const convenio = texto(c.convenio) ? await convenios.achar(c.convenio) : null

            const status = lerStatus(c.status, data)
            const pagoInformado = lerSimNao(c.pago)
            // Sem a coluna "pago", a consulta já realizada no outro sistema conta como paga (é histórico).
            const pago = pagoInformado ?? (status === 'realizado' && data < hojeDiaPuro())

            await AgendaModel.create({
                data,
                horaInicio,
                horaFim,
                salaId: sala._id,
                pacienteId: paciente._id,
                profissionalId: profissional._id,
                servicoId: servico._id,
                convenioId: convenio?._id ?? null,
                status,
                realizadoEm: status === 'realizado' ? instanteEmBrasilia(data, horaFim) : null,
                finalizadoEm: status === 'realizado' ? instanteEmBrasilia(data, horaFim) : null,
                financeiro: {
                    valor: valorInformado ?? servico.preco ?? 0,
                    vencimento: data,
                    pagoEm: pago ? instanteEmBrasilia(data, horaFim) : null,
                },
                importado: true,
                tenantId: ctx.tenantId,
            })
            if (!['cancelado', 'faltou'].includes(status)) {
                await AcompanhamentoService.registrarConsulta(ctx.tenantId, paciente._id, profissional._id, data)
            }
            return texto(c.convenio) && !convenio ? `Convênio não encontrado: ${texto(c.convenio)}. A consulta entrou como particular.` : null
        }
    },

    // Prontuário: dado de saúde. Quem importa é o profissional de saúde; a dona (admin) pode importar os atendimentos
    // de cada profissional da clínica, que passam a ser lidos só pelo autor, como os demais (ver prontuario.acesso.js).
    async prontuarios(ctx) {
        exigirRecursoDoPlano(ctx, 'prontuario', 'Escrever no prontuário é um recurso dos planos pagos. Os registros já salvos continuam disponíveis para leitura.')
        const eu = await ProntuarioAcesso.exigirProfissional(ctx.usuario)
        const pacientes = await indiceDePacientes(ctx.tenantId)
        const profissionais = await indiceDeProfissionais(ctx.tenantId)
        const contexto = { usuario: ctx.usuario, profissional: eu, ip: ctx.ip }
        const podeOutros = ['admin', 'super_admin'].includes(ctx.role)

        return async (c) => {
            const paciente = acharPaciente(pacientes, c)
            let autor = eu
            if (texto(c.profissional) || soDigitos(c.profissionalRegistro) || email(c.profissionalEmail)) {
                autor = acharProfissional(profissionais, c)
                if (String(autor._id) !== String(eu._id) && !podeOutros) {
                    throw erro('Você só pode importar os seus próprios atendimentos')
                }
            }
            const { data, hora } = dataObrigatoria(c.data, 'Informe a data do atendimento')
            const conteudo = {
                queixaPrincipal: texto(c.queixaPrincipal),
                historicoAtual: String(c.historicoAtual ?? '').trim(),
                avaliacao: String(c.avaliacao ?? '').trim(),
                conduta: String(c.conduta ?? '').trim(),
                informacoes: String(c.informacoes ?? '').trim(),
            }
            if (!Object.values(conteudo).some(Boolean)) throw erro('A linha não tem texto de atendimento')
            const cid10 = texto(c.cid10).toUpperCase() || null
            const quando = instanteEmBrasilia(data, lerHora(c.hora) ?? hora)

            const repetido = await ProntuarioModel.exists({
                tenantId: ctx.tenantId, pacienteId: paciente._id, profissionalId: autor._id,
                atendimentoIniciadoEm: quando, importado: true, informacoes: conteudo.informacoes,
                queixaPrincipal: conteudo.queixaPrincipal,
            })
            if (repetido) throw jaExiste('Já importado')

            const agendamento = await AgendaModel.findOne({
                tenantId: ctx.tenantId, pacienteId: paciente._id, profissionalId: autor._id, data,
            }).select('_id convenioId')

            const prontuario = await ProntuarioModel.create({
                pacienteId: paciente._id,
                profissionalId: autor._id,
                agendamentoId: agendamento?._id ?? null,
                convenioId: agendamento?.convenioId ?? null,
                ...conteudo,
                cid10,
                atendimentoIniciadoEm: quando,
                atendimentoFinalizadoEm: quando,
                importado: true,
                createdAt: quando,
                tenantId: ctx.tenantId,
            })
            await ProntuarioAcesso.registrar(contexto, 'importacao', { pacienteId: paciente._id, prontuarioId: prontuario._id })
        }
    },
}

function temRecurso(ctx, recurso) {
    return !ctx.acesso || ctx.acesso.recursos.includes(recurso)
}

function exigirRecursoDoPlano(ctx, recurso, mensagem) {
    if (!temRecurso(ctx, recurso)) throw erroDeRecurso(mensagem, recurso)
}

export const ImportacaoService = {
    // `linhas`: [{ linha: número da linha na planilha, ...campos }]. Devolve o que entrou, o que já existia e os erros.
    async importar(tipo, linhas, ctx) {
        if (!TIPOS.includes(tipo)) throw new AppError('Tipo de importação inválido', 400)
        if (!Array.isArray(linhas) || linhas.length === 0) throw new AppError('Nenhuma linha para importar', 400)
        if (linhas.length > MAX_LINHAS) throw new AppError(`Envie no máximo ${MAX_LINHAS} linhas por vez`, 400)

        const usuario = await UserModel.findById(ctx.usuario.id).select('role')
        if (!usuario) throw new AppError('Usuário não encontrado', 404)
        ctx.role = usuario.role
        if (TIPOS_DA_GESTAO.includes(tipo) && !['admin', 'recepcao', 'super_admin'].includes(ctx.role)) {
            throw new AppError('Acesso negado', 403)
        }

        const gravarLinha = await IMPORTADORES[tipo](ctx)
        const resultado = { importados: 0, ignorados: [], erros: [], avisos: [] }

        for (const [i, item] of linhas.entries()) {
            const linha = Number(item?.linha) || i + 1
            try {
                const aviso = await gravarLinha(item ?? {})
                resultado.importados++
                if (aviso) resultado.avisos.push({ linha, motivo: aviso })
            } catch (e) {
                if (e instanceof ErroDaLinha) {
                    (e.ignorado ? resultado.ignorados : resultado.erros).push({ linha, motivo: e.message })
                } else if (e?.name === 'ValidationError' || e?.name === 'CastError') {
                    resultado.erros.push({ linha, motivo: 'Dados inválidos nesta linha' })
                } else if (e?.code === 11000) {
                    resultado.ignorados.push({ linha, motivo: 'Já cadastrado' })
                } else {
                    throw e
                }
            }
        }
        return resultado
    },
}
