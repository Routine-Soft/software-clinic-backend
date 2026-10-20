import mongoose from 'mongoose'
import AnamneseModeloModel from './anamnese-modelo.model.js'
import AnamneseModel from './anamnese.model.js'
import PacienteModel from '../paciente/paciente.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import { ProntuarioAcesso } from '../prontuario/prontuario.acesso.js'
import { MODELOS_PADRAO } from './anamnese.padroes.js'
import { sanitizarSecoes, sanitizarRespostas, contarRespondidas } from './anamnese.ficha.js'
import AppError from '../../errors/AppError.js'

const texto = (valor, max = 300) => String(valor ?? '').trim().slice(0, max)

function exigirId(id, mensagem) {
    if (!mongoose.isValidObjectId(id)) throw new AppError(mensagem, 404)
}

function dadosDoModelo(body = {}) {
    const titulo = texto(body.titulo)
    if (!titulo) throw new AppError('Informe o nome do modelo de anamnese', 400)
    return { titulo, area: texto(body.area), descricao: texto(body.descricao, 2000), secoes: sanitizarSecoes(body.secoes) }
}

// Primeira vez: a clínica recebe os modelos prontos. Também cobre a clínica que ainda não tem algum modelo
// pronto que entrou depois (pela chave); quem apagou um modelo pronto não o recebe de novo (fica arquivado).
async function garantirModelosPadrao(tenantId) {
    const existentes = new Set((await AnamneseModeloModel.find({ tenantId, chave: { $ne: null } }, 'chave').lean()).map((m) => m.chave))
    const faltando = MODELOS_PADRAO.filter((m) => !existentes.has(m.chave))
    if (!faltando.length) return
    await AnamneseModeloModel.insertMany(faltando.map((m) => ({ ...m, tenantId })), { ordered: false }).catch((erro) => {
        if (erro?.code !== 11000 && !erro?.writeErrors?.every((e) => e.code === 11000)) throw erro
    })
}

async function modeloAtivo(tenantId, id) {
    exigirId(id, 'Modelo de anamnese não encontrado')
    const modelo = await AnamneseModeloModel.findOne({ _id: id, tenantId, arquivado: false })
    if (!modelo) throw new AppError('Modelo de anamnese não encontrado', 404)
    return modelo
}

// Avaliação neuropsicológica: o modelo pronto neuropsicológico, ou o escolhido.
export async function modeloParaAvaliacao(tenantId, modeloId) {
    await garantirModelosPadrao(tenantId)
    if (modeloId) return await modeloAtivo(tenantId, modeloId)
    return await AnamneseModeloModel.findOne({ tenantId, chave: 'neuropsicologica', arquivado: false })
        ?? await AnamneseModeloModel.findOne({ tenantId, arquivado: false }).sort({ titulo: 1 })
}

function popular(query) {
    return query.populate('profissionalId', 'nome tipoRegistro numeroRegistro').populate('compartilhadoCom', 'nome').populate('pacienteId', 'nome dataNascimento')
}

async function contextoDe(contexto) {
    const profissional = await ProntuarioAcesso.exigirProfissional(contexto.usuario)
    return { ...contexto, profissional }
}

async function carregarLegivel(contexto, id) {
    exigirId(id, 'Anamnese não encontrada')
    const anamnese = await AnamneseModel.findOne({ _id: id, tenantId: contexto.profissional.tenantId })
    if (!anamnese) throw new AppError('Anamnese não encontrada', 404)
    if (!ProntuarioAcesso.podeLerProntuario(contexto.profissional, anamnese)) {
        throw new AppError('Esta anamnese não foi liberada para a sua especialidade.', 403)
    }
    return anamnese
}

