import PlanoModel from './plano.model.js'
import { createPlanoDTO, updatePlanoDTO } from './plano.dto.js'
import AppError from '../../errors/AppError.js'
import { sincronizarPlanoNoStripe } from './plano.stripe.js'
import { moedaDoPais } from '../shared/utils/pais.js'
import BloqueioModel from './bloqueio.model.js'
import { RECURSOS } from './plano.limites.js'

const RECURSOS_DOS_CLIQUES = [...RECURSOS, 'pacientes', 'profissionais']

export const PlanoService = {
    // Clique num recurso com cadeado. Recurso desconhecido é ignorado (sem erro: é só estatística).
    async registrarBloqueio(usuario, acesso, body) {
        const recurso = String(body?.recurso ?? '')
        if (!RECURSOS_DOS_CLIQUES.includes(recurso) || !usuario?.tenantId) return
        await BloqueioModel.create({
            tenantId: usuario.tenantId,
            usuarioId: usuario.id ?? null,
            recurso,
            origem: String(body?.origem ?? '').slice(0, 40),
            nivel: acesso?.nivel ?? null,
        })
    },

    // Para o super admin: cliques por recurso nos últimos 90 dias, e quantas clínicas diferentes clicaram.
    async resumoDeBloqueios() {
        const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        const linhas = await BloqueioModel.aggregate([
            { $match: { createdAt: { $gte: desde } } },
            { $group: { _id: '$recurso', cliques: { $sum: 1 }, clinicas: { $addToSet: '$tenantId' } } },
            { $project: { _id: 0, recurso: '$_id', cliques: 1, clinicas: { $size: '$clinicas' } } },
            { $sort: { cliques: -1 } },
        ])
        return { desde, recursos: linhas }
    },

    async findAll() {
        return await PlanoModel.find()
    },

    // Para a landing (sem login): os planos pagos à venda no país do visitante (Brasil em reais, fora em dólar).
    async publicos(pais) {
        // Planos antigos não têm "moeda" gravada: valem como reais.
        const moeda = moedaDoPais(pais) === 'USD' ? 'USD' : { $ne: 'USD' }
        return await PlanoModel.find({ tipo: 'pago', ativo: true, moeda }, 'nome preco moeda descricao recursos individual').sort({ preco: 1 })
    },

    async findById(id) {
        const plano = await PlanoModel.findById(id)
        if (!plano) {
            throw new AppError('Plano não encontrado', 404)
        }
        return plano
    },

    async createPlano(body) {
        const planoDTO = createPlanoDTO(body)
        const plano = await PlanoModel.create(planoDTO)
        return await sincronizarPlanoNoStripe(plano)
    },

    async updatePlano(id, body) {
        const planoDTO = updatePlanoDTO(body)
        const plano = await PlanoModel.findByIdAndUpdate(id, { $set: planoDTO }, { new: true, runValidators: true })
        if (!plano) {
            throw new AppError('Plano não encontrado', 404)
        }
        return await sincronizarPlanoNoStripe(plano)
    },

    async deletePlano(id) {
        const plano = await PlanoModel.findByIdAndDelete(id)
        if (!plano) {
            throw new AppError('Plano não encontrado', 404)
        }
        return null
    },
}