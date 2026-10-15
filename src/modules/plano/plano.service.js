import PlanoModel from './plano.model.js'
import { createPlanoDTO, updatePlanoDTO } from './plano.dto.js'
import AppError from '../../errors/AppError.js'
import { sincronizarPlanoNoStripe } from './plano.stripe.js'
import { moedaDoPais } from '../shared/utils/pais.js'

export const PlanoService = {
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