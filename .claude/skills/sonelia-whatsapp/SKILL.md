---
name: sonelia-whatsapp
description: Lembretes de consulta pelo WhatsApp no Sonelia (WhatsApp Cloud API da Meta): como funcionam, IDs da conta, modelo de mensagem, webhook, como conferir a situação na Meta e o que falta para liberar. Usar ao mexer nos lembretes, quando o Stanley avisar novidade da Meta ou para testar o envio.
---

# Lembretes pelo WhatsApp

Código: `src/modules/lembrete-whatsapp/` (`whatsapp.client.js`, `lembrete.service.js`, `lembrete.agendador.js`, `lembrete.routes.js`).

## Como funciona
- A cada 10 minutos, das **9h às 20h** (Brasília), o servidor envia o lembrete das consultas de **amanhã** ainda não avisadas.
- Só para clínicas com `lembretesWhatsapp: true` (o super admin liga pelo ícone do WhatsApp na tela **Clínicas**) e com assinatura em dia, e só para pacientes com `aceitaWhatsapp: true` (consentimento no cadastro).
- Modelo **`lembrete_consulta`** (pt_BR, Utilidade, **aprovado**): "Olá, {{1}}! Lembrete da sua consulta na {{2}} amanhã, {{3}}, às {{4}}. Você confirma sua presença?" com botões **Confirmar** e **Desmarcar** (payload `acao:agendaId`).
- Resposta do paciente chega pelo webhook: Confirmar grava `lembrete.resposta`; Desmarcar cancela a consulta. Só vale para a mensagem enviada àquela consulta (`context.id`).
- A situação de cada envio fica em `agendas.lembrete` (`enviando`, `enviado`, `entregue`, `lido`, `falhou` + `erro`).
- Sem `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` no `.env`, os lembretes ficam desligados.

## Conta na Meta
- App **Sonelia** id `1650617456727297` (assinado na WABA em 2026-10-16), WABA `1649938686795093`.
- Número: hoje é o **de teste** da Meta (+1 555-672-8043, Phone Number ID `1387289667798692`), que só manda para até 5 números cadastrados (o do Stanley: 21 99200-2356).
- Variáveis (só no `.env` do servidor): `WHATSAPP_TOKEN` (token permanente de usuário do sistema), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`; opcionais `WHATSAPP_TEMPLATE_LEMBRETE`, `WHATSAPP_API_VERSION`.
- Webhook: `https://api.sonelia.com.br/api/whatsapp/webhook` (verificado pela Meta).
- Conferir a situação (no servidor, sem mostrar o token):
  ```bash
  eval "$(grep -E '^WHATSAPP_(TOKEN|PHONE_NUMBER_ID)=' ~/servidor/env/sonelia.env | sed 's/^/export /')"
  curl -s "https://graph.facebook.com/v23.0/1649938686795093?fields=health_status,business_verification_status" -H "Authorization: Bearer $WHATSAPP_TOKEN"
  curl -s "https://graph.facebook.com/v23.0/1649938686795093/message_templates?name=lembrete_consulta&fields=status" -H "Authorization: Bearer $WHATSAPP_TOKEN"
  ```

## Situação em 2026-10-16 e o que falta
- O envio sai do servidor, mas a Meta não entrega: **"Business account has been locked"**. Motivos que a Meta mostra: verificação da empresa em andamento e perfil da empresa sem **nome legal, país e site** (Meta Business Suite → Configurações → Informações da empresa).
- Falta também cadastrar um **número próprio** (não usado no WhatsApp do celular) e trocar o `WHATSAPP_PHONE_NUMBER_ID` no servidor.
- Quando liberar: testar com uma clínica de teste (paciente com o número do Stanley, consulta amanhã, `lembretesWhatsapp: true`; o servidor envia sozinho em até 10 min), conferir entregue e o botão Confirmar, e tirar o "(em breve)" de "Lembrete de consulta pelo WhatsApp" nos recursos do plano Pro (banco) e na landing.
