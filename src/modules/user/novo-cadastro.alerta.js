import { avisarNoTelegram } from '../shared/utils/telegram.js'

// Avisa o Stanley no Telegram a cada clínica nova cadastrada, com os dados da conta (nunca a senha).
export function alertarNovoCadastro(user, { via, idioma, codigoIndicacao }) {
    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const linhas = [
        '🎉 Nova clínica cadastrada na Sonelia!',
        '',
        `Nome: ${user.nomeCompleto}`,
        `E-mail: ${user.email}`,
        `Telefone: ${user.telefone || '-'}`,
        `Clínica: ${user.nomeEmpresa || '-'}`,
        `CNPJ/CPF: ${user.cnpj || '-'}`,
        `País: ${user.pais || 'BR'}`,
        `Idioma do site: ${idioma}`,
        `Cadastro por: ${via === 'google' ? 'Google' : 'e-mail e senha'}`,
        `Código de indicação: ${codigoIndicacao || '-'}`,
        `Data: ${quando}`,
        `ID: ${user._id}`,
    ]
    avisarNoTelegram(linhas.join('\n'))
}
