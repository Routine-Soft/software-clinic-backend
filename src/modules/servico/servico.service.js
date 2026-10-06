import mongoose from 'mongoose'
import ServicoModel from './servico.model.js'
import ConvenioModel from '../convenio/convenio.model.js'
import { createServicoDTO, updateServicoDTO } from './servico.dto.js'
import AppError from '../../errors/AppError.js'

const CAMPOS_DE_PRECO = ['preco', 'comissao', 'comissaoTipo', 'tabelaConvenios']

function validarRegra({ preco, comissao, comissaoTipo }, onde) {
    const valorPreco = Number(preco)
    const valorComissao = Number(comissao)
    if (preco === '' || preco === null || !Number.isFinite(valorPreco) || valorPreco < 0) {
        throw new AppError(`Informe um preço válido ${onde}`, 400)
    }
    if (!['valor', 'percentual'].includes(comissaoTipo)) {
        throw new AppError(`Escolha se o repasse ${onde} é em reais ou em percentual`, 400)
    }
    if (!Number.isFinite(valorComissao) || valorComissao < 0) {
        throw new AppError(`Informe um repasse válido (zero ou mais) ${onde}`, 400)
    }
    if (comissaoTipo === 'percentual' && valorComissao > 100) {
        throw new AppError(`O repasse ${onde} não pode passar de 100%`, 400)
    }
    if (comissaoTipo === 'valor' && valorComissao > valorPreco) {
        throw new AppError(`O repasse ${onde} não pode ser maior que o preço`, 400)
    }
}

// Regra padrão e a de cada convênio da tabela (convênio desta clínica, sem repetir).
async function validarPrecos(servico, tenantId) {
    validarRegra(servico, 'da regra padrão')

    const tabela = servico.tabelaConvenios ?? []
    const ids = tabela.map((linha) => String(linha.convenioId))
    if (ids.some((id) => !mongoose.isValidObjectId(id))) {
        throw new AppError('Escolha o convênio de cada linha da tabela de preços', 400)
    }
    if (new Set(ids).size !== ids.length) {
        throw new AppError('Cada convênio só pode aparecer uma vez na tabela de preços do serviço', 400)
    }

    const convenios = ids.length ? await ConvenioModel.find({ _id: { $in: ids }, tenantId }, 'nome') : []
    if (convenios.length !== ids.length) {
        throw new AppError('Convênio não encontrado nesta clínica', 400)
    }
    const nomes = new Map(convenios.map((c) => [String(c._id), c.nome]))
    for (const linha of tabela) {
        validarRegra(linha, `de ${nomes.get(String(linha.convenioId))}`)
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
        await validarPrecos(servicoDTO, tenantId)
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

        if (CAMPOS_DE_PRECO.some((campo) => campo in servicoDTO)) {
            const atual = await ServicoModel.findOne({ _id: id, tenantId })
            if (!atual) {
                throw new AppError('Serviço não encontrado', 404)
            }
            const final = Object.fromEntries(CAMPOS_DE_PRECO.map((campo) => [campo, campo in servicoDTO ? servicoDTO[campo] : atual[campo]]))
            await validarPrecos(final, tenantId)
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