---
name: sonelia-pagamentos
description: Como funcionam assinatura e pagamento no Sonelia: planos (Individual, Pro, teste grátis, planos em dólar), Mercado Pago para o Brasil (cartão recorrente e Pix), Stripe para clínicas de fora, webhooks, variáveis de ambiente, limites do plano Individual, afiliados e "Indique e ganhe". Usar ao mexer em planos, assinatura, cobrança, afiliados ou na tela de preços.
---

# Pagamentos do Sonelia

Arquivos: `src/modules/assinatura/` (`assinatura.service.js` Mercado Pago, `assinatura.stripe.js` Stripe, `pagamento.model.js`), `src/modules/plano/` (`plano.limites.js`, `plano.stripe.js`), `src/modules/afiliado/`, `src/modules/indicacao/`, `src/modules/comissao/` (repasse dos profissionais, não é pagamento da clínica). Frontend: `modules/assinatura/`, `modules/plano/`.

**Nunca faça cobrança real em teste.** Não clique em botões/interruptores da tela de planos do super admin durante testes (um teste já desativou o Pro).

## Planos
- **Freemium (2026-11):** três níveis calculados em `acessoDaClinica` (`assinatura.service.js`) com as regras de `plano.limites.js`, carregados em `req.acesso` pelo `exigirAssinaturaAtiva`. Sem plano pago valendo a clínica **não fica bloqueada**: cai no **Grátis** (agenda, até 10 pacientes, 1 profissional, TV com "Feito com Sonelia"). Só o acesso revogado pelo suporte dá 402 `ASSINATURA_INATIVA`.
  - Rotas de recurso pago usam `exigirRecurso('<recurso>')`: barra só criar/editar (a leitura do que já foi salvo continua) com 402 `RECURSO_DO_PLANO` + `recurso`; o site abre a janela de assinar (`PlanoProvider`, `RecursoBloqueadoModal`) e o menu mostra cadeado. Cliques nos cadeados vão para `planos_bloqueios` (cartão no Painel Super Admin).
- **Teste grátis:** plano interno (`tipo: 'gratis'`, nome "Teste grátis"), 14 dias com tudo liberado (nível Pro), sem cartão; depois vira o plano Grátis. E-mails de ajuda no dia 1, dia 3 e na véspera do fim (`teste.emails.js`). Não aparece na lista de planos.
- O nível de cada plano pago fica em `plano.nivel` (`basic`, `pro`, `rede`; trocou o antigo `individual` em 2026-11).
- **Basic** (antes "Individual"): R$ 129/mês. Até 2 profissionais e 100 pacientes, sem recepção e sem repasses.
- **Pro:** R$ 249/mês, até 25 profissionais e pacientes sem limite.
- **Rede:** R$ 690/mês, até 100 profissionais, com implantação assistida e suporte prioritário (só em reais).
- **Preço travado:** quando o preço de um plano sobe (`updatePlano`), quem já assina fica com o valor antigo em `assinatura.precoTravado` ({ planoId, valor }); `precoDaAssinatura` usa esse valor no Pix e no cartão do Mercado Pago. Trocar de plano cobra o preço do plano novo. A CurArt ficou travada em R$ 200 no Pro.
- Lembretes de consulta pelo WhatsApp entram no Basic, no Pro e no Rede ("Em breve" na página de preços até ficarem prontos). (Plano anual: o Stanley decide depois; NR-01 continua incluída, não é extra pago.)
- Limites em `LIMITES_DO_NIVEL` (`plano.limites.js`); os mesmos números ficam na página de preços (`precos.comparacao` em `landing.textos.js`), que é a lista fixa do que cada plano tem (o plano no banco só guarda nome, preço e descrição).
- **Em dólar** (clínicas de fora do Brasil): planos separados com `moeda: 'USD'`: Basic US$ 50 e Pro US$ 200 (não são conversão dos preços em reais). Planos antigos sem `moeda` contam como BRL (consultas usam `moeda: { $ne: 'USD' }`).
- Nome, preço e descrição são editados pelo super admin; a landing lê `/api/planos/publicos?pais=XX`.

## Brasil: Mercado Pago (`pais` do dono = 'BR', o padrão)
- Cartão: assinatura recorrente (PreApproval). Pix: pagamento avulso que dá **30 dias** de acesso (`PIX_DIAS_DE_ACESSO`), sem renovar sozinho; dá para passar para o cartão depois.
- Webhook com verificação de assinatura (`MP_WEBHOOK_SECRET`); cada pagamento aprovado vira um registro em `pagamentos`.
- Variáveis: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_API_URL` e `MP_TEST_PAYER_EMAIL` (testes), `APP_URL`, `APP_URL_BACKEND`.

## Fora do Brasil: Stripe (`pais` do dono ≠ 'BR')
- O país fica no usuário dono (`pais`; `shared/utils/pais.js`: `ehBrasil`, `moedaDoPais`, `gatewayDoPais`). O cadastro sugere o país pelo navegador; o super admin pode mudar.
- Ao salvar um plano em dólar, `plano.stripe.js` cria o produto ("Sonelia <nome>") e o preço mensal no Stripe (`stripeProductId`, `stripePriceId`); preço mudou → preço novo e o antigo é desativado.
- Assinatura: Checkout em modo assinatura → volta em `#/assinatura/retorno?stripe_session=...` e sincroniza. "Gerenciar assinatura" abre o **portal do cliente** (trocar cartão, faturas, cancelar no fim do período); a configuração do portal é criada pelo sistema (metadata `sistema: 'sonelia'`).
- Webhook `POST /api/assinaturas/stripe/webhook` (corpo cru) com os eventos `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
- Variáveis: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (as reais estão só no `.env` do servidor). A conta Stripe é a mesma de outros produtos do Stanley (Start Business, WebSite): os do Sonelia têm "Sonelia" no nome.
- Excluir clínica no super admin encerra antes a assinatura do Stripe.

## Vencimento e atraso
- **Tolerância de 3 dias** (`DIAS_DE_TOLERANCIA`): Pix vencido vira `inadimplente` com `inadimplenteDesde = proximaCobranca` (na consulta `obterAssinaturaAtual`) e o acesso segue até o fim da tolerância; cartão recusado usa a mesma tolerância. Pix pago na tolerância conta os 30 dias a partir do vencimento antigo.
- **E-mails** (`assinatura.emails.js`, nos três idiomas): aviso 3 dias antes (rotina `assinatura.agendador.js`, de hora em hora, só em produção; `avisoVencimentoEm` evita repetir) e agradecimento a cada pagamento (Pix, crédito, cartão e Stripe).
- **Telas:** barra e janela em `modules/assinatura/components/AvisoVencimento.jsx` e `ModalVencimento.jsx`; regras em `avisoDeVencimento` (`assinatura.utils.js`).

## Afiliados e indicação (só valem para pagamentos em reais)
- **Afiliado:** comissão de **50% da primeira mensalidade** da clínica indicada, liberada no 8º dia (prazo de desistência); paga por Pix pelo super admin.
- **Indique e ganhe:** a clínica que indica ganha **50% de desconto** no próximo pagamento.
