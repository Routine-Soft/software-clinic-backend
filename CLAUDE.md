# Sonelia (antigo softwareclinic): sistema para clínicas

Dois repositórios irmãos em `~/Repositorios/`: **`softwareclinic-backend`** (este, API) e **`softwareclinic-frontend`** (site + sistema). As conversas costumam abrir aqui com o frontend como pasta adicional.

- Produção: API `https://api.sonelia.com.br` (container `sonelia` na OVH; atualizar com `~/atualizar.sh sonelia`, ver skill `deploy-servidor`); site `https://sonelia.com.br` (Vercel, push na `main` publica).
- **O `.env` local aponta para o banco de produção.** Rotinas que mexem em dados ao subir (ex.: montar acompanhamentos antigos) só rodam com `NODE_ENV=production` (só o servidor tem).
- Skills deste projeto (`.claude/skills/`): `sonelia-traducoes` (PT/EN), `sonelia-sigilo` (prontuário, anamnese, avaliações), `sonelia-pagamentos` (Mercado Pago, Stripe, planos, afiliados), `sonelia-whatsapp` (lembretes de consulta).

## Multi-tenant e papéis
- O dono da clínica é um `users` com `role: 'admin'` e `tenantId` = o próprio `_id`. Todo documento tem `tenantId`; o token traz `tenantId`.
- Papéis: `super_admin` (o Stanley), `admin` (dona da clínica), `profissional`, `recepcao`, `afiliado`. Rotas usam `authenticate` + `exigirAssinaturaAtiva` (402 com assinatura vencida) + `authorize([...])`.
- Profissional de saúde = cadastro em `profissionais` ligado ao login por `usuarioId`. Só ele abre prontuário (a recepção nunca).

## Backend (`src/modules/`)
`user` (login, cadastro, Google, recuperar senha, super admin das clínicas), `paciente` (+ `acompanhamento.service.js`: profissionais que acompanham), `agenda` (consultas; finalizar atendimento marca realizado e gera repasse), `prontuario` (+ `prontuario.acesso.js`: regras de sigilo e auditoria), `anamnese` (modelos e anamneses), `avaliacao-neuropsicologica`, `avaliacao-nr01`, `termo` (TCLE com assinatura do paciente), `comissao` (repasses), `assinatura` + `plano` (pagamento), `afiliado`, `indicacao`, `lembrete-whatsapp`, `chamada` + `painel-tv` (sala de espera), `lista-espera`, `reuniao`, `convenio`, `empresa`, `especialidade`, `sala`, `servico`, `print`, `shared` (middlewares, `email.js` com Resend, `idioma.js`, `mensagens.en.js`, `pais.js`, `dia-puro.js`).
- Datas de consulta são "dia puro" (meia-noite UTC; `shared/utils/dia-puro.js`). Hoje = relógio de Brasília.
- Registrar módulo novo em `index.js` (`fastify.register(xRoutes, { prefix: '/api' })`).
- Mensagem nova da API: adicionar a tradução em `shared/utils/mensagens.en.js` (ver `sonelia-traducoes`).

## Frontend (`../softwareclinic-frontend/src/`)
- `modules/<entidade>/` (mesmos nomes do backend, mais `sala-espera`), `pages/` (Landing, Home, DashboardAdmin, PainelSuperAdmin, Afiliados, Termos), `components/` (Sidebar, Modal/ModalForm, CrudCard + `icones.jsx`, CampoSenha, IdiomaToggle, SeletorPais...), `i18n/`, `services/httpClient.js`, `styles/` (theme.css, ui.css).
- Rotas em `App.jsx` (HashRouter); itens do menu em `components/Sidebar/Sidebar.jsx` (ícones em `menuIcones.jsx`).
- Blog estático: `blog/` (`gerar.mjs` roda no `npm run dev`/`build`), páginas legais geradas também.
- Checagem rápida: `npx eslint src` e `npx vite build` (na pasta do frontend).
