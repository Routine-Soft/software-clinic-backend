---
name: sonelia-sigilo
description: Regras de sigilo e acesso aos dados clínicos do Sonelia (prontuário, perfil clínico, anamnese, avaliação neuropsicológica, TCLE), auditoria de acessos e regras de exclusão de paciente. Usar ao mexer em qualquer tela ou rota com dado de saúde, ou em permissões.
---

# Sigilo dos dados clínicos (CFM, CFP e LGPD)

Arquivo central: `src/modules/prontuario/prontuario.acesso.js` (`ProntuarioAcesso`).

## Quem acessa
- Só **profissional de saúde**: login `admin`, `profissional` ou `super_admin` **com cadastro em `profissionais` ligado pelo `usuarioId`** (`profissionalDoUsuario` / `exigirProfissional`). A **recepção nunca** acessa conteúdo clínico (vê agenda e cadastro). O `tenantId` vem do cadastro do profissional.
- **Atendimento do prontuário e anamnese do prontuário:** lê o **autor** e os profissionais das **especialidades que o autor liberou** (`compartilhadoCom`; vazio = só o autor). `filtroLeitura` e `podeLerProntuario`. Só o autor altera.
  - Atendimento: só até **finalizar**; depois, correções entram como **adendo**. Finalizar marca a consulta ligada como realizada e gera o repasse.
  - Anamnese (`src/modules/anamnese/`): o autor pode editar as respostas a qualquer momento; guarda a cópia das seções do modelo.
- **Perfil clínico** (alergias, antecedentes, medicamentos: campos `select: false` no paciente): vê quem atende o paciente ou pode ler algum atendimento dele (`podeVerPerfil`).
- **Avaliação neuropsicológica:** lê o autor ou quem tem/teve agendamento (não cancelado) com o paciente (`podeLerPorAtendimento`); só o autor altera, até finalizar; finalizada não pode ser excluída.
- **Avaliação NR-01:** risco psicossocial por empresa, sem anamnese.

## Auditoria
- Toda leitura, criação, edição, finalização, adendo e compartilhamento grava em `prontuario_acessos` (`ProntuarioAcesso.registrar(contexto, acao, { pacienteId, prontuarioId | avaliacaoId | anamneseId })`). Ações aceitas estão no enum de `prontuario-acesso.model.js`: ao criar tipo novo de documento, inclua as ações e o campo do id lá.

## TCLE (`src/modules/termo/`)
- Link público `#/assinar/:token` (token aleatório secreto, vale 30 dias, assina uma vez). Depois de assinado, o link não mostra mais CPF nem responsáveis.
- Guarda desenho da assinatura, nome, CPF, relação (paciente/responsável), data, IP (`X-Forwarded-For`), aparelho e hashes SHA-256 do documento e da assinatura. Assinado não pode ser cancelado.

## Exclusão de paciente
- Com prontuário: **não pode** (guarda de 20 anos, Lei 13.787/2018). Com termo assinado: **não pode**.
- Paciente de **teste** (`teste: true`, só marcado no cadastro) sai com tudo: prontuários, acessos, agenda, lista de espera, avaliações e termos.
