import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import UserModel from './user.model.js'
import { AssinaturaService } from '../assinatura/assinatura.service.js'
import { GoogleAuth } from './google-auth.js'
import { IndicacaoService } from '../indicacao/indicacao.service.js'
import { AgendaService } from '../agenda/agenda.service.js'
import { hojeDiaPuro } from '../shared/utils/dia-puro.js'
import { exigirPlanoComEquipe } from '../plano/plano.limites.js'
import { paisValido } from '../shared/utils/pais.js'
import { enviarBoasVindas } from './boas-vindas.email.js'
import { alertarNovoCadastro } from './novo-cadastro.alerta.js'

import { createUserDTO, updateUserDTO, updateMeDTO, loginUserDTO } from './user.dto.js'
import AppError from '../../errors/AppError.js'

// `via: 'google'` marca a sessão aberta pelo Google: ela pode trocar a senha sem informar a atual,
// e é assim que quem esqueceu a senha recupera o acesso.
// Versão dos Termos de uso da clínica aceita no cadastro (muda quando o texto mudar).
const TERMOS_CLINICA_VERSAO = '2026-10-11'

async function emitirSessao(user, via = 'senha') {
    const payload = { id: user._id, tenantId: user.tenantId, role: user.role, via }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' })
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' })
    user.tokenRefresh = refreshToken
    await user.save()
    return { accessToken, refreshToken, user: await comPaisDaClinica(user) }
}

// O país fica só no dono da clínica; recepção e profissionais recebem o dele em `paisClinica`
// (o site esconde o que só existe no Brasil, como NR-01 e "Indique e ganhe").
async function comPaisDaClinica(user) {
    const dono = String(user.tenantId) === String(user._id) ? user : await UserModel.findById(user.tenantId, 'pais').lean()
    return { ...user.toJSON(), paisClinica: dono?.pais ?? 'BR' }
}

