import argon2 from 'argon2'
import mongoose from 'mongoose'
import UserModel from './user.model.js'
import AssinaturaModel from '../assinatura/assinatura.model.js'
import PagamentoModel from '../assinatura/pagamento.model.js'
import PlanoModel from '../plano/plano.model.js'
import { AssinaturaService, avaliarAcesso } from '../assinatura/assinatura.service.js'
import AppError from '../../errors/AppError.js'

// Cada clínica é o próprio usuário admin: seu tenantId aponta para si mesmo (ver user.model.js).
// Esta camada é a visão do super_admin sobre todas as clínicas, separada da visão de cada clínica sobre si mesma.

const DIA_EM_MS = 24 * 60 * 60 * 1000

function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PERIODOS_RECEITA = ['diario', 'semanal', 'mensal', 'anual']

// Início do período (calendário, não "últimos N dias"): hoje/esta semana (domingo a sábado)/este mês/este ano.
function inicioDoPeriodo(periodo, agora) {
    const inicio = new Date(agora)
    inicio.setHours(0, 0, 0, 0)

    if (periodo === 'semanal') {
        inicio.setDate(inicio.getDate() - inicio.getDay())
    } else if (periodo === 'mensal') {
        inicio.setDate(1)
    } else if (periodo === 'anual') {
        inicio.setMonth(0, 1)
    }

    return inicio
}

// Uma clínica é "pagante" quando tem uma assinatura paga em vigor agora (cartão ou manual). Quem paga por Pix também
// passa por "ativa", mas só enquanto o período corrente não vencer (a mesma regra de acesso já aplica isso).
function ehPagante(assinatura) {
    return assinatura?.status === 'ativa'
}

