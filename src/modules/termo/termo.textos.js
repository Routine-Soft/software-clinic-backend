// Modelos de exemplo criados para a clínica na primeira vez que ela abre os termos. São um ponto de partida:
// a clínica revisa e ajusta o texto às regras do conselho dela.
export const MODELOS_PADRAO = [
    {
        titulo: 'TCLE – Atendimento psicológico',
        texto: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO

Eu, {{paciente}}, CPF {{cpf}}, nascido(a) em {{dataNascimento}}{{representadoPor}}, declaro que recebi da {{clinica}} e do(a) profissional {{profissional}} {{registro}} as informações abaixo e concordo com o atendimento psicológico.

1. Objetivo: o atendimento busca acolher e trabalhar as demandas trazidas por mim, com técnicas reconhecidas pela Psicologia.

2. Sessões: a frequência, a duração e a forma (presencial ou online) são combinadas com o(a) profissional. Faltas e remarcações seguem as regras informadas pela clínica.

3. Sigilo: tudo o que for dito nas sessões é sigiloso, conforme o Código de Ética Profissional do Psicólogo. O sigilo só pode ser quebrado nas situações previstas em lei ou no Código de Ética, como risco à vida.

4. Registros: o(a) profissional mantém um prontuário com o registro dos atendimentos, guardado com segurança pelo prazo exigido em lei.

5. Dados pessoais: meus dados são usados só para o atendimento e a administração da clínica, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).

6. Liberdade: posso tirar dúvidas a qualquer momento e posso interromper o atendimento quando quiser, sem nenhum prejuízo.

Li e entendi este termo e concordo, de forma livre e esclarecida, com o atendimento.

{{dataExtenso}}`,
    },
    {
        titulo: 'TCLE – Avaliação neuropsicológica',
        texto: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO – AVALIAÇÃO NEUROPSICOLÓGICA

Eu, {{paciente}}, CPF {{cpf}}, nascido(a) em {{dataNascimento}}{{representadoPor}}, autorizo a realização de avaliação neuropsicológica pela {{clinica}}, com o(a) profissional {{profissional}} {{registro}}.

1. Objetivo: investigar funções como atenção, memória, linguagem, raciocínio e comportamento, para ajudar no diagnóstico e no planejamento do tratamento.

2. Como funciona: entrevistas, testes, escalas e tarefas aplicados em algumas sessões. Podem ser ouvidos familiares, a escola ou outros profissionais, com a minha autorização.

3. Riscos e desconfortos: a avaliação não traz riscos à saúde. Pode haver cansaço ou ansiedade durante os testes; nesses casos, a sessão pode ser pausada ou remarcada.

4. Resultado: ao final, recebo um laudo ou relatório e uma sessão de devolutiva para explicar os resultados.

5. Sigilo: as informações são sigilosas, conforme o Código de Ética Profissional, e só são compartilhadas com a minha autorização ou nos casos previstos em lei.

6. Dados pessoais: meus dados são tratados conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).

7. Liberdade: posso tirar dúvidas e desistir da avaliação a qualquer momento, sem nenhum prejuízo.

Li e entendi este termo e concordo, de forma livre e esclarecida, com a avaliação.

{{dataExtenso}}`,
    },
]

// Marcadores aceitos no texto do modelo (a tela mostra esta lista para quem escreve o termo).
export const MARCADORES = ['paciente', 'cpf', 'dataNascimento', 'responsavel', 'representadoPor', 'profissional', 'registro', 'clinica', 'data', 'dataExtenso']

const VAZIO = '________________'

function formatarCpf(cpf = '') {
    const digitos = String(cpf).replace(/\D/g, '')
    return digitos.length === 11 ? digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : String(cpf).trim()
}

// Data de nascimento é gravada como meia-noite UTC: lê os componentes em UTC para não voltar um dia.
function formatarDataPura(data) {
    if (!data) return ''
    const d = new Date(data)
    if (Number.isNaN(d.getTime())) return ''
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

export function dataDeHoje(agora = new Date()) {
    return agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function dataPorExtenso(agora = new Date()) {
    const [dia, mes, ano] = dataDeHoje(agora).split('/').map(Number)
    return `${dia} de ${MESES[mes - 1]} de ${ano}`
}

// Troca {{marcador}} pelos dados. Marcador sem dado vira uma linha em branco; marcador desconhecido fica como está.
export function preencherTexto(texto, { paciente, profissional, clinica }, agora = new Date()) {
    const responsavel = (paciente?.responsaveis ?? []).map((r) => r.nome).filter(Boolean).join(' / ')
    const valores = {
        paciente: paciente?.nome,
        cpf: formatarCpf(paciente?.cpf),
        dataNascimento: formatarDataPura(paciente?.dataNascimento),
        responsavel,
        representadoPor: responsavel ? `, representado(a) pelo(a) responsável legal ${responsavel}` : '',
        profissional: profissional?.nome,
        registro: profissional ? `(${profissional.tipoRegistro} ${profissional.numeroRegistro})` : '',
        clinica: clinica?.nomeEmpresa,
        data: dataDeHoje(agora),
        dataExtenso: dataPorExtenso(agora),
    }
    return String(texto).replace(/\{\{\s*(\w+)\s*\}\}/g, (trecho, nome) => {
        if (!(nome in valores)) return trecho
        // Estes podem sumir de vez (não viram linha em branco).
        if (nome === 'registro' || nome === 'representadoPor') return valores[nome]
        return valores[nome] ? String(valores[nome]) : VAZIO
    })
}
