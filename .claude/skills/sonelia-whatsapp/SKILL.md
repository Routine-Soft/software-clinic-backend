---
name: sonelia-whatsapp
description: Lembretes de consulta pelo WhatsApp no Sonelia, pela Evolution API (cada clínica conecta o próprio número pelo QR Code): servidor, regras de envio, tela da clínica e como testar. Usar ao mexer nos lembretes ou no WhatsApp das clínicas.
---

# Lembretes pelo WhatsApp (Evolution API)

Desde 2026-11 os lembretes saem do **número da própria clínica**, conectado pelo QR Code, pela **Evolution API** (código aberto, conexão do tipo WhatsApp Web, não oficial). A API oficial da Meta (número da Sonelia, modelo aprovado, webhook) foi removida.

**Fase atual: só lembretes.** O sistema não lê nem responde mensagens (o Stanley não quer IA conversando com paciente por enquanto). As respostas do paciente chegam no WhatsApp da clínica, como qualquer conversa.

## Servidor (OVH)
- Containers `evolution` (`evoapicloud/evolution-api:v2.3.7`, 512 MB) e `evolution_db` (Postgres 16, 192 MB) no `~/servidor/docker-compose.yml`. A v2 só aceita Postgres ou MySQL (não MongoDB); ela guarda só a conexão das clínicas (mensagens, contatos e chats desligados no `env/evolution.env`).
- **Sem porta publicada e sem bloco no Caddy**: só os containers da rede interna falam com ela (`http://evolution:8080`).
- Chaves: `env/evolution.env` (`AUTHENTICATION_API_KEY`) e `env/evolution_db.env`; a Sonelia usa `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` no `env/sonelia.env`. Sem essas variáveis (computador local), o WhatsApp fica desligado.
- Logs: `cd ~/servidor && docker compose logs --since 10m evolution`.

## Backend (`src/modules/lembrete-whatsapp/`)
- `evolution.client.js`: criar conexão, QR Code, estado (`open`/`connecting`/`close`), perfil, apagar, enviar texto; `telefoneWhatsapp` (Brasil com DDD, ou `+` e o código do país).
- `whatsapp.model.js` (`whatsapp_clinicas`): uma por clínica, conexão `sonelia-<tenantId>`, número, lembretes ligados e texto (variáveis `{paciente}`, `{clinica}`, `{data}`, `{hora}`, `{profissional}`; `lembrete.texto.js`).
- `whatsapp.routes.js` (`/api/whatsapp`, admin e recepção): situação, `conectar` (devolve o QR Code; a tela chama de 5 em 5 segundos), `desconectar`, `PATCH` (ligado e texto), `teste`. Recurso `whatsapp` do plano (Basic, Pro e Rede; o Grátis tem cadeado).
- `lembrete.service.js` + `lembrete.agendador.js` (de 10 em 10 minutos): manda **24 horas antes** da consulta, só entre **8h e 20h** de Brasília (se as 24h caem de madrugada, sai às 8h), nunca a menos de 2 horas da consulta; só para paciente com `aceitaWhatsapp` (consentimento, LGPD), clínica com o recurso no plano, lembretes ligados e celular conectado (desconectado, espera reconectar). Pausa de 8 a 20 segundos entre mensagens para diminuir o risco de bloqueio.
- No agendamento: `lembrete.enviadoEm`, `situacao` (`enviando`, `enviado`, `falhou`) e `erro`; trocar dia, horário ou paciente zera.

## Frontend
- Tela `#/whatsapp` (`modules/whatsapp/`), no menu em Gestão: conectar pelo QR Code, número conectado, desconectar com confirmação no lugar, texto com as variáveis e prévia, envio de teste.
- Situação do lembrete aparece no resumo do agendamento (`situacaoDoLembrete` em `agenda.utils.js`).

## Riscos e cuidados
- O WhatsApp pode bloquear o número da clínica (uso não oficial). Está nos termos de uso: o número e o consentimento dos pacientes são da clínica.
- Para testar o envio: conectar um número de teste pela tela e usar "Enviar teste". Nunca mandar mensagem para paciente real em teste.