// Junta os admins com a assinatura mais recente de cada um (uma consulta em lote, não uma por clínica).
async function assinaturasMaisRecentesPorTenant(tenantIds) {
    const docs = await AssinaturaModel.aggregate([
        { $match: { tenantId: { $in: tenantIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$tenantId', doc: { $first: '$$ROOT' } } },
    ])
    return new Map(docs.map((d) => [String(d._id), d.doc]))
}

function assinaturaParaDTO(assinatura, mapaPlanos) {
    if (!assinatura) return null
    const plano = mapaPlanos.get(String(assinatura.planoId))
    return {
        _id: assinatura._id,
        status: assinatura.status,
        cobranca: assinatura.cobranca,
        planoId: plano ? { _id: plano._id, nome: plano.nome, tipo: plano.tipo, preco: plano.preco } : null,
        dataFimTrial: assinatura.dataFimTrial,
        proximaCobranca: assinatura.proximaCobranca,
        inadimplenteDesde: assinatura.inadimplenteDesde,
        acessoRevogado: !!assinatura.acessoRevogado,
        acesso: avaliarAcesso(assinatura),
    }
}

export const ClinicaAdminService = {

    // Números para os cards do painel. Feito com agregação para não carregar cada assinatura na memória.
    async obterResumo() {
        const admins = await UserModel.find({ role: 'admin' }, '_id').lean()
        const totalAdmins = admins.length
        if (totalAdmins === 0) {
            return { totalAdmins: 0, pagantes: 0, naoPagantes: 0 }
        }

        const status = await AssinaturaModel.aggregate([
            { $match: { tenantId: { $in: admins.map((a) => a._id) } } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: '$tenantId', status: { $first: '$status' } } },
        ])

        const pagantes = status.filter((s) => s.status === 'ativa').length
        return { totalAdmins, pagantes, naoPagantes: totalAdmins - pagantes }
    },

    // Soma dos pagamentos aprovados (Pix e cartão) desde o início do período escolhido. Trocas de plano feitas à
    // mão pelo super_admin (cobranca: 'manual') não entram aqui: não houve dinheiro de verdade recebido por elas.
    async obterReceita(periodo) {
        const chave = PERIODOS_RECEITA.includes(periodo) ? periodo : 'mensal'
        const agora = new Date()
        const desde = inicioDoPeriodo(chave, agora)

        const [resultado] = await PagamentoModel.aggregate([
            { $match: { status: 'aprovado', aprovadoEm: { $gte: desde, $lte: agora } } },
            { $group: { _id: null, total: { $sum: '$valor' } } },
        ])

        return { periodo: chave, desde, ate: agora, total: resultado?.total ?? 0 }
    },

    async listar(busca) {
        const filtro = { role: 'admin' }
        if (busca) {
            const regex = new RegExp(escaparRegex(busca), 'i')
            filtro.$or = [{ nomeCompleto: regex }, { email: regex }, { nomeEmpresa: regex }]
        }

        const admins = await UserModel.find(filtro).sort({ createdAt: -1 })
        const [mapaAssinaturas, planos] = await Promise.all([
            assinaturasMaisRecentesPorTenant(admins.map((a) => a._id)),
            PlanoModel.find(),
        ])
        const mapaPlanos = new Map(planos.map((p) => [String(p._id), p]))

        return admins.map((admin) => ({
            _id: admin._id,
            nomeCompleto: admin.nomeCompleto,
            email: admin.email,
            telefone: admin.telefone,
            nomeEmpresa: admin.nomeEmpresa,
            cnpj: admin.cnpj,
            createdAt: admin.createdAt,
            assinatura: assinaturaParaDTO(mapaAssinaturas.get(String(admin._id)), mapaPlanos),
        }))
    },

    async criar(body) {
        const { nomeCompleto, email, password, telefone, nomeEmpresa, cnpj } = body ?? {}
        if (!nomeCompleto || !email || !password || !telefone || !nomeEmpresa) {
            throw new AppError('Preencha nome, e-mail, telefone, senha e o nome da clínica', 400)
        }
        if (password.length < 6) {
            throw new AppError('A senha deve ter ao menos 6 caracteres', 400)
        }

        const novoId = new mongoose.Types.ObjectId()
        let admin
        try {
            admin = await UserModel.create({
                _id: novoId,
                tenantId: novoId,
                nomeCompleto,
                email,
                password: await argon2.hash(password),
                telefone,
                nomeEmpresa,
                cnpj: cnpj || null,
                role: 'admin',
            })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um usuário com este e-mail', 409)
            }
            throw error
        }

        await AssinaturaService.criarAssinaturaTrial(novoId)
        return admin
    },

    async editar(id, body) {
        const allowed = ['nomeCompleto', 'email', 'telefone', 'cnpj', 'nomeEmpresa']
        const dados = Object.fromEntries(Object.entries(body ?? {}).filter(([campo]) => allowed.includes(campo)))
        if ('cnpj' in dados) dados.cnpj = dados.cnpj || null

        let admin
        try {
            admin = await UserModel.findOneAndUpdate({ _id: id, role: 'admin' }, { $set: dados }, { new: true, runValidators: true })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um usuário com este e-mail', 409)
            }
            throw error
        }
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }

        // A clínica é o próprio admin, mas o nome dela também aparece no cadastro dos colaboradores (profissional/recepção).
        if (dados.nomeEmpresa) {
            await UserModel.updateMany({ tenantId: id, _id: { $ne: id } }, { $set: { nomeEmpresa: dados.nomeEmpresa } })
        }

        return admin
    },

    // Remove o acesso do administrador e o registro de assinatura/pagamentos dele. Não apaga os demais dados da
    // clínica (pacientes, agenda, prontuários, colaboradores etc.) — eles ficam no banco, associados a um tenantId
    // que não tem mais um admin. Uma limpeza completa é uma operação maior, deliberadamente fora desta ação.
    async apagar(id) {
        const admin = await UserModel.findOneAndDelete({ _id: id, role: 'admin' })
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }

        await AssinaturaModel.deleteMany({ tenantId: id })
        await PagamentoModel.deleteMany({ tenantId: id })
        return null
    },

    // Define diretamente o plano e o status da assinatura, por fora do Mercado Pago (ex.: pagamento combinado
    // por outro meio). O plano gratuito reabre um novo período de teste; um plano pago fica "ativa" sem cobrança
    // futura automática (cobranca: 'manual') até o super_admin mudar de novo ou o cliente assinar pelo cartão/Pix.
    async trocarPlano(id, planoId) {
        const admin = await UserModel.findOne({ _id: id, role: 'admin' })
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }

        const plano = mongoose.isValidObjectId(planoId) ? await PlanoModel.findOne({ _id: planoId, ativo: true }) : null
        if (!plano) {
            throw new AppError('Plano não encontrado ou inativo', 404)
        }

        const assinatura = await AssinaturaService.obterAssinaturaAtual(id)
        assinatura.planoId = plano._id
        assinatura.inadimplenteDesde = null
        assinatura.mercadoPagoPreapprovalId = null

        if (plano.tipo === 'gratis') {
            assinatura.status = 'trial'
            assinatura.cobranca = 'recorrente'
            assinatura.dataFimTrial = new Date(Date.now() + (plano.duracaoDiasTrial || 3) * DIA_EM_MS)
            assinatura.proximaCobranca = null
        } else {
            assinatura.status = 'ativa'
            assinatura.cobranca = 'manual'
            assinatura.proximaCobranca = null
        }

        await assinatura.save()
        return assinatura
    },

    // Dá mais 3 dias de teste à clínica, quantas vezes o super_admin quiser. Soma ao que ainda restar do
    // prazo atual (não desperdiça teste que ainda não acabou); se a assinatura já tem acesso liberado por
    // outro motivo (plano pago em dia), não há o que estender.
    // O admin que esqueceu a senha (e não usa Google) pede ao suporte: o super admin define uma nova.
    async redefinirSenha(id, novaSenha) {
        if (typeof novaSenha !== 'string' || novaSenha.length < 6) {
            throw new AppError('A nova senha deve ter ao menos 6 caracteres', 400)
        }
        const admin = mongoose.isValidObjectId(id) ? await UserModel.findOne({ _id: id, role: 'admin' }) : null
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }
        admin.password = await argon2.hash(novaSenha)
        await admin.save()
        return null
    },

    async estenderTeste(id) {
        const admin = await UserModel.findOne({ _id: id, role: 'admin' })
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }

        const assinatura = await AssinaturaService.obterAssinaturaAtual(id)
        const agora = new Date()
        const jaTemAcessoPago = assinatura.status === 'ativa' || (assinatura.status === 'cancelada' && assinatura.proximaCobranca > agora)
        if (jaTemAcessoPago) {
            throw new AppError('Esta clínica já está com acesso liberado por um plano pago; não há teste para estender', 400)
        }

        const base = assinatura.dataFimTrial && assinatura.dataFimTrial > agora ? assinatura.dataFimTrial : agora
        assinatura.dataFimTrial = new Date(base.getTime() + 3 * DIA_EM_MS)
        if (assinatura.status !== 'pendente') assinatura.status = 'trial'
        await assinatura.save()
        return assinatura
    },

    async definirRevogacao(id, revogado) {
        const admin = await UserModel.findOne({ _id: id, role: 'admin' })
        if (!admin) {
            throw new AppError('Administrador não encontrado', 404)
        }

        const assinatura = await AssinaturaService.obterAssinaturaAtual(id)
        assinatura.acessoRevogado = !!revogado
        await assinatura.save()
        return assinatura
    },
}
