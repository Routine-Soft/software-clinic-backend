import { randomBytes, createHash } from 'node:crypto'
import argon2 from 'argon2'
import UserModel from './user.model.js'
import { enviarEmail } from '../shared/utils/email.js'
import AppError from '../../errors/AppError.js'

// "Esqueci a senha": o link mandado por e-mail vale por 1 hora e uma vez só. No banco fica só o hash do código,
// para que quem lê o banco não consiga usar o link.
const VALIDADE_MS = 60 * 60 * 1000
// Um pedido por minuto por e-mail, para ninguém usar a tela para encher a caixa de entrada de outra pessoa.
const INTERVALO_MINIMO_MS = 60 * 1000

function hash(codigo) {
    return createHash('sha256').update(codigo).digest('hex')
}

function linkDeRedefinicao(codigo) {
    const base = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
    return `${base}/#/redefinir-senha/${codigo}`
}

// Textos do e-mail nos dois idiomas do site (o pedido chega com o idioma da tela).
const TEXTOS_DO_EMAIL = {
    pt: {
        lang: 'pt-BR',
        assunto: 'Redefinir a sua senha da Sonelia',
        ola: 'Olá',
        titulo: 'Redefinir a sua senha',
        pedido: (nome) => `${nome}, recebemos um pedido para redefinir a senha da sua conta na Sonelia.`,
        cliqueNoBotao: 'Clique no botão para criar uma senha nova:',
        botao: 'Criar senha nova',
        validade: 'O link vale por 1 hora e só pode ser usado uma vez. Se o botão não abrir, copie e cole no navegador:',
        naoFoiVoce: 'Não foi você? Ignore este e-mail: sua senha continua a mesma.',
        linkTexto: 'Crie uma senha nova por este link (vale por 1 hora):',
    },
    en: {
        lang: 'en',
        assunto: 'Reset your Sonelia password',
        ola: 'Hi',
        titulo: 'Reset your password',
        pedido: (nome) => `${nome}, we received a request to reset the password of your Sonelia account.`,
        cliqueNoBotao: 'Click the button to create a new password:',
        botao: 'Create new password',
        validade: 'The link is valid for 1 hour and can only be used once. If the button doesn’t open, copy and paste this into your browser:',
        naoFoiVoce: 'Wasn’t you? Ignore this email: your password stays the same.',
        linkTexto: 'Create a new password with this link (valid for 1 hour):',
    },
}

function emailDeRedefinicao(nome, link, idioma = 'pt') {
    const T = TEXTOS_DO_EMAIL[idioma] ?? TEXTOS_DO_EMAIL.pt
    const primeiroNome = (nome || '').trim().split(/\s+/)[0] || T.ola
    const texto = `${T.pedido(primeiroNome)}\n\n${T.linkTexto} ${link}\n\n${T.naoFoiVoce}`
    const html = `<!doctype html>
<html lang="${T.lang}"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <div style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border-radius:12px;background:#1e3a8a;color:#fff;font-family:Georgia,serif;font-size:20px">So</div>
      <h1 style="font-size:20px;margin:20px 0 8px">${T.titulo}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${T.pedido(primeiroNome)} ${T.cliqueNoBotao}</p>
      <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold">${T.botao}</a></p>
      <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0 0 8px">${T.validade}<br><span style="word-break:break-all">${link}</span></p>
      <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:16px 0 0">${T.naoFoiVoce}</p>
    </td></tr>
  </table>
</body></html>`
    return { html, texto, assunto: T.assunto }
}

export const RecuperarSenhaService = {
    // Responde igual exista ou não a conta, para a tela não revelar quais e-mails são cadastrados.
    async pedirLink(email, idioma = 'pt') {
        const normalizado = typeof email === 'string' ? email.toLowerCase().replace(/\s+/g, '') : ''
        if (!normalizado.includes('@')) throw new AppError('Informe o seu e-mail', 400)

        const user = await UserModel.findOne({ email: normalizado })
        if (!user) return

        const agora = Date.now()
        const pedidoAnterior = user.resetPasswordExpires ? user.resetPasswordExpires.getTime() - VALIDADE_MS : 0
        if (agora - pedidoAnterior < INTERVALO_MINIMO_MS) return

        const codigo = randomBytes(32).toString('hex')
        user.resetPasswordToken = hash(codigo)
        user.resetPasswordExpires = new Date(agora + VALIDADE_MS)
        await user.save()

        const { html, texto, assunto } = emailDeRedefinicao(user.nomeCompleto, linkDeRedefinicao(codigo), idioma)
        try {
            await enviarEmail({ para: user.email, assunto, html, texto })
        } catch (error) {
            // Sem e-mail enviado, o pedido não conta para o limite de um por minuto.
            await UserModel.updateOne({ _id: user._id }, { $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } })
            throw error
        }
    },

    async redefinir(codigo, novaSenha) {
        if (typeof novaSenha !== 'string' || novaSenha.length < 6) {
            throw new AppError('A nova senha deve ter ao menos 6 caracteres', 400)
        }
        if (typeof codigo !== 'string' || !/^[0-9a-f]{64}$/.test(codigo)) {
            throw new AppError('Link inválido. Peça um novo na tela de login.', 400)
        }

        // Atômico: o mesmo link não serve duas vezes. A troca encerra as sessões abertas em outros aparelhos.
        const user = await UserModel.findOneAndUpdate(
            { resetPasswordToken: hash(codigo), resetPasswordExpires: { $gt: new Date() } },
            { $set: { password: await argon2.hash(novaSenha), tokenRefresh: null }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } },
            { returnDocument: 'after' }
        )
        if (!user) throw new AppError('Este link expirou ou já foi usado. Peça um novo na tela de login.', 400)
    },
}
