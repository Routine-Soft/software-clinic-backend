---
name: sonelia-traducoes
description: Como funcionam o português e o inglês no Sonelia (site, sistema e mensagens da API), onde ficam os dicionários, como traduzir texto novo e como conferir se falta tradução. Usar sempre que criar ou mudar texto de tela ou mensagem da API no Sonelia.
---

# Traduções PT/EN do Sonelia

## Frontend (`softwareclinic-frontend/src/i18n/`)
- Idioma: `idioma.js` → `lerIdioma()` usa o `localStorage` `idioma` ou o idioma do navegador (pt* → pt, senão en). Trocar de idioma salva e **recarrega a página** (`IdiomaProvider`), por isso `tr()` pode ser usado até em constantes de módulo.
- `index.js`:
  - `tr('texto em português', { nome })`: o próprio português é a chave. Parâmetros com `{nome}`; `false`/`null`/`undefined` viram vazio (para `{cond && texto}`). Sem tradução, mostra o português e, em desenvolvimento, avisa no console "Sem tradução".
  - `t('landing.hero.titulo')`: textos por chave da landing (`pages/Landing/landing.textos.js`) e das telas de entrada (`modules/user/auth.textos.js`), com objetos `pt` e `en`.
  - `idiomaAtual()` e `localeAtual()` (para datas e números: `toLocaleString(localeAtual(), ...)`).
- **Dicionários em inglês:** `src/i18n/en/*.js` (`geral`, `clinica`, `negocio`, `avaliacoes`, `extras`, `termos`, `acompanhamento`, `anamnese`...), juntados em `en/index.js`. Assunto novo grande: crie um arquivo novo e inclua no `index.js`.
- Termos legais em inglês: `pages/Termos/termos.en.js`. Fotos da landing: `public/landing/` (pt) e `public/landing/en/`.
- O botão PT/EN fica no topo da landing, nas telas de entrada, na sidebar e nos termos (`components/IdiomaToggle`).
- O `httpClient` manda `Accept-Language` com o idioma em toda chamada.

## Backend (mensagens da API)
- O hook `onSend` em `index.js` troca o campo `message` das respostas JSON quando o pedido é em inglês, usando `traduzirMensagem` (`src/modules/shared/utils/idioma.js`) e o dicionário **`src/modules/shared/utils/mensagens.en.js`** (`MENSAGENS_EN`, agrupado por assunto).
- A chave é a mensagem em português exatamente como está no código. Partes variáveis de template literal viram `{0}`, `{1}`... (ex.: `'O modelo pode ter no máximo {0} seções'`).
- Toda mensagem nova (`AppError` ou `message` do controller) ganha a tradução lá. Para testar: mande `Accept-Language: en`.
- E-mail de redefinir senha sai no idioma do pedido (`recuperar-senha.service.js`).

## O que não se traduz
- Conteúdo escrito pela clínica (modelos de termo e de anamnese, nomes de serviços etc.) fica como ela escreveu.
- O blog é só em português.

## Conferir se falta tradução
- Rode, na pasta do frontend: `node ../softwareclinic-backend/.claude/skills/sonelia-traducoes/scripts/faltam.mjs .` (ou passe só os arquivos mexidos, para ser mais rápido). Mostra cada texto sem tradução e o arquivo. Deixe em 0.
- Cuidado ao traduzir palavra solta muito genérica (ex.: `'CPF'`, `'Título'`): a chave vale para o sistema inteiro.
