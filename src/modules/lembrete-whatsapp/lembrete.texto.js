// Texto do lembrete com as variáveis trocadas: {paciente}, {clinica}, {data}, {hora} e {profissional}.
// Variável sem valor some (sem deixar "{...}" na mensagem).
export const VARIAVEIS = ['paciente', 'clinica', 'data', 'hora', 'profissional']

export function montarTexto(modelo, valores) {
    return String(modelo ?? '')
        .replace(/\{(\w+)\}/g, (trecho, nome) => (VARIAVEIS.includes(nome) ? String(valores[nome] ?? '') : trecho))
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}
