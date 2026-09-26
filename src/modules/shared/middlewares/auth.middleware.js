import jwt from 'jsonwebtoken'
import AppError from '../../../errors/AppError.js'
import UserModel from '../../../modules/user/user.model.js'

export async function authenticate(req, reply) {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        throw new AppError('Token não fornecido', 401)
    }

    const token = authHeader.replace('Bearer ', '')

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
    } catch (error) {
        throw new AppError('Token inválido', 401)
    }
}

export function authorize(allowedRoles = []) {
    return async function (req, reply) {
        if (!req.user?.id) {
            throw new AppError('Token inválido', 401)
        }

        const user = await UserModel.findById(req.user.id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        if (!allowedRoles.includes(user.role)) {
            throw new AppError('Acesso negado', 403)
        }
    }
}