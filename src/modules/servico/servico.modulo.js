import mongoose from 'mongoose'
import ServicoModel from './servico.model.js'
import AppError from '../../errors/AppError.js'

// O serviço escolhido numa avaliação precisa ser da clínica e estar marcado para aquele módulo.
export async function validarServicoDoModulo(servicoId, tenantId, modulo) {
    if (!servicoId) return
    const servico = mongoose.isValidObjectId(servicoId)
        ? await ServicoModel.findOne({ _id: servicoId, tenantId }).select('modulo')
        : null
    if (!servico) throw new AppError('Serviço não encontrado', 404)
    if (servico.modulo !== modulo) {
        throw new AppError('Este serviço não está marcado para este tipo de avaliação. Ajuste o campo "Usado em" do serviço.', 400)
    }
}
