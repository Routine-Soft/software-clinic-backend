import ServicoModel from './servico.model.js'
import { createServicoDTO, updateServicoDTO } from './servico.dto.js'
import AppError from '../../errors/AppError.js'

function validarComissao(preco, comissao) {
    const valor = Number(comissao)
    if (!Number.isFinite(valor) || valor < 0) {
        throw new AppError('Informe uma comissão válida (zero ou mais)', 400)
    }
    if (valor > Number(preco)) {
        throw new AppError('A comissão não pode ser maior que o preço do serviço', 400)
    }
}

export const ServicoService = {
    async findAll(tenantId) {
        return await ServicoModel.find({ tenantId })
    },

    async findById(id, tenantId) {
        const servico = await ServicoModel.findOne({ _id: id, tenantId })
        if (!servico) {
            throw new AppError('Serviço não encontrado', 404)
        }
        return servico
    },

    async createServico(body, tenantId) {
        const servicoDTO = createServicoDTO(body)
        validarComissao(servicoDTO.preco, servicoDTO.comissao)
        try {
            return await ServicoModel.create({ ...servicoDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um serviço com este nome', 409)
            }
            throw error
        }
    },

    async updateServico(id, tenantId, body) {
        const servicoDTO = updateServicoDTO(body)

        if ('preco' in servicoDTO || 'comissao' in servicoDTO) {
            const atual = await ServicoModel.findOne({ _id: id, tenantId })
            if (!atual) {
                throw new AppError('Serviço não encontrado', 404)
            }
            validarComissao(servicoDTO.preco ?? atual.preco, servicoDTO.comissao ?? atual.comissao ?? 0)
        }

        const servico = await ServicoModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: servicoDTO },
            { new: true, runValidators: true }
        )

        if (!servico) {
            throw new AppError('Serviço não encontrado', 404)
        }

        return servico
    },

    async deleteServico(id, tenantId) {
        const servico = await ServicoModel.findOneAndDelete({ _id: id, tenantId })
        if (!servico) {
            throw new AppError('Serviço não encontrado', 404)
        }
        return null
    },
}