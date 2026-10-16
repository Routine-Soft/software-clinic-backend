import crypto from 'node:crypto'
import mongoose from 'mongoose'
import TermoModel from './termo.model.js'
import TermoModeloModel from './termo-modelo.model.js'
import PacienteModel from '../paciente/paciente.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'
import UserModel from '../user/user.model.js'
import { modeloDTO, envioDTO, assinaturaDTO } from './termo.dto.js'
import { MODELOS_PADRAO, preencherTexto } from './termo.textos.js'
import { interpretarDocumento } from '../assinatura/documento.js'
import { ehBrasil } from '../shared/utils/pais.js'
import AppError from '../../errors/AppError.js'

// Termos de consentimento (TCLE) com assinatura eletrônica simples: a clínica envia um link, o paciente
// (ou o responsável) lê, desenha a assinatura e confirma nome e documento. Fica gravado quem, quando,
// de onde e um resumo (hash) que mostra que o texto não mudou depois.

const VALIDADE_DIAS = 30
// Assinatura desenhada em PNG: um traço comum fica bem abaixo disso.
const IMAGEM_MAX = 400_000

const sha256 = (valor) => crypto.createHash('sha256').update(valor).digest('hex')

export function hashDoDocumento(titulo, texto) {
    return sha256(`${titulo}\n\n${texto}`)
}

export function hashDaAssinatura(termo, assinatura) {
    return sha256(JSON.stringify({
        documento: termo.hashDocumento,
        nome: assinatura.nome,
        identificacao: assinatura.documento,
        relacao: assinatura.relacao,
        assinadoEm: assinatura.assinadoEm.toISOString(),
        ip: assinatura.ip,
        imagem: sha256(assinatura.imagem),
    }))
}

function exigirId(id, mensagem) {
    if (!mongoose.isValidObjectId(id)) throw new AppError(mensagem, 404)
}

function validarModelo(dados) {
    if (!dados.titulo) throw new AppError('Informe o título do termo', 400)
    if (!dados.texto) throw new AppError('Escreva o texto do termo', 400)
}

// Termo sem a imagem da assinatura, com o paciente: para listas.
const CAMPOS_PACIENTE = 'nome cpf telefone responsaveis'

async function termoDoLink(token) {
    const termo = typeof token === 'string' && token.length >= 20
        ? await TermoModel.findOne({ token }).select('+assinatura.imagem')
        : null
    if (!termo) throw new AppError('Link de termo não encontrado. Confira o link ou peça um novo à clínica.', 404)
    return termo
}

export const TermoService = {
    // Primeira vez: a clínica ganha os modelos de exemplo. Excluir arquiva, então eles não voltam.
    async listarModelos(tenantId) {
        if (!(await TermoModeloModel.exists({ tenantId }))) {
            await TermoModeloModel.insertMany(MODELOS_PADRAO.map((m) => ({ ...m, tenantId })))
        }
        return await TermoModeloModel.find({ tenantId, arquivado: false }).sort({ titulo: 1 })
    },

    async criarModelo(tenantId, body) {
        const dados = modeloDTO(body)
        validarModelo(dados)
        return await TermoModeloModel.create({ ...dados, tenantId })
    },

    async atualizarModelo(tenantId, id, body) {
        exigirId(id, 'Modelo de termo não encontrado')
        const dados = modeloDTO(body)
        validarModelo(dados)
        const modelo = await TermoModeloModel.findOneAndUpdate({ _id: id, tenantId, arquivado: false }, { $set: dados }, { new: true })
        if (!modelo) throw new AppError('Modelo de termo não encontrado', 404)
        return modelo
    },

    async excluirModelo(tenantId, id) {
        exigirId(id, 'Modelo de termo não encontrado')
        const modelo = await TermoModeloModel.findOneAndUpdate({ _id: id, tenantId, arquivado: false }, { $set: { arquivado: true } })
        if (!modelo) throw new AppError('Modelo de termo não encontrado', 404)
    },

    async listar(tenantId, { pacienteId, status } = {}) {
        const filtro = { tenantId }
        if (pacienteId) {
            exigirId(pacienteId, 'Paciente não encontrado')
            filtro.pacienteId = pacienteId
        }
        if (['pendente', 'assinado', 'cancelado'].includes(status)) filtro.status = status
        return await TermoModel.find(filtro)
            .select('-texto')
            .populate('pacienteId', CAMPOS_PACIENTE)
            .populate('profissionalId', 'nome')
            .sort({ createdAt: -1 })
            .limit(500)
    },

    // Termo completo, com a assinatura desenhada: para ver e imprimir.
    async obter(tenantId, id) {
        exigirId(id, 'Termo não encontrado')
        const termo = await TermoModel.findOne({ _id: id, tenantId })
            .select('+assinatura.imagem')
            .populate('pacienteId', CAMPOS_PACIENTE)
            .populate('profissionalId', 'nome tipoRegistro numeroRegistro')
        if (!termo) throw new AppError('Termo não encontrado', 404)
        const clinica = await UserModel.findById(tenantId, 'nomeEmpresa').lean()
        return { ...termo.toObject(), clinica: clinica?.nomeEmpresa ?? '' }
    },

    async enviar(tenantId, usuarioId, body) {
        const { pacienteId, modeloId, profissionalId } = envioDTO(body)
        exigirId(pacienteId, 'Escolha o paciente')
        exigirId(modeloId, 'Escolha o modelo do termo')

        const [paciente, modelo, clinica] = await Promise.all([
            PacienteModel.findOne({ _id: pacienteId, tenantId }).lean(),
            TermoModeloModel.findOne({ _id: modeloId, tenantId, arquivado: false }).lean(),
            UserModel.findById(tenantId, 'nomeEmpresa').lean(),
        ])
        if (!paciente) throw new AppError('Paciente não encontrado', 404)
        if (!modelo) throw new AppError('Modelo de termo não encontrado', 404)

        let profissional = null
        if (profissionalId) {
            exigirId(profissionalId, 'Profissional não encontrado')
            profissional = await ProfissionalModel.findOne({ _id: profissionalId, tenantId }).lean()
            if (!profissional) throw new AppError('Profissional não encontrado', 404)
        }

        const agora = new Date()
        const texto = preencherTexto(modelo.texto, { paciente, profissional, clinica }, agora)
        const termo = await TermoModel.create({
            pacienteId: paciente._id,
            modeloId: modelo._id,
            profissionalId: profissional?._id ?? null,
            titulo: modelo.titulo,
            texto,
            hashDocumento: hashDoDocumento(modelo.titulo, texto),
            token: crypto.randomBytes(24).toString('base64url'),
            expiraEm: new Date(agora.getTime() + VALIDADE_DIAS * 24 * 60 * 60 * 1000),
            enviadoPor: usuarioId ?? null,
            tenantId,
        })
        return await TermoModel.findById(termo._id).select('-texto').populate('pacienteId', CAMPOS_PACIENTE).populate('profissionalId', 'nome')
    },

    async cancelar(tenantId, id) {
        exigirId(id, 'Termo não encontrado')
        const termo = await TermoModel.findOne({ _id: id, tenantId })
        if (!termo) throw new AppError('Termo não encontrado', 404)
        if (termo.status === 'assinado') throw new AppError('Este termo já foi assinado e não pode ser cancelado', 409)
        termo.status = 'cancelado'
        await termo.save()
    },

    // Página de assinatura (sem login): só o que o paciente precisa para ler e assinar.
    async publico(token) {
        const termo = await termoDoLink(token)
        if (termo.status === 'cancelado') throw new AppError('Este termo foi cancelado pela clínica. Se precisar, peça um novo link.', 410)
        const [paciente, clinica] = await Promise.all([
            PacienteModel.findById(termo.pacienteId, 'nome cpf dataNascimento responsaveis').lean(),
            UserModel.findById(termo.tenantId, 'nomeEmpresa pais').lean(),
        ])
        const vencido = termo.status === 'pendente' && termo.expiraEm < new Date()
        const responsaveis = (paciente?.responsaveis ?? []).map((r) => ({ nome: r.nome, cpf: r.cpf }))
        return {
            _id: termo._id,
            titulo: termo.titulo,
            texto: termo.texto,
            status: vencido ? 'vencido' : termo.status,
            hashDocumento: termo.hashDocumento,
            enviadoEm: termo.createdAt,
            clinica: clinica?.nomeEmpresa ?? '',
            pedeCpf: ehBrasil(clinica?.pais),
            // CPF e responsáveis só servem para preencher o formulário: depois de assinado, não saem mais pelo link.
            paciente: termo.status === 'pendente'
                ? { nome: paciente?.nome ?? '', cpf: paciente?.cpf ?? '', responsaveis }
                : { nome: paciente?.nome ?? '' },
            assinatura: termo.assinatura ?? null,
        }
    },

    async assinar(token, body, origem = {}) {
        const termo = await termoDoLink(token)
        if (termo.status === 'assinado') throw new AppError('Este termo já foi assinado', 409)
        if (termo.status === 'cancelado') throw new AppError('Este termo foi cancelado pela clínica. Se precisar, peça um novo link.', 410)
        if (termo.expiraEm < new Date()) throw new AppError('Este link venceu. Peça um novo à clínica.', 410)

        const dados = assinaturaDTO(body)
        if (!dados.aceite) throw new AppError('Marque que leu e concorda com o termo', 400)
        if (dados.nome.length < 3 || !dados.nome.includes(' ')) throw new AppError('Informe o nome completo de quem está assinando', 400)

        const clinica = await UserModel.findById(termo.tenantId, 'pais').lean()
        let documento = dados.documento
        if (ehBrasil(clinica?.pais)) {
            const cpf = interpretarDocumento(documento)
            if (cpf?.tipo !== 'CPF') throw new AppError('Informe um CPF válido de quem está assinando', 400)
            documento = cpf.numero
        } else if (documento.length < 4) {
            throw new AppError('Informe o documento de identidade de quem está assinando', 400)
        }

        if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dados.imagem) || dados.imagem.length < 200) {
            throw new AppError('Desenhe a sua assinatura no quadro', 400)
        }
        if (dados.imagem.length > IMAGEM_MAX) throw new AppError('A assinatura ficou grande demais. Limpe o quadro e assine de novo.', 400)

        const assinatura = {
            nome: dados.nome,
            documento,
            relacao: dados.relacao,
            imagem: dados.imagem,
            assinadoEm: new Date(),
            ip: String(origem.ip ?? '').slice(0, 64),
            aparelho: String(origem.aparelho ?? '').slice(0, 300),
        }
        assinatura.hashAssinatura = hashDaAssinatura(termo, assinatura)

        // Só assina se ainda estiver pendente (dois cliques ao mesmo tempo não geram duas assinaturas).
        const atualizado = await TermoModel.findOneAndUpdate(
            { _id: termo._id, status: 'pendente' },
            { $set: { status: 'assinado', assinatura } },
            { new: true }
        )
        if (!atualizado) throw new AppError('Este termo já foi assinado', 409)
        return await this.publico(token)
    },
}
