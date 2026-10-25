// Modelos de anamnese que toda clínica recebe prontos (pode editar, duplicar ou apagar).
// `chave` identifica o modelo padrão de origem: a avaliação neuropsicológica usa o de chave 'neuropsicologica'.

const curto = (rotulo, extra = {}) => ({ tipo: 'curto', rotulo, ...extra })
const longo = (rotulo, extra = {}) => ({ tipo: 'longo', rotulo, ...extra })
const data = (rotulo, extra = {}) => ({ tipo: 'data', rotulo, ...extra })
const marcar = (rotulo, opcoes, extra = {}) => ({ tipo: 'marcar', rotulo, opcoes, ...extra })
const escolha = (rotulo, opcoes, extra = {}) => ({ tipo: 'escolha', rotulo, opcoes, ...extra })
const secao = (titulo, perguntas, descricao = '') => ({ titulo, descricao, perguntas })

// Ids estáveis (s1, s1p1...): as respostas apontam para eles.
function comIds(secoes) {
    return secoes.map((s, i) => ({
        id: `s${i + 1}`,
        ...s,
        perguntas: s.perguntas.map((p, j) => ({ id: `s${i + 1}p${j + 1}`, dica: '', opcoes: [], outro: false, auto: null, ...p })),
    }))
}

const ESCOLARIDADE = ['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação']
const INDEPENDENCIA = ['Independente', 'Precisa de supervisão', 'Precisa de ajuda parcial', 'Dependente']

// Roteiro "Anamnese Neuropsicológica — adultos e entrevista com pais/responsáveis" enviado pela clínica.
const NEUROPSICOLOGICA = comIds([
    secao('Dados da avaliação', [
        data('Data da entrevista', { auto: 'hoje' }),
        curto('Profissional responsável', { auto: 'profissionalNome' }),
        marcar('Modalidade', ['Presencial', 'On-line', 'Entrevista inicial', 'Entrevista complementar']),
        curto('Fontes de informação / informantes'),
        curto('Documentos analisados (quando houver)'),
    ], 'Instrumento de apoio à entrevista clínica e à coleta sistematizada de dados para avaliação neuropsicológica. O preenchimento deve ser complementado por entrevista, observação clínica, documentos, escalas e instrumentos psicológicos pertinentes.'),
    secao('Identificação do(a) avaliado(a)', [
        curto('Nome completo', { auto: 'pacienteNome' }),
        curto('Nome social / pronome (se informado)'),
        data('Data de nascimento', { auto: 'pacienteNascimento' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Gênero'),
        curto('Estado civil (adulto)'),
        curto('Escolaridade / série atual'),
        curto('Profissão / ocupação (adulto)'),
        curto('Instituição de ensino / trabalho'),
        curto('Endereço / cidade'),
        curto('Telefones / e-mail', { auto: 'pacienteContato' }),
    ]),
    secao('Contexto da entrevista e responsável pelas informações', [
        marcar('Entrevista com', [
            'O próprio avaliado (adulto)', 'Mãe', 'Pai', 'Ambos os responsáveis', 'Outro familiar', 'Cônjuge/parceiro(a)', 'Professor(a) / escola',
        ], { outro: true }),
        curto('Nome do(a) informante'),
        curto('Grau de parentesco / vínculo'),
        curto('Convivência com o(a) avaliado(a)'),
        longo('Observações sobre a qualidade, consistência e divergências nas informações prestadas'),
    ]),
    secao('Demanda e motivo da avaliação', [
        longo('Quem solicitou a avaliação e qual é a finalidade (clínica, escolar, ocupacional, médica, jurídica, autoconhecimento, outra)?'),
        longo('Queixas principais atuais — descreva início, frequência, intensidade, contextos e impactos no cotidiano'),
        marcar('Áreas das queixas', [
            'Atenção / distração', 'Hiperatividade / inquietação', 'Impulsividade', 'Organização / planejamento', 'Memória / esquecimentos',
            'Aprendizagem', 'Linguagem / comunicação', 'Interação social', 'Comportamentos repetitivos / rigidez', 'Ansiedade',
            'Humor / tristeza', 'Sono', 'Sensibilidades sensoriais', 'Altas habilidades / facilidade de aprendizagem',
        ], { outro: true }),
        longo('Expectativas do(a) avaliado(a), família e/ou encaminhante quanto à avaliação'),
    ]),
    secao('Entrevista específica — adulto', [
        curto('Com quem reside atualmente?'),
        curto('Composição familiar / filhos / rede de apoio'),
        longo('Descreva rotina, atividades cotidianas, responsabilidades e nível de autonomia'),
        longo('Trajetória acadêmica: rendimento, disciplinas de maior/menor facilidade, repetências, adaptações, dificuldades, interesses e formação'),
        longo('Trajetória ocupacional: empregos, desempenho, mudanças frequentes, relações no trabalho, organização, pontualidade e impacto funcional'),
        longo('Relacionamentos afetivos, amizades, participação social e dificuldades percebidas'),
        longo('Histórico financeiro, administração prática, autocuidado, deslocamento, uso de transporte e manejo de compromissos'),
    ], 'Preencher quando o(a) avaliado(a) for adulto.'),
    secao('Entrevista específica — pais/responsáveis por criança ou adolescente', [
        curto('Nome do(a) responsável'),
        curto('Parentesco'),
        curto('Guarda / configuração familiar'),
        curto('Com quem a criança/adolescente reside?'),
        curto('Irmãos (idades e condições relevantes)'),
        longo('Descreva a rotina da criança/adolescente, nível de autonomia e principais situações de dificuldade'),
        longo('Motivo da avaliação segundo os responsáveis e quando os sinais foram percebidos'),
        longo('Comportamento em casa, na escola, em ambientes sociais e em situações novas'),
        longo('Informações da escola: rendimento, participação, comportamento, adaptações, queixas de professores, apoio pedagógico e histórico de repetência'),
        curto('Escola atual / turma / turno'),
        curto('Já recebeu acompanhante, mediador, AEE, reforço ou adaptação? Detalhar'),
    ], 'Preencher quando o(a) avaliado(a) for criança ou adolescente.'),
    secao('Gestação, nascimento e desenvolvimento', [
        marcar('Gestação e nascimento', [
            'Gestação planejada', 'Pré-natal regular', 'Intercorrências gestacionais', 'Uso de medicação', 'Uso de álcool/tabaco/outras substâncias',
            'Parto vaginal', 'Cesárea', 'Prematuridade', 'UTI neonatal', 'Baixo peso ao nascer', 'Icterícia',
        ], { outro: true }),
        longo('Detalhamento de intercorrências e condições ao nascimento'),
        curto('Idade aproximada para sustentar a cabeça / sentar / engatinhar / andar'),
        curto('Primeiras palavras / frases / comunicação atual'),
        longo('Desenvolvimento motor, coordenação, quedas/acidentes, motricidade fina, letra e autonomia'),
        longo('Desenvolvimento da linguagem, compreensão, pragmática, ecolalia, interesses comunicativos e eventuais regressões'),
        curto('Controle esfincteriano / enurese / encoprese / particularidades'),
    ], 'Preencher quando aplicável.'),
    secao('Histórico médico, neurológico e psiquiátrico', [
        marcar('Ocorrências', [
            'Sem intercorrências relevantes relatadas', 'Atraso do desenvolvimento', 'Convulsões / epilepsia', 'TCE / traumatismo craniano', 'Desmaios',
            'Cirurgias', 'Internações', 'Doença crônica', 'Alterações endócrinas', 'Alterações cardíacas', 'Deficiência auditiva',
            'Deficiência visual', 'Dor crônica',
        ], { outro: true }),
        longo('Diagnósticos prévios, data aproximada, profissionais envolvidos e tratamentos realizados'),
        curto('Medicamentos atuais, dosagem e horário'),
        curto('Alergias e restrições relevantes'),
        longo('Acompanhamentos atuais ou anteriores (psicologia, psiquiatria, neurologia, fonoaudiologia, terapia ocupacional, psicopedagogia etc.)'),
        longo('Histórico familiar de TEA, TDAH, AH/SD, dificuldades de aprendizagem, deficiência intelectual, transtornos de humor/ansiedade, uso de substâncias, suicídio, doenças neurológicas ou outras condições relevantes'),
    ]),
    secao('Rotina, sono, alimentação e hábitos', [
        longo('Sono: horário, duração, despertares, ronco, pesadelos, sonolência diurna e qualidade do sono'),
        longo('Alimentação: seletividade, compulsão, restrições, rotina e particularidades sensoriais'),
        longo('Atividade física, lazer, uso de telas e interesses predominantes'),
        longo('Uso de álcool, tabaco, cannabis ou outras substâncias (adulto/adolescente, quando pertinente)'),
    ]),
    secao('Atenção, funções executivas e aprendizagem', [
        marcar('Sinais observados', [
            'Distrai-se com facilidade', 'Esquece compromissos / tarefas', 'Perde objetos', 'Dificuldade para iniciar tarefas',
            'Dificuldade para concluir tarefas', 'Procrastinação', 'Desorganização', 'Má gestão do tempo', 'Dificuldade de priorizar',
            'Dificuldade em seguir etapas', 'Necessita de lembretes frequentes', 'Hiperfoco', 'Inquietação motora', 'Interrompe pessoas',
            'Age sem pensar', 'Baixa tolerância à frustração',
        ]),
        longo('Exemplos concretos e impactos funcionais em casa, escola, trabalho e relações'),
        longo('Facilidades, talentos, interesses intensos, aprendizagem acelerada, criatividade, liderança ou indicadores de AH/SD'),
    ]),
    secao('Comunicação, interação social e perfil sensorial', [
        marcar('Sinais observados', [
            'Dificuldade para compreender ironia / linguagem implícita', 'Dificuldade em iniciar ou manter conversas', 'Fala excessiva ou muito reduzida',
            'Contato visual atípico', 'Dificuldade com reciprocidade social', 'Preferência por ficar só / grupos pequenos', 'Cansaço após interações sociais',
            'Ingenuidade / vulnerabilidade social', 'Dificuldade com mudanças', 'Necessidade de rotina / previsibilidade', 'Interesses restritos ou intensos',
            'Comportamentos repetitivos', 'Sensibilidade a sons', 'Sensibilidade a luz', 'Sensibilidade tátil', 'Sensibilidade a cheiros / sabores',
        ]),
        longo('Descreva exemplos, estratégias de adaptação, camuflagem social e impacto funcional'),
    ]),
    secao('Aspectos emocionais e comportamentais', [
        marcar('Sinais observados', [
            'Ansiedade', 'Crises de pânico', 'Irritabilidade', 'Oscilação de humor', 'Tristeza persistente', 'Isolamento social', 'Baixa autoestima',
            'Comportamento opositor', 'Agressividade', 'Autoagressão', 'Ideação suicida', 'Comportamentos de risco', 'Compulsões', 'Luto / trauma',
        ], { outro: true }),
        longo('Descreva início, gatilhos, frequência, duração, estratégias de enfrentamento e tratamentos'),
        longo('Avaliação de risco atual (quando aplicável): ideação, planejamento, tentativas, autoagressão, violência, acesso a meios e medidas de proteção'),
    ]),
    secao('Funcionalidade e autonomia', [
        marcar('Áreas com dificuldade', [
            'Cuidados pessoais', 'Organização do quarto/casa', 'Preparação de refeições', 'Uso de dinheiro', 'Pagamentos', 'Compras', 'Uso de transporte',
            'Uso de medicação', 'Agenda e compromissos', 'Documentos', 'Rotina escolar/profissional', 'Tomada de decisão', 'Segurança / noção de perigo',
        ]),
        longo('Grau de independência, necessidade de supervisão e exemplos de prejuízo funcional'),
    ]),
    secao('Histórico escolar e social detalhado', [
        longo('Educação infantil / ensino fundamental: adaptação, amizades, comportamento, aprendizagem, queixas e medidas de suporte'),
        longo('Adolescência / ensino médio / ensino superior (quando aplicável): desempenho, relações, dificuldades, interesses e eventos marcantes'),
        longo('Bullying, exclusão social, conflitos, trocas de escola, suspensões, evasão ou experiências relevantes'),
        longo('Atividades extracurriculares, esportes, arte, tecnologia, leitura, jogos e outros interesses'),
    ]),
    secao('Avaliações e documentos anteriores', [
        marcar('Documentos apresentados', [
            'Relatório escolar', 'Laudo médico', 'Avaliação psicológica/neuropsicológica prévia', 'Exames laboratoriais', 'Neuroimagem',
            'Receitas médicas', 'Plano educacional individualizado',
        ], { outro: true }),
        longo('Síntese dos dados relevantes dos documentos apresentados'),
    ]),
    secao('Observação clínica durante a entrevista', [
        longo('Apresentação geral, postura, vínculo, humor/afeto, discurso, atenção, compreensão, insight, comportamento motor, linguagem e colaboração'),
        longo('Fatores que possam influenciar a avaliação (sono, medicação, ansiedade, intercorrências, motivação, ambiente etc.)'),
    ]),
    secao('Síntese inicial da anamnese — preenchimento do profissional', [
        longo('Principais queixas e prejuízos funcionais identificados'),
        longo('Recursos, potencialidades, fatores de proteção e rede de apoio'),
        longo('Aspectos a investigar ao longo da avaliação'),
        longo('Procedimentos, escalas, entrevistas complementares e documentos recomendados'),
        data('Data', { auto: 'hoje' }),
        curto('Nome do(a) profissional', { auto: 'profissionalNome' }),
    ]),
    secao('Ciência e autorização para coleta de informações', [
        curto('Nome do(a) avaliado(a) ou responsável'),
        data('Data'),
    ], 'Declaro que as informações prestadas nesta entrevista correspondem, conforme meu conhecimento, à realidade do(a) avaliado(a). Autorizo a coleta de dados complementares estritamente necessários ao processo de avaliação, respeitados o sigilo profissional, a legislação aplicável e as normas éticas vigentes.'),
])

const PSICOLOGICA = comIds([
    secao('Identificação', [
        data('Data da entrevista', { auto: 'hoje' }),
        curto('Nome', { auto: 'pacienteNome' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Estado civil'),
        escolha('Escolaridade', ESCOLARIDADE),
        curto('Profissão / ocupação'),
        curto('Com quem mora'),
        curto('Encaminhado(a) por'),
    ]),
    secao('Demanda', [
        longo('Queixa principal (nas palavras do paciente)'),
        longo('História da queixa: quando começou, como evoluiu, o que piora e o que melhora'),
        longo('O que espera do atendimento psicológico'),
    ]),
    secao('Saúde', [
        longo('Tratamentos psicológicos ou psiquiátricos anteriores (quando, por quanto tempo, como foi)'),
        curto('Medicamentos em uso'),
        longo('Doenças, cirurgias, internações e acompanhamentos médicos'),
        marcar('Sono e alimentação', ['Dorme bem', 'Insônia', 'Sono excessivo', 'Pesadelos', 'Apetite normal', 'Perda de apetite', 'Compulsão alimentar']),
        marcar('Uso de substâncias', ['Álcool', 'Tabaco', 'Cannabis', 'Outras drogas', 'Nenhuma'], { outro: true }),
    ]),
    secao('História de vida', [
        longo('Família de origem: pais, irmãos, relação na infância e hoje'),
        longo('Infância e adolescência: fatos marcantes, escola, amizades'),
        longo('Relacionamentos afetivos e vida sexual (quando pertinente)'),
        longo('Trabalho / estudos: satisfação, conflitos, desempenho'),
        longo('Rede de apoio, lazer e interesses'),
    ]),
    secao('Aspectos emocionais', [
        marcar('Sintomas relatados', [
            'Ansiedade', 'Tristeza', 'Irritabilidade', 'Crises de choro', 'Crises de pânico', 'Medos', 'Culpa', 'Baixa autoestima',
            'Dificuldade de concentração', 'Isolamento', 'Pensamentos repetitivos',
        ], { outro: true }),
        longo('Eventos estressores recentes, perdas ou traumas'),
        escolha('Ideação suicida ou autoagressão', ['Nega', 'Ideação passada', 'Ideação atual', 'Tentativa anterior']),
        longo('Avaliação de risco e medidas de proteção (quando aplicável)'),
    ]),
    secao('Observações do profissional', [
        longo('Apresentação, humor, afeto, discurso e postura durante a entrevista'),
        longo('Hipóteses iniciais e plano de atendimento (frequência, objetivos, encaminhamentos)'),
    ]),
])

const PSIQUIATRICA = comIds([
    secao('Identificação', [
        data('Data', { auto: 'hoje' }),
        curto('Nome', { auto: 'pacienteNome' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Estado civil'),
        curto('Ocupação'),
        curto('Acompanhante / informante'),
    ]),
    secao('Queixa e história da doença atual', [
        longo('Queixa principal'),
        longo('História da doença atual: início, evolução, fatores desencadeantes, tratamentos já feitos e resposta'),
        marcar('Sintomas', [
            'Humor deprimido', 'Anedonia', 'Ansiedade', 'Ataques de pânico', 'Insônia', 'Hipersonia', 'Alteração de apetite', 'Irritabilidade',
            'Euforia / aceleração', 'Impulsividade', 'Obsessões / compulsões', 'Alucinações', 'Delírios', 'Desatenção', 'Ideação suicida',
        ], { outro: true }),
    ]),
    secao('Antecedentes psiquiátricos', [
        longo('Diagnósticos e tratamentos anteriores'),
        curto('Internações psiquiátricas (quantas, quando, motivo)'),
        curto('Tentativas de suicídio (quantas, quando, método)'),
        longo('Medicamentos psiquiátricos atuais e anteriores: dose, tempo de uso, resposta e efeitos colaterais'),
    ]),
    secao('Antecedentes clínicos e hábitos', [
        longo('Doenças clínicas, cirurgias e outros medicamentos em uso'),
        curto('Alergias'),
        marcar('Uso de substâncias', ['Álcool', 'Tabaco', 'Cannabis', 'Cocaína / crack', 'Benzodiazepínicos sem prescrição', 'Nenhuma'], { outro: true }),
        longo('Padrão de uso (quantidade, frequência, última vez, abstinência)'),
    ]),
    secao('História familiar e pessoal', [
        longo('Transtornos psiquiátricos, suicídio e dependência química na família'),
        longo('História pessoal: desenvolvimento, escolaridade, trabalho, relacionamentos, eventos marcantes'),
        longo('Situação social atual e rede de apoio'),
    ]),
    secao('Exame do estado mental', [
        curto('Aparência e atitude'),
        curto('Consciência e orientação'),
        curto('Atenção e memória'),
        curto('Pensamento (curso, forma e conteúdo)'),
        curto('Sensopercepção'),
        curto('Humor e afeto'),
        curto('Psicomotricidade'),
        curto('Juízo crítico e insight'),
    ]),
    secao('Avaliação e conduta', [
        escolha('Risco de suicídio', ['Baixo', 'Moderado', 'Alto']),
        longo('Hipótese diagnóstica (CID-10)'),
        longo('Conduta: prescrição, exames, encaminhamentos e retorno'),
    ]),
])

const TERAPIA_OCUPACIONAL = comIds([
    secao('Identificação e encaminhamento', [
        data('Data', { auto: 'hoje' }),
        curto('Nome', { auto: 'pacienteNome' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Diagnóstico / hipótese diagnóstica'),
        curto('Encaminhado(a) por'),
        curto('Informante'),
    ]),
    secao('Demanda', [
        longo('Queixa principal e motivo do encaminhamento'),
        longo('O que a pessoa (ou a família) quer conseguir fazer melhor no dia a dia'),
    ]),
    secao('Atividades de vida diária (AVD)', [
        escolha('Alimentação', INDEPENDENCIA),
        escolha('Banho e higiene', INDEPENDENCIA),
        escolha('Vestuário', INDEPENDENCIA),
        escolha('Uso do banheiro', INDEPENDENCIA),
        escolha('Mobilidade e transferências', INDEPENDENCIA),
        longo('Observações sobre as AVD'),
    ]),
    secao('Atividades instrumentais e ocupações', [
        marcar('Com dificuldade', ['Tarefas domésticas', 'Preparar refeições', 'Uso de dinheiro', 'Compras', 'Uso de transporte', 'Uso de medicação', 'Uso de celular/computador']),
        longo('Escola / trabalho: desempenho, adaptações e dificuldades'),
        longo('Brincar, lazer e participação social'),
    ]),
    secao('Componentes do desempenho', [
        longo('Coordenação motora global e fina, força, equilíbrio, preensão, escrita'),
        marcar('Processamento sensorial', [
            'Sensibilidade a sons', 'Sensibilidade tátil', 'Sensibilidade a luz', 'Seletividade alimentar', 'Busca sensorial (movimento, pressão)',
            'Baixo registro (parece não perceber estímulos)',
        ], { outro: true }),
        longo('Atenção, memória, planejamento e organização nas tarefas'),
        longo('Comportamento, regulação emocional e interação'),
    ]),
    secao('Rotina e ambiente', [
        longo('Rotina diária (horários, sono, telas, atividades)'),
        longo('Ambiente de casa e da escola/trabalho: barreiras, adaptações e recursos de tecnologia assistiva'),
    ]),
    secao('Plano terapêutico', [
        longo('Avaliações e instrumentos a aplicar'),
        longo('Objetivos terapêuticos e frequência'),
    ]),
])

const INFANTIL = comIds([
    secao('Identificação', [
        data('Data da entrevista', { auto: 'hoje' }),
        curto('Nome da criança', { auto: 'pacienteNome' }),
        data('Data de nascimento', { auto: 'pacienteNascimento' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Escola / série / turno'),
        curto('Responsável que respondeu'),
        curto('Parentesco'),
        curto('Com quem a criança mora'),
    ]),
    secao('Motivo da consulta', [
        longo('Motivo da procura e quem indicou'),
        longo('Quando os responsáveis perceberam e como evoluiu'),
        longo('O que a escola relata'),
    ]),
    secao('Gestação, parto e primeiros anos', [
        marcar('Gestação e parto', ['Gestação planejada', 'Pré-natal regular', 'Intercorrências na gestação', 'Parto normal', 'Cesárea', 'Prematuro', 'UTI neonatal', 'Icterícia'], { outro: true }),
        curto('Amamentação (até quando)'),
        curto('Sentou / engatinhou / andou com quantos meses'),
        curto('Primeiras palavras e frases'),
        curto('Controle de xixi e cocô (dia e noite)'),
    ]),
    secao('Saúde e rotina', [
        longo('Doenças, internações, cirurgias, medicamentos e alergias'),
        longo('Sono: horários, dorme sozinho(a), acorda à noite, pesadelos'),
        longo('Alimentação: seletividade, apetite, como come'),
        curto('Tempo de telas por dia'),
    ]),
    secao('Comportamento e desenvolvimento', [
        marcar('Comportamentos observados', [
            'Agitação', 'Desatenção', 'Birras frequentes', 'Agressividade', 'Timidez excessiva', 'Medos', 'Ansiedade de separação',
            'Dificuldade de interação', 'Pouco contato visual', 'Interesses restritos', 'Movimentos repetitivos', 'Sensibilidade a sons ou texturas',
            'Atraso de fala',
        ], { outro: true }),
        longo('Como brinca, do que gosta, com quem brinca'),
        longo('Como lida com regras, limites e frustrações'),
    ]),
    secao('Família', [
        longo('Composição familiar, irmãos e relação entre eles'),
        longo('Mudanças, separações, perdas ou eventos marcantes'),
        longo('Histórico familiar (TDAH, autismo, dificuldades de aprendizagem, transtornos emocionais)'),
    ]),
    secao('Observações do profissional', [
        longo('Comportamento da criança durante a entrevista'),
        longo('Hipóteses iniciais e plano (avaliações, frequência, orientação aos pais)'),
    ]),
])

// Roteiro "Protocolo Clínico de Avaliação Fonoaudiológica (PCAF)" enviado pela clínica.
const SIM_NAO = ['Sim', 'Não']
const simNao = (rotulo) => escolha(rotulo, SIM_NAO)

const FONOAUDIOLOGIA = comIds([
    secao('Identificação', [
        data('Data da anamnese', { auto: 'hoje' }),
        curto('Convênio'),
        curto('Nome', { auto: 'pacienteNome' }),
        data('Data de nascimento', { auto: 'pacienteNascimento' }),
        curto('Idade (anos e meses)', { auto: 'pacienteIdade' }),
    ]),
    secao('Filiação', [
        curto('Pai'),
        curto('Idade do pai'),
        curto('Profissão do pai'),
        curto('Telefone do pai'),
        curto('Mãe'),
        curto('Idade da mãe'),
        curto('Profissão da mãe'),
        curto('Telefone da mãe'),
        curto('E-mail'),
        simNao('Os pais residem no mesmo endereço?'),
        longo('Se não, qual o endereço'),
        simNao('Tem irmãos?'),
        curto('Quantos irmãos e idades'),
        longo('Endereço (rua/avenida, número, bairro e município)'),
        longo('Observação'),
    ]),
    secao('Queixa', [
        longo('Queixa'),
    ]),
    secao('Histórico', [
        curto('Gestação: semanas'),
        simNao('Intercorrências na gestação'),
        escolha('Parto', ['Normal', 'Cesariana']),
        simNao('Internação'),
        curto('Quantos dias de internação'),
        simNao('UTI'),
        simNao('UTI neonatal'),
        simNao('Medicação'),
        longo('Quais medicações'),
    ]),
    secao('Hábitos e desenvolvimento', [
        simNao('Aleitamento materno'),
        curto('Aleitamento materno: quanto tempo'),
        simNao('Mamadeira'),
        curto('Mamadeira: quanto tempo'),
        simNao('Chupeta'),
        curto('Chupeta: quanto tempo'),
        simNao('Sucção digital'),
        curto('Sucção digital: quanto tempo'),
        curto('Controle de esfíncter (desfralde): quando'),
        curto('Andou com quantos anos'),
        simNao('Engatinhou'),
        simNao('Passou por todas as fases'),
        curto('Falou com quantos anos'),
        simNao('Hábito vicioso'),
        longo('Quais hábitos viciosos'),
        simNao('Ansiedade'),
    ]),
    secao('Testes e saúde', [
        simNao('Teste da orelhinha'),
        curto('Resultado do teste da orelhinha'),
        simNao('Teste da linguinha'),
        curto('Resultado do teste da linguinha'),
        longo('HPP (história patológica pregressa)'),
        simNao('Tem diagnóstico fechado'),
        curto('Qual diagnóstico'),
        curto('Nome do neuropediatra / neuropsiquiatra'),
        simNao('Pediatra'),
        curto('Nome do pediatra'),
        simNao('Psicólogo'),
        curto('Nome do psicólogo'),
        simNao('Doença atual'),
        curto('Qual doença'),
        simNao('Medicação atual'),
        curto('Qual medicação'),
        simNao('Alergia'),
        curto('Quais alergias'),
    ]),
    secao('Comportamento', [
        longo('Comportamento'),
        simNao('Correção'),
        curto('Qual correção'),
        simNao('Reação'),
        curto('Qual reação'),
        simNao('Manias'),
        curto('Quais manias'),
        escolha('Sono', ['Tranquilo', 'Agitado']),
        simNao('Sensível a barulho'),
        curto('Qual barulho'),
        simNao('Aceita toque'),
    ]),
    secao('Alimentação', [
        simNao('Mastiga bem'),
        simNao('Seletividade'),
        longo('Qual seletividade'),
        curto('Dentição'),
    ]),
    secao('Escola', [
        simNao('Estuda'),
        longo('Endereço da escola/creche (rua, número, município e telefone)'),
        simNao('Adaptado na escola'),
        simNao('Realiza as atividades da escola'),
        simNao('Interage com as crianças'),
        curto('Horário: entrada e saída'),
        longo('Observação'),
    ]),
    secao('Avaliação', [
        longo('Avaliação'),
    ]),
])

const ESCALA_DOR = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

const FISIOTERAPIA = comIds([
    secao('Identificação', [
        data('Data da avaliação', { auto: 'hoje' }),
        curto('Fisioterapeuta responsável', { auto: 'profissionalNome' }),
        curto('Nome', { auto: 'pacienteNome' }),
        data('Data de nascimento', { auto: 'pacienteNascimento' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Telefone / e-mail', { auto: 'pacienteContato' }),
        curto('Profissão / ocupação'),
        escolha('Lado dominante', ['Destro', 'Canhoto', 'Ambidestro']),
        curto('Médico que encaminhou'),
        curto('Diagnóstico médico / CID (se houver)'),
    ]),
    secao('Queixa principal', [
        longo('Queixa principal (o que trouxe o paciente)'),
        longo('História da doença atual: como e quando começou, evolução, mecanismo da lesão'),
        marcar('Região acometida', [
            'Cervical', 'Torácica', 'Lombar', 'Ombro', 'Cotovelo', 'Punho / mão', 'Quadril', 'Joelho', 'Tornozelo / pé',
        ], { outro: true }),
        escolha('Lado', ['Direito', 'Esquerdo', 'Bilateral', 'Não se aplica']),
    ]),
    secao('Dor', [
        escolha('Intensidade da dor agora (0 = sem dor, 10 = pior dor possível)', ESCALA_DOR),
        escolha('Pior dor nas últimas semanas (0 a 10)', ESCALA_DOR),
        marcar('Tipo de dor', ['Pontada', 'Queimação', 'Latejante', 'Peso', 'Choque', 'Formigamento', 'Dormência'], { outro: true }),
        marcar('Quando a dor aparece', ['Em repouso', 'Ao movimentar', 'Ao acordar', 'À noite', 'Ao fim do dia', 'Ao ficar muito tempo na mesma posição']),
        simNao('A dor se irradia para outra região?'),
        curto('Para onde se irradia'),
        longo('O que piora a dor'),
        longo('O que melhora a dor'),
    ]),
    secao('Histórico de saúde', [
        marcar('Doenças associadas', [
            'Hipertensão', 'Diabetes', 'Cardiopatia', 'Osteoporose', 'Artrose', 'Artrite reumatoide', 'Fibromialgia', 'Doença respiratória', 'Doença neurológica',
        ], { outro: true }),
        longo('Cirurgias anteriores (quais e quando)'),
        longo('Fraturas, lesões ou traumas anteriores'),
        longo('Medicamentos em uso'),
        longo('Exames de imagem realizados e resultados (raio-x, ressonância, ultrassom)'),
        simNao('Já fez fisioterapia antes?'),
        longo('Se sim, para quê e como foi o resultado'),
        simNao('Usa órtese, prótese, palmilha ou dispositivo de marcha?'),
        curto('Qual dispositivo'),
    ]),
    secao('Hábitos e vida diária', [
        escolha('Atividade física', ['Sedentário', 'Leve (1–2x por semana)', 'Moderada (3–4x por semana)', 'Intensa (5x ou mais por semana)']),
        curto('Qual atividade física / esporte'),
        longo('Postura e rotina de trabalho (sentado, em pé, esforço físico, uso de computador)'),
        escolha('Qualidade do sono', ['Boa', 'Regular', 'Ruim']),
        simNao('Tabagismo'),
        escolha('Independência nas atividades do dia a dia', INDEPENDENCIA),
        longo('Atividades que hoje estão difíceis ou impossíveis por causa do problema'),
    ]),
    secao('Exame físico', [
        curto('Peso / altura'),
        curto('Pressão arterial / frequência cardíaca'),
        longo('Inspeção (postura, edema, cicatrizes, deformidades, assimetrias)'),
        longo('Palpação (pontos de dor, tensão muscular, temperatura)'),
        longo('Amplitude de movimento (ADM)'),
        longo('Força muscular (grau 0 a 5)'),
        longo('Testes especiais realizados e resultados'),
        longo('Marcha e equilíbrio'),
        longo('Sensibilidade e reflexos'),
    ]),
    secao('Diagnóstico e plano', [
        longo('Diagnóstico cinético-funcional'),
        longo('Objetivos do tratamento (curto e longo prazo)'),
        longo('Condutas e recursos planejados'),
        curto('Frequência e número de sessões previstas'),
        longo('Orientações dadas ao paciente'),
    ]),
])

const CLINICA_GERAL = comIds([
    secao('Identificação', [
        data('Data da consulta', { auto: 'hoje' }),
        curto('Médico responsável', { auto: 'profissionalNome' }),
        curto('Nome', { auto: 'pacienteNome' }),
        data('Data de nascimento', { auto: 'pacienteNascimento' }),
        curto('Idade', { auto: 'pacienteIdade' }),
        curto('Sexo'),
        curto('Estado civil'),
        curto('Profissão / ocupação'),
        curto('Naturalidade / procedência'),
        curto('Telefone / e-mail', { auto: 'pacienteContato' }),
    ]),
    secao('Queixa principal e história da doença atual', [
        longo('Queixa principal (nas palavras do paciente)'),
        curto('Há quanto tempo'),
        longo('História da doença atual: início, duração, evolução, intensidade, fatores de melhora e piora, sintomas associados'),
        longo('Tratamentos já feitos para esta queixa'),
    ]),
    secao('Revisão de sistemas', [
        marcar('Gerais', ['Febre', 'Perda de peso', 'Ganho de peso', 'Cansaço', 'Suor noturno', 'Falta de apetite']),
        marcar('Cabeça e pescoço', ['Dor de cabeça', 'Tontura', 'Alteração na visão', 'Alteração na audição', 'Dor de garganta', 'Caroços no pescoço']),
        marcar('Coração e pulmões', ['Dor no peito', 'Palpitação', 'Falta de ar', 'Tosse', 'Chiado', 'Inchaço nas pernas']),
        marcar('Digestivo', ['Azia', 'Náusea / vômito', 'Dor abdominal', 'Diarreia', 'Prisão de ventre', 'Sangue nas fezes']),
        marcar('Urinário e reprodutor', ['Dor ao urinar', 'Urina com frequência', 'Sangue na urina', 'Alteração menstrual', 'Corrimento']),
        marcar('Pele, músculos e nervos', ['Manchas na pele', 'Coceira', 'Dor nas articulações', 'Dor muscular', 'Formigamento', 'Fraqueza']),
        marcar('Emocional', ['Ansiedade', 'Tristeza', 'Insônia', 'Irritabilidade']),
        longo('Outros sintomas'),
    ]),
    secao('Antecedentes pessoais', [
        marcar('Doenças', [
            'Hipertensão', 'Diabetes', 'Colesterol alto', 'Doença cardíaca', 'Asma / bronquite', 'Doença da tireoide', 'Doença renal', 'Câncer', 'Depressão / ansiedade',
        ], { outro: true }),
        longo('Cirurgias e internações anteriores'),
        longo('Medicamentos em uso (nome, dose e horário)'),
        simNao('Tem alergia a medicamento?'),
        curto('Quais alergias'),
        curto('Vacinação em dia?'),
        longo('Gestações, partos e ciclo menstrual (quando se aplica)'),
    ]),
    secao('Antecedentes familiares', [
        marcar('Doenças na família', ['Hipertensão', 'Diabetes', 'Doença cardíaca', 'AVC', 'Câncer', 'Doença mental', 'Doença genética'], { outro: true }),
        longo('Quem da família e observações'),
    ]),
    secao('Hábitos de vida', [
        escolha('Tabagismo', ['Nunca fumou', 'Ex-fumante', 'Fuma']),
        curto('Quantos cigarros por dia / há quantos anos'),
        escolha('Bebida alcoólica', ['Não bebe', 'Socialmente', 'Frequentemente']),
        simNao('Uso de outras substâncias'),
        escolha('Atividade física', ['Sedentário', 'Leve', 'Moderada', 'Intensa']),
        longo('Alimentação'),
        escolha('Sono', ['Bom', 'Regular', 'Ruim']),
    ]),
    secao('Exame físico', [
        curto('Pressão arterial'),
        curto('Frequência cardíaca'),
        curto('Frequência respiratória'),
        curto('Temperatura'),
        curto('Saturação de oxigênio'),
        curto('Peso / altura / IMC'),
        longo('Estado geral'),
        longo('Exame por aparelhos (cabeça e pescoço, coração, pulmões, abdome, membros, neurológico, pele)'),
    ]),
    secao('Avaliação e conduta', [
        longo('Hipóteses diagnósticas'),
        longo('Exames solicitados'),
        longo('Prescrição'),
        longo('Orientações e encaminhamentos'),
        curto('Retorno'),
    ]),
])

export const MODELOS_PADRAO = [
    { chave: 'neuropsicologica', titulo: 'Anamnese Neuropsicológica — adultos e responsáveis', area: 'Neuropsicologia', descricao: 'Roteiro integrado para entrevista de adultos e com pais/responsáveis por crianças e adolescentes.', secoes: NEUROPSICOLOGICA },
    { chave: 'psicologica', titulo: 'Anamnese Psicológica — adulto', area: 'Psicologia', descricao: 'Entrevista inicial para psicoterapia de adultos.', secoes: PSICOLOGICA },
    { chave: 'psiquiatrica', titulo: 'Anamnese Psiquiátrica', area: 'Psiquiatria', descricao: 'Primeira consulta psiquiátrica, com exame do estado mental.', secoes: PSIQUIATRICA },
    { chave: 'terapia-ocupacional', titulo: 'Anamnese de Terapia Ocupacional', area: 'Terapia Ocupacional', descricao: 'Desempenho ocupacional, AVD, processamento sensorial e plano terapêutico.', secoes: TERAPIA_OCUPACIONAL },
    { chave: 'fonoaudiologia', titulo: 'Anamnese Fonoaudiológica — infantil', area: 'Fonoaudiologia', descricao: 'Protocolo clínico de avaliação fonoaudiológica: gestação, desenvolvimento, hábitos orais, saúde, comportamento, alimentação e escola.', secoes: FONOAUDIOLOGIA },
    { chave: 'infantil', titulo: 'Anamnese Infantil — entrevista com os responsáveis', area: 'Psicologia infantil / Terapia infantil', descricao: 'Para crianças: desenvolvimento, rotina, comportamento e família.', secoes: INFANTIL },
    { chave: 'fisioterapia', titulo: 'Anamnese de Fisioterapia', area: 'Fisioterapia', descricao: 'Queixa, dor (escala de 0 a 10), histórico, rotina, exame físico, diagnóstico cinético-funcional e plano de tratamento.', secoes: FISIOTERAPIA },
    { chave: 'clinica-geral', titulo: 'Anamnese de Clínica Geral', area: 'Clínica Médica', descricao: 'Consulta médica completa: queixa, história da doença atual, revisão de sistemas, antecedentes, hábitos, exame físico e conduta.', secoes: CLINICA_GERAL },
]