export const UserService = {
    // Quem confirma os atendimentos da clínica. Só vira pendência o que for de hoje em diante.
    async definirConfirmacaoAtendimento(tenantId, modo) {
        if (!['automatica', 'recepcao'].includes(modo)) {
            throw new AppError('Forma de confirmar atendimentos inválida', 400)
        }
        const clinica = await UserModel.findById(tenantId, 'confirmacaoAtendimento').lean()
        if (!clinica) {
            throw new AppError('Clínica não encontrada', 404)
        }
        if ((clinica.confirmacaoAtendimento ?? 'automatica') !== modo) {
            await UserModel.updateOne({ _id: tenantId }, { $set: { confirmacaoAtendimento: modo, confirmacaoDesde: modo === 'recepcao' ? hojeDiaPuro() : null } })
            if (modo === 'automatica') await AgendaService.realizarFinalizados(tenantId)
        }
        return modo
    },

    async findAll() {
        return await UserModel.find()
    },

    async findAllByTenant(tenantId) {
        return await UserModel.find({ tenantId })
    },

    // A recepção também administra os usuários da clínica, mas não as contas de administrador: trocar a senha
    // do dono daria a ela tudo o que só o admin pode (como cancelar a assinatura).
    async exigirPodeAlterarUsuario(tenantId, id, papelDeQuemAltera) {
        const alvo = await UserModel.findOne({ _id: id, tenantId }, 'role')
        if (!alvo) {
            throw new AppError('Usuário não encontrado', 404)
        }
        if (papelDeQuemAltera === 'recepcao' && ['admin', 'super_admin'].includes(alvo.role)) {
            throw new AppError('Só o administrador da clínica pode alterar a conta de um administrador', 403)
        }
    },

    async createUsuarioDaClinica(tenantId, body) {
        await exigirPlanoComEquipe(tenantId)
        const userDTO = createUserDTO(body)
        userDTO.password = await argon2.hash(userDTO.password)
        userDTO.role = ['profissional', 'recepcao'].includes(body.role) ? body.role : 'recepcao'

        if (!userDTO.nomeEmpresa) {
            const criador = await UserModel.findById(tenantId)
            userDTO.nomeEmpresa = criador?.nomeEmpresa ?? ''
        }

        try {
            return await UserModel.create({ ...userDTO, tenantId })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um usuário com este e-mail', 409)
            }
            throw error
        }
    },

    async updateUsuarioDaClinica(tenantId, id, body, papelDeQuemAltera) {
        await this.exigirPodeAlterarUsuario(tenantId, id, papelDeQuemAltera)
        const userDTO = updateUserDTO(body)
        if (['profissional', 'recepcao'].includes(body.role)) {
            userDTO.role = body.role
        }

        let user
        try {
            user = await UserModel.findOneAndUpdate(
                { _id: id, tenantId },
                { $set: userDTO },
                { new: true, runValidators: true }
            )
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um usuário com este e-mail', 409)
            }
            throw error
        }
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        return user
    },

    async deleteUsuarioDaClinica(tenantId, id, papelDeQuemAltera) {
        await this.exigirPodeAlterarUsuario(tenantId, id, papelDeQuemAltera)
        const user = await UserModel.findOneAndDelete({ _id: id, tenantId })
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        return null
    },

    async resetPasswordUsuarioDaClinica(tenantId, id, novaSenha, papelDeQuemAltera) {
        await this.exigirPodeAlterarUsuario(tenantId, id, papelDeQuemAltera)
        const user = await UserModel.findOne({ _id: id, tenantId })
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        user.password = await argon2.hash(novaSenha)
        await user.save()
        return null
    },

    async findMe(id) {
        const user = await UserModel.findById(id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        return await comPaisDaClinica(user)
    },

    async updateMe(id, tenantId, role, body) {
        const ehAfiliado = !!(await UserModel.findById(id, 'afiliadoDesde'))?.afiliadoDesde
        const userDTO = updateMeDTO(body, role, ehAfiliado)

        let user
        try {
            user = await UserModel.findOneAndUpdate(
                { _id: id },
                { $set: userDTO },
                { new: true, runValidators: true }
            )
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe um usuário com este e-mail', 409)
            }
            throw error
        }
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        if (userDTO.nomeEmpresa) {
            await UserModel.updateMany({ tenantId }, { $set: { nomeEmpresa: userDTO.nomeEmpresa } })
        }

        return user
    },

    async updateMyPassword(id, body, via) {
        const { currentPassword, newPassword } = body
        if (!newPassword) {
            throw new AppError('Informe a nova senha', 400)
        }
        if (newPassword.length < 6) {
            throw new AppError('A nova senha deve ter ao menos 6 caracteres', 400)
        }

        const user = await UserModel.findById(id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        // Sem pedir a senha atual: conta criada pelo Google (ainda sem senha) ou sessão aberta pelo Google,
        // que é o caminho de quem esqueceu a senha.
        if (user.password && via !== 'google') {
            const valid = await argon2.verify(user.password, currentPassword || '')
            if (!valid) {
                throw new AppError('Senha atual incorreta', 400)
            }
        }

        user.password = await argon2.hash(newPassword)
        await user.save()
        return null
    },

    async findById(id) {
        const user = await UserModel.findById(id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        return user
    },

    async createUser(body, idioma = 'pt') {
        const userDTO = createUserDTO(body)
        userDTO.password = await argon2.hash(userDTO.password)

        const newId = new mongoose.Types.ObjectId()
        const isNovaClinica = !body.tenantId
        if (isNovaClinica && body.aceitouTermos !== true) {
            throw new AppError('Para criar a conta, leia e aceite os Termos de uso', 400)
        }
        const indicador = isNovaClinica ? await IndicacaoService.buscarIndicador(body.codigoIndicacao) : null

        const user = await UserModel.create({
            ...userDTO,
            _id: newId,
            tenantId: body.tenantId || newId,
            ...(isNovaClinica ? { termosAceitosEm: new Date(), termosVersao: `clinica-${TERMOS_CLINICA_VERSAO}` } : {}),
        })

        if (isNovaClinica) {
            await AssinaturaService.criarAssinaturaTrial(newId)
            await IndicacaoService.registrar(indicador, newId)
            enviarBoasVindas(user, idioma)
            alertarNovoCadastro(user, { via: 'senha', idioma, codigoIndicacao: body.codigoIndicacao })
        }

        return user
    },

    async updateUser(id, body) {
        const userDTO = updateUserDTO(body)
        const user = await UserModel.findByIdAndUpdate(id, { $set: userDTO }, { new: true, runValidators: true })

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        return user
    },

    async deleteUser(id) {
        const user = await UserModel.findByIdAndDelete(id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        return null
    },

    async loginUser(body) {
        const userDTO = loginUserDTO(body)
        const { email, password } = userDTO
        const user = await UserModel.findOne({ email })
        if (!user) {
            throw new AppError('Email ou senha incorretos', 401)
        }
        if (!user.password) {
            throw new AppError('Esta conta entra pelo Google. Use o botão "Continuar com o Google".', 401)
        }
        const valid = await argon2.verify(user.password, password || '')
        if (!valid) {
            throw new AppError('Email ou senha incorretos', 401)
        }
        return await emitirSessao(user)
    },

    // Login e cadastro pelo Google. E-mail já cadastrado: entra na conta (admin, profissional ou recepção).
    // E-mail novo sem `cadastro`: devolve { novoCadastro } para o site pedir os dados da clínica;
    // com `cadastro`: cria a clínica, com o período de teste, e já entra.
    async entrarComGoogle(body, idioma = 'pt') {
        const { credential, cadastro } = body ?? {}
        const google = await GoogleAuth.verificar(credential)

        const user = await UserModel.findOne({ email: google.email })
        if (user) {
            if (user.googleId && user.googleId !== google.googleId) {
                throw new AppError('Este e-mail já está ligado a outra conta do Google', 409)
            }
            user.googleId = google.googleId
            return await emitirSessao(user, 'google')
        }

        if (!cadastro) {
            return { novoCadastro: true, nomeCompleto: google.nome, email: google.email }
        }

        const nomeCompleto = String(cadastro.nomeCompleto ?? '').trim() || google.nome
        const nomeEmpresa = String(cadastro.nomeEmpresa ?? '').trim()
        const telefone = String(cadastro.telefone ?? '').trim()
        if (!nomeEmpresa || !telefone) {
            throw new AppError('Informe o nome da clínica e o telefone', 400)
        }

        if (cadastro.aceitouTermos !== true) {
            throw new AppError('Para criar a conta, leia e aceite os Termos de uso', 400)
        }
        const indicador = await IndicacaoService.buscarIndicador(cadastro.codigoIndicacao)
        const newId = new mongoose.Types.ObjectId()
        let novo
        try {
            novo = await UserModel.create({
                _id: newId,
                tenantId: newId,
                role: 'admin',
                nomeCompleto,
                email: google.email,
                googleId: google.googleId,
                password: null,
                telefone,
                nomeEmpresa,
                cnpj: String(cadastro.cnpj ?? '').trim() || null,
                pais: paisValido(cadastro.pais) ?? 'BR',
                termosAceitosEm: new Date(),
                termosVersao: `clinica-${TERMOS_CLINICA_VERSAO}`,
            })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe uma conta com este e-mail. Entre pela tela de login.', 409)
            }
            throw error
        }
        await AssinaturaService.criarAssinaturaTrial(newId)
        await IndicacaoService.registrar(indicador, newId)
        enviarBoasVindas(novo, idioma)
        alertarNovoCadastro(novo, { via: 'google', idioma, codigoIndicacao: cadastro.codigoIndicacao })
        return await emitirSessao(novo, 'google')
    },

    async logoutUser(id) {
        const user = await UserModel.findById(id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        user.tokenRefresh = null
        await user.save()
        return null
    },

    async refresh(refreshToken) {
        let decoded

        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)
        } catch (error) {
            throw new AppError('Refresh token inválido ou expirado', 401)
        }

        const user = await UserModel.findById(decoded.id)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        if (user.tokenRefresh !== refreshToken) {
            throw new AppError('Refresh token inválido', 401)
        }

        const newAccessToken = jwt.sign(
            { id: user._id, tenantId: user.tenantId, role: user.role, via: decoded.via ?? 'senha' },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        )

        return { accessToken: newAccessToken }
    },

    async updatePassword(id, body) {
        const { currentPassword, newPassword } = body
        const user = await UserModel.findById(id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        const valid = await argon2.verify(user.password, currentPassword)
        if (!valid) {
            throw new AppError('Senha atual inválida', 401)
        }
        user.password = await argon2.hash(newPassword)
        await user.save()
        return null
    },
}