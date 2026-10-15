import PacienteModel from './paciente.model.js'
import { createPacienteDTO, updatePacienteDTO } from './paciente.dto.js'
import ProntuarioModel from '../prontuario/prontuario.model.js'
import ProntuarioAcessoModel from '../prontuario/prontuario-acesso.model.js'
import AgendaModel from '../agenda/agenda.model.js'
import ListaEsperaModel from '../lista-espera/lista-espera.model.js'
import AvaliacaoNeuropsicologicaModel from '../avaliacao-neuropsicologica/avaliacao-neuropsicologica.model.js'
import AvaliacaoNr01Model from '../avaliacao-nr01/avaliacao-nr01.model.js'
import AppError from '../../errors/AppError.js'

const MAIORIDADE = 18

// Idade em anos completos hoje (no fuso de Brasília). A data de nascimento é gravada como meia-noite UTC.
export function idadeEmAnos(dataNascimento, agora = new Date()) {
    const nascimento = new Date(dataNascimento)
    if (Number.isNaN(nascimento.getTime())) return null
    const [ano, mes, dia] = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number)
    let idade = ano - nascimento.getUTCFullYear()
    if (mes < nascimento.getUTCMonth() + 1 || (mes === nascimento.getUTCMonth() + 1 && dia < nascimento.getUTCDate())) idade--
    return idade
}

// Adulto precisa de telefone e e-mail próprios; criança pode usar o contato dos responsáveis.
function validarPaciente(paciente) {
    if ((paciente.responsaveis ?? []).some((r) => !r.nome)) {
        throw new AppError('Informe o nome do responsável', 400)
    }
    if ((paciente.responsaveis ?? []).length > 2) {
        throw new AppError('Informe no máximo dois responsáveis', 400)
    }
    const idade = idadeEmAnos(paciente.dataNascimento)
    const menor = idade !== null && idade < MAIORIDADE
    if (!menor && (!paciente.telefone || !paciente.email)) {
        throw new AppError('Informe o telefone e o e-mail do paciente', 400)
    }
}

export const PacienteService = {
    async findAll(tenantId) {
        return await PacienteModel.find({ tenantId }).populate('convenioId').populate('empresaId')
    },

    async findById(id, tenantId) {
        const paciente = await PacienteModel.findOne({ _id: id, tenantId }).populate('convenioId').populate('empresaId')
        if (!paciente) {
            throw new AppError('Paciente não encontrado', 404)
        }
        return paciente
    },

    async createPaciente(body, tenantId) {
        const pacienteDTO = createPacienteDTO(body)
        validarPaciente(pacienteDTO)
        try {
            return await PacienteModel.create({ ...pacienteDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um paciente com este CPF nesta clínica', 409)
            }
            throw error
        }
    },

    async updatePaciente(id, tenantId, body) {
        const pacienteDTO = updatePacienteDTO(body)
        const atual = await PacienteModel.findOne({ _id: id, tenantId }).lean()
        if (!atual) {
            throw new AppError('Paciente não encontrado', 404)
        }
        validarPaciente({ ...atual, ...pacienteDTO })

        const paciente = await PacienteModel.findOneAndUpdate(
            { _id: id, tenantId },
            { $set: pacienteDTO },
            { new: true, runValidators: true }
        )

        if (!paciente) {
            throw new AppError('Paciente não encontrado', 404)
        }

        return paciente
    },

    async deletePaciente(id, tenantId) {
        const atual = await PacienteModel.findOne({ _id: id, tenantId }, 'teste').lean()
        if (!atual) {
            throw new AppError('Paciente não encontrado', 404)
        }

        // Paciente de teste não existe de verdade: sai com tudo o que foi criado para ele.
        if (atual.teste) {
            const filtro = { tenantId, pacienteId: atual._id }
            await Promise.all([
                ProntuarioAcessoModel.deleteMany(filtro),
                ProntuarioModel.deleteMany(filtro),
                AgendaModel.deleteMany(filtro),
                ListaEsperaModel.deleteMany(filtro),
                AvaliacaoNeuropsicologicaModel.deleteMany(filtro),
                AvaliacaoNr01Model.deleteMany(filtro),
            ])
            await PacienteModel.deleteOne({ _id: atual._id, tenantId })
            return null
        }

        // O prontuário deve ser guardado por no mínimo 20 anos (Lei 13.787/2018): paciente com atendimento fica.
        if (await ProntuarioModel.exists({ tenantId, pacienteId: id })) {
            throw new AppError('Este paciente tem prontuário registrado e não pode ser excluído: o prontuário deve ser guardado por no mínimo 20 anos.', 409)
        }
        const paciente = await PacienteModel.findOneAndDelete({ _id: id, tenantId })
        if (!paciente) {
            throw new AppError('Paciente não encontrado', 404)
        }
        return null
    },
}