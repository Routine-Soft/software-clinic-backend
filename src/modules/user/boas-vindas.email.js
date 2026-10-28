import { enviarEmail } from '../shared/utils/email.js'

// E-mail de boas-vindas para quem acabou de criar a clínica (cadastro normal ou pelo Google).
const WHATSAPP_SUPORTE = '+55 21 99200-2356'
const WHATSAPP_LINK = 'https://wa.me/5521992002356'
const EMAIL_SUPORTE = 'stanleyclientes@gmail.com'

// Textos do e-mail nos três idiomas do site (o cadastro chega com o idioma da tela).
const TEXTOS_DO_EMAIL = {
    pt: {
        lang: 'pt-BR',
        assunto: 'Boas-vindas à Sonelia!',
        ola: 'Olá',
        titulo: 'Boas-vindas à Sonelia!',
        saudacao: (nome) => `${nome}, que bom ter você aqui! Sua conta foi criada e a sua clínica já pode usar a Sonelia.`,
        ajuda: 'Se precisar de ajuda com qualquer coisa, é só entrar em contato comigo:',
        whatsapp: 'WhatsApp',
        email: 'E-mail',
        assinatura: 'Stanley, da Sonelia',
    },
    en: {
        lang: 'en',
        assunto: 'Welcome to Sonelia!',
        ola: 'Hi',
        titulo: 'Welcome to Sonelia!',
        saudacao: (nome) => `${nome}, great to have you here! Your account has been created and your clinic can start using Sonelia.`,
        ajuda: 'If you need help with anything, just get in touch with me:',
        whatsapp: 'WhatsApp',
        email: 'Email',
        assinatura: 'Stanley, from Sonelia',
    },
    es: {
        lang: 'es',
        assunto: '¡Bienvenido a Sonelia!',
        ola: 'Hola',
        titulo: '¡Bienvenido a Sonelia!',
        saudacao: (nome) => `${nome}, ¡qué bueno tenerte aquí! Tu cuenta fue creada y tu clínica ya puede usar Sonelia.`,
        ajuda: 'Si necesitas ayuda con cualquier cosa, solo ponte en contacto conmigo:',
        whatsapp: 'WhatsApp',
        email: 'Correo',
        assinatura: 'Stanley, de Sonelia',
    },
}

function emailDeBoasVindas(nome, idioma = 'pt') {
    const T = TEXTOS_DO_EMAIL[idioma] ?? TEXTOS_DO_EMAIL.pt
    const primeiroNome = (nome || '').trim().split(/\s+/)[0] || T.ola
    const texto = `${T.saudacao(primeiroNome)}\n\n${T.ajuda}\n${T.whatsapp}: ${WHATSAPP_SUPORTE} (${WHATSAPP_LINK})\n${T.email}: ${EMAIL_SUPORTE}\n\n${T.assinatura}`
    const html = `<!doctype html>
<html lang="${T.lang}"><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <tr><td>
      <div style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;border-radius:12px;background:#1e3a8a;color:#fff;font-family:Georgia,serif;font-size:20px">So</div>
      <h1 style="font-size:20px;margin:20px 0 8px">${T.titulo}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${T.saudacao(primeiroNome)}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">${T.ajuda}</p>
      <p style="margin:0 0 12px"><a href="${WHATSAPP_LINK}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold">${T.whatsapp}: ${WHATSAPP_SUPORTE}</a></p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${T.email}: <a href="mailto:${EMAIL_SUPORTE}" style="color:#0f766e">${EMAIL_SUPORTE}</a></p>
      <p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0">${T.assinatura}</p>
    </td></tr>
  </table>
</body></html>`
    return { html, texto, assunto: T.assunto }
}

// Não trava o cadastro: se o Resend falhar, a conta continua criada e o erro fica só no log.
export function enviarBoasVindas(user, idioma = 'pt') {
    const { html, texto, assunto } = emailDeBoasVindas(user.nomeCompleto, idioma)
    enviarEmail({ para: user.email, assunto, html, texto }).catch((error) => {
        console.error(`Não foi possível enviar o e-mail de boas-vindas para ${user.email}: ${error.message}`)
    })
}