export const AnamneseService = {
    // ---------- Modelos da clínica ----------
    async listarModelos(tenantId) {
        await garantirModelosPadrao(tenantId)
        return await AnamneseModeloModel.find({ tenantId, arquivado: false }).sort({ titulo: 1 })
    },

    async obterModelo(tenantId, id) {
        return await modeloAtivo(tenantId, id)
    },

    async criarModelo(tenantId, body) {
        return await AnamneseModeloModel.create({ ...dadosDoModelo(body), tenantId })
    },

    async atualizarModelo(tenantId, id, body) {
        const modelo = await modeloAtivo(tenantId, id)
        Object.assign(modelo, dadosDoModelo(body))
        return await modelo.save()
    },

    async duplicarModelo(tenantId, id) {
        const modelo = await modeloAtivo(tenantId, id)
        return await AnamneseModeloModel.create({
            titulo: `${modelo.titulo} (cópia)`.slice(0, 300),
            area: modelo.area,
            descricao: modelo.descricao,
            secoes: modelo.secoes,
            tenantId,
        })
    },

    async excluirModelo(tenantId, id) {
        const modelo = await modeloAtivo(tenantId, id)
        modelo.arquivado = true
        await modelo.save()
    },

    // ---------- Anamneses do prontuário ----------
    // As anamneses do paciente que o profissional pode ler (sem as respostas) e o modelo que ele costuma usar.
    async listar(contextoRequisicao, pacienteId) {
        const contexto = await contextoDe(contextoRequisicao)
        const { profissional } = contexto
        exigirId(pacienteId, 'Paciente não encontrado')
        const lista = await popular(AnamneseModel.find({ tenantId: profissional.tenantId, pacienteId, ...ProntuarioAcesso.filtroLeitura(profissional) }))
            .sort({ createdAt: -1 })
            .lean()
        const preferencia = await ProfissionalModel.findById(profissional._id, 'anamneseModeloId').lean()
        return {
            anamneses: lista.map(({ respostas, secoes, ...resto }) => ({ ...resto, andamento: contarRespondidas(secoes, respostas) })),
            modeloPreferidoId: preferencia?.anamneseModeloId ?? null,
        }
    },

    async obter(contextoRequisicao, id) {
        const contexto = await contextoDe(contextoRequisicao)
        const anamnese = await carregarLegivel(contexto, id)
        await ProntuarioAcesso.registrar(contexto, 'anamnese_leitura', { pacienteId: anamnese.pacienteId, anamneseId: anamnese._id })
        return await popular(AnamneseModel.findById(anamnese._id))
    },

    // Nova anamnese com o modelo escolhido. O modelo vira a preferência do profissional.
    async criar(contextoRequisicao, body = {}) {
        const contexto = await contextoDe(contextoRequisicao)
        const { profissional } = contexto
        const tenantId = profissional.tenantId
        exigirId(body.pacienteId, 'Paciente não encontrado')
        if (!(await PacienteModel.exists({ _id: body.pacienteId, tenantId }))) throw new AppError('Paciente não encontrado', 404)
        if (!body.modeloId) throw new AppError('Escolha o modelo de anamnese', 400)
        const modelo = await modeloAtivo(tenantId, body.modeloId)
        const compartilhadoCom = await ProntuarioAcesso.validarEspecialidades(body.compartilhadoCom ?? [], tenantId)

        const anamnese = await AnamneseModel.create({
            pacienteId: body.pacienteId,
            profissionalId: profissional._id,
            modeloId: modelo._id,
            titulo: modelo.titulo,
            secoes: modelo.secoes,
            respostas: sanitizarRespostas(modelo.secoes, body.respostas),
            compartilhadoCom,
            tenantId,
        })
        await ProfissionalModel.updateOne({ _id: profissional._id }, { $set: { anamneseModeloId: modelo._id } })
        await ProntuarioAcesso.registrar(contexto, 'anamnese_criacao', { pacienteId: anamnese.pacienteId, anamneseId: anamnese._id })
        return await popular(AnamneseModel.findById(anamnese._id))
    },

    // Só o autor altera as respostas e quem pode ler.
    async atualizar(contextoRequisicao, id, body = {}) {
        const contexto = await contextoDe(contextoRequisicao)
        const anamnese = await carregarLegivel(contexto, id)
        ProntuarioAcesso.exigirAutor(contexto.profissional, anamnese, 'Só o profissional que preencheu a anamnese pode alterá-la.')

        const alteracoes = {}
        if ('respostas' in body) alteracoes.respostas = sanitizarRespostas(anamnese.secoes, body.respostas)
        if ('compartilhadoCom' in body) {
            alteracoes.compartilhadoCom = await ProntuarioAcesso.validarEspecialidades(body.compartilhadoCom, contexto.profissional.tenantId)
        }
        await AnamneseModel.updateOne({ _id: anamnese._id }, { $set: alteracoes })
        const acao = 'respostas' in body ? 'anamnese_edicao' : 'anamnese_compartilhamento'
        await ProntuarioAcesso.registrar(contexto, acao, { pacienteId: anamnese.pacienteId, anamneseId: anamnese._id })
        return await popular(AnamneseModel.findById(anamnese._id))
    },
}
