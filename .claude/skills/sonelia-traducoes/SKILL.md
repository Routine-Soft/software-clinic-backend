---
name: sonelia-traducoes
description: Como funcionam o português, o inglês e o espanhol no Sonelia (site, sistema e mensagens da API), onde ficam os dicionários, como traduzir texto novo e como conferir se falta tradução. Usar sempre que criar ou mudar texto de tela ou mensagem da API no Sonelia.
---

# Traduções PT/EN/ES do Sonelia

## Frontend (`softwareclinic-frontend/src/i18n/`)
- Idioma: `idioma.js` → `lerIdioma()` usa o `localStorage` `idioma` ou o idioma do navegador (pt* → pt, es* → es, senão en). Locales: `pt-BR`, `en-US`, `es-419` (espanhol da América Latina, tratando por "tú"). Trocar de idioma salva e **recarrega a página** (`IdiomaProvider`), por isso `tr()` pode ser usado até em constantes de módulo.
- `index.js`:
  - `tr('texto em português', { nome })`: o próprio português é a chave. Parâmetros com `{nome}`; `false`/`null`/`undefined` viram vazio (para `{cond && texto}`). Sem tradução, mostra o português e, em desenvolvimento, avisa no console "Sem tradução".
  - `t('landing.hero.titulo')`: textos por chave da landing (`pages/Landing/landing.textos.js`) e das telas de entrada (`modules/user/auth.textos.js`), com objetos `pt`, `en` e `es`.
  - `idiomaAtual()` e `localeAtual()` (para datas e números: `toLocaleString(localeAtual(), ...)`).
- **Dicionários:** `src/i18n/en/*.js` e `src/i18n/es/*.js`, com os mesmos arquivos e as mesmas chaves (`geral`, `clinica`, `negocio`, `avaliacoes`, `extras`, `termos`, `acompanhamento`, `anamnese`...), juntados no `index.js` de cada pasta. Texto novo entra **nos dois**. Assunto novo grande: crie o arquivo nas duas pastas e inclua nos dois `index.js`.
- `es/planos.js` (fora do `index.js`): traduz para o espanhol a descrição e os recursos dos planos, que o super admin cadastra em português (planos em real) ou inglês (em dólar). Usado por `planoNoIdioma` (`modules/plano/plano.utils.js`). Recurso de plano novo: incluir lá.
- Termos legais: `pages/Termos/termos.en.js` e `termos.es.js` (tradução de cortesia; vale o português). Fotos da landing: `public/landing/` (pt) e `public/landing/en/` (usadas também no espanhol).
- O botão PT/EN/ES fica no topo da landing, nas telas de entrada, na sidebar e nos termos (`components/IdiomaToggle`).
- O `httpClient` manda `Accept-Language` com o idioma em toda chamada.

## Backend (mensagens da API)
- O hook `onSend` em `index.js` troca o campo `message` das respostas JSON quando o pedido é em inglês ou espanhol, usando `traduzirMensagem` (`src/modules/shared/utils/idioma.js`) e os dicionários **`src/modules/shared/utils/mensagens.en.js`** (`MENSAGENS_EN`) e **`mensagens.es.js`** (`MENSAGENS_ES`), agrupados por assunto e com as mesmas chaves.
- A chave é a mensagem em português exatamente como está no código. Partes variáveis de template literal viram `{0}`, `{1}`... (ex.: `'O modelo pode ter no máximo {0} seções'`).
- Toda mensagem nova (`AppError` ou `message` do controller) ganha a tradução nos dois. Para testar: mande `Accept-Language: en` ou `es`.
- E-mail de redefinir senha sai no idioma do pedido (`recuperar-senha.service.js`); a página de pagamento do Stripe também (`LOCALE_DO_STRIPE`).

## O que não se traduz
- Conteúdo escrito pela clínica (modelos de termo e de anamnese, nomes de serviços etc.) fica como ela escreveu.
- O blog é só em português.

## Conferir se falta tradução
- Rode, na pasta do frontend: `node ../softwareclinic-backend/.claude/skills/sonelia-traducoes/scripts/faltam.mjs .` (ou passe só os arquivos mexidos, para ser mais rápido). Mostra, para inglês e espanhol, cada texto sem tradução e o arquivo. Deixe os dois em 0.
- Cuidado ao traduzir palavra solta muito genérica (ex.: `'CPF'`, `'Título'`): a chave vale para o sistema inteiro.

## O que só existe no Brasil
- Clínica de fora do Brasil (`paisClinica` da sessão, ver `clinicaNoBrasil` em `src/i18n/paises.js`) não vê NR-01 nem "Indique e ganhe" no menu e nos atalhos (`soBrasil: true` nos itens). A landing em inglês e espanhol não anuncia NR-01. O critério é o país da clínica, não o idioma.
