import { OAuth2Client } from 'google-auth-library'
import AppError from '../../errors/AppError.js'

// O Client ID é público (vai no botão do site); o .env pode trocá-lo sem mexer no código.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    || '1022121828002-pf838u13cosngkb5uffb3slq1foneq0c.apps.googleusercontent.com'

const client = new OAuth2Client()

export const GoogleAuth = {
    // Confere a assinatura, a validade e o destinatário do token entregue pelo botão do Google.
    async verificar(credential) {
        if (!credential || typeof credential !== 'string') {
            throw new AppError('Login com o Google não recebido', 400)
        }

        let dados
        try {
            const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
            dados = ticket.getPayload()
        } catch {
            throw new AppError('Não foi possível confirmar o login com o Google. Tente de novo.', 401)
        }

        if (!dados?.email || !dados.email_verified) {
            throw new AppError('Esta conta do Google não tem um e-mail confirmado', 401)
        }

        return { googleId: dados.sub, email: dados.email.toLowerCase(), nome: dados.name || dados.email }
    },
}
