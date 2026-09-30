import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import UserModel from './user.model.js'
import { AssinaturaService } from '../assinatura/assinatura.service.js'
import { GoogleAuth } from './google-auth.js'

import { createUserDTO, updateUserDTO, updateMeDTO, loginUserDTO } from './user.dto.js'
import AppError from '../../errors/AppError.js'

async function emitirSessao(user) {
    const payload = { id: user._id, tenantId: user.tenantId, role: user.role }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' })
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' })
    user.tokenRefresh = refreshToken
    await user.save()
    return { accessToken, refreshToken, user: user.toJSON() }
}

export const UserService = {
    async findAll() {
        return await UserModel.find()
    },

    async findAllByTenant(tenantId) {
        return await UserModel.find({ tenantId })
    },

    async createUsuarioDaClinica(tenantId, body) {
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

    async updateUsuarioDaClinica(tenantId, id, body) {
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

    async deleteUsuarioDaClinica(tenantId, id) {
        const user = await UserModel.findOneAndDelete({ _id: id, tenantId })
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }
        return null
    },

    async resetPasswordUsuarioDaClinica(tenantId, id, novaSenha) {
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
        return user
    },

    async updateMe(id, tenantId, role, body) {
        const userDTO = updateMeDTO(body, role)

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

    async updateMyPassword(id, body) {
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

        // Conta criada pelo Google ainda não tem senha: a primeira é definida sem pedir a atual.
        if (user.password) {
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

    async createUser(body) {
        const userDTO = createUserDTO(body)
        userDTO.password = await argon2.hash(userDTO.password)

        const newId = new mongoose.Types.ObjectId()
        const isNovaClinica = !body.tenantId

        const user = await UserModel.create({
            ...userDTO,
            _id: newId,
            tenantId: body.tenantId || newId,
        })

        if (isNovaClinica) {
            await AssinaturaService.criarAssinaturaTrial(newId)
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
    async entrarComGoogle(body) {
        const { credential, cadastro } = body ?? {}
        const google = await GoogleAuth.verificar(credential)

        const user = await UserModel.findOne({ email: google.email })
        if (user) {
            if (user.googleId && user.googleId !== google.googleId) {
                throw new AppError('Este e-mail já está ligado a outra conta do Google', 409)
            }
            user.googleId = google.googleId
            return await emitirSessao(user)
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
            })
        } catch (error) {
            if (error.code === 11000) {
                throw new AppError('Já existe uma conta com este e-mail. Entre pela tela de login.', 409)
            }
            throw error
        }
        await AssinaturaService.criarAssinaturaTrial(newId)
        return await emitirSessao(novo)
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
            { id: user._id, tenantId: user.tenantId, role: user.role },
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