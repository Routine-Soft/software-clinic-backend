# Sonelia (antigo softwareclinic): sistema para clínicas

Dois repositórios irmãos em `~/Repositorios/`: **`softwareclinic-backend`** (este, API) e **`softwareclinic-frontend`** (site + sistema). As conversas costumam abrir aqui com o frontend como pasta adicional.

- Produção: API `https://api.sonelia.com.br` (container `sonelia` na OVH; atualizar com `~/atualizar.sh sonelia`, ver skill `deploy-servidor`); site `https://sonelia.com.br` (Vercel, push na `main` publica).
- **O `.env` local aponta para o banco de produção.** Rotinas que mexem em dados ao subir (ex.: montar acompanhamentos antigos) só rodam com `NODE_ENV=production` (só o servidor tem).
- Skills deste projeto (`.claude/skills/`): `sonelia-traducoes` (PT/EN/ES), `sonelia-sigilo` (prontuário, anamnese, avaliações), `sonelia-pagamentos` (Mercado Pago, Stripe, planos, afiliados), `sonelia-whatsapp` (lembretes de consulta).

## Multi-tenant e papéis
- O dono da clínica é um `users` com `role: 'admin'` e `tenantId` = o próprio `_id`. Todo documento tem `tenantId`; o token traz `tenantId`.
- Papéis: `super_admin` (o Stanley), `admin` (dona da clínica), `profissional`, `recepcao`, `afiliado`. Rotas usam `authenticate` + `exigirAssinaturaAtiva` (402 com assinatura vencida) + `authorize([...])`.
- Profissional de saúde = cadastro em `profissionais` ligado ao login por `usuarioId`. Só ele abre prontuário (a recepção nunca).
- **Recepção é a auxiliar da dona: tem o mesmo poder que o `admin`, exceto o que envolve dinheiro da assinatura** (cancelar/trocar plano, "Indique e ganhe") **e sigilo clínico** (prontuário, anamnese preenchida, avaliações). Já libera modelos de anamnese e de termo (TCLE) — são só perguntas/texto, sem dado de paciente. Ao abrir uma tela nova, por padrão incluir `recepcao` junto com `admin`/`profissional`, a não ser que seja uma dessas exceções. **Repasses (ver quanto cada profissional recebe, marcar como pago) está pendente: perguntar à dona antes de liberar para a recepção.**
- Clínica fora do Brasil: `paisClinica` (vem na sessão do login/`/users/me`) decide o que só existe no Brasil — NR-01 e "Indique e ganhe" somem do menu e dos atalhos (`clinicaNoBrasil()` em `i18n/paises.js`, `soBrasil: true` nos itens).

## Backend (`src/modules/`)
`user` (login, cadastro, Google, recuperar senha, super admin das clínicas; clínica nova recebe e-mail de boas-vindas e gera alerta no Telegram do Stanley), `paciente` (+ `acompanhamento.service.js`: profissionais que acompanham), `agenda` (consultas; finalizar atendimento marca realizado e gera repasse), `prontuario` (+ `prontuario.acesso.js`: regras de sigilo e auditoria), `anamnese` (modelos e anamneses), `avaliacao-neuropsicologica`, `avaliacao-nr01`, `termo` (TCLE com assinatura do paciente), `comissao` (repasses), `assinatura` + `plano` (pagamento), `afiliado`, `indicacao`, `lembrete-whatsapp`, `chamada` + `painel-tv` (sala de espera), `lista-espera`, `reuniao`, `convenio`, `empresa`, `especialidade`, `sala`, `servico`, `print`, `shared` (middlewares, `email.js` com Resend, `telegram.js` (alertas: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`; o Node do computador local não alcança o Telegram, testar pelo servidor), `idioma.js`, `mensagens.en.js`, `pais.js`, `dia-puro.js`).
- Datas de consulta são "dia puro" (meia-noite UTC; `shared/utils/dia-puro.js`). Hoje = relógio de Brasília.
- Registrar módulo novo em `index.js` (`fastify.register(xRoutes, { prefix: '/api' })`).
- Mensagem nova da API: adicionar a tradução em `shared/utils/mensagens.en.js` **e** `mensagens.es.js` (ver `sonelia-traducoes`; terceiro idioma, espanhol, adicionado em 2026-10-23).

## Frontend (`../softwareclinic-frontend/src/`)
- `modules/<entidade>/` (mesmos nomes do backend, mais `sala-espera`), `pages/` (Landing, Home, DashboardAdmin, PainelSuperAdmin, Afiliados, Termos), `components/` (Sidebar, Modal/ModalForm, CrudCard + `icones.jsx`, CampoSenha, IdiomaToggle, SeletorPais, DicaTela (tutorial curto no topo da tela, fecha e não volta)...), `i18n/`, `services/httpClient.js`, `styles/` (theme.css, ui.css).
- Rotas em `App.jsx` (HashRouter); itens do menu em `components/Sidebar/Sidebar.jsx` (ícones em `menuIcones.jsx`).
- **Prontuário não tem tela própria:** fica dentro de Pacientes (`PacienteADM`, botão "Abrir" = `ProntuarioModal`; `/prontuario` redireciona). A recepção vê Pacientes sem consultas e sem o botão. O histórico do prontuário é a "Jornada do paciente" (`HistoricoJornada.jsx`), ao lado da ficha.
- Blog estático: `blog/` (`gerar.mjs` roda no `npm run dev`/`build`), páginas legais geradas também.
- Checagem rápida: `npx eslint src` e `npx vite build` (na pasta do frontend).
