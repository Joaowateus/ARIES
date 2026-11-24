# ARIES Disparo — central de campanhas e distribuição de mensagens

Data: 24/11/2026. Situação: funcional de ponta a ponta com o provedor de teste. Em produção depende de dois ajustes de configuração ("Pendências", no fim).

## 1. Auditoria (o que já existia e foi reaproveitado)

| Área | O que o ARIES tinha | Como o Disparo usa |
| --- | --- | --- |
| Stack | API Express 5 + Prisma 5.22 + Postgres (Supabase) na Vercel (função de 30 s); site Next.js 16 | Mesmo stack, nenhuma dependência nova |
| Contatos | `Lead` (com `telefone`, etapa, vendedor, origem, levantamento), `Cliente`, `AssistenteConversa`, `AssistenteContatoForaCrm` | O público lê essas tabelas na hora; o destinatário guarda só a referência (`leadId`, `clienteId`, `conversaId`) e o mínimo do snapshot |
| WhatsApp | Evolution API, uma instância por vendedor (`AssistenteComercial`), `lib/whatsappEvolution.ts`, webhook `/pro-labore/assistente/webhook/:segredo` | Mesma conexão e mesmo webhook. Foram acrescentados: envio de áudio/vídeo/documento, consulta de mensagens para reconciliar e o evento `MESSAGES_UPDATE` (entregue/lida) |
| Recebimento | `processarWebhookAssistente` → `tratarMensagemDoContato`/`tratarMensagemDoVendedor` | Três ganchos: eco do Disparo, origem `DISPARO` na resposta e ligação da resposta à campanha |
| Histórico de conversa | `AssistenteMensagem` | As mensagens da campanha entram na conversa (origem `DISPARO`) quando o contato responde; não há segundo histórico |
| Filas | Não havia fila dedicada: rotinas em `/sm/cron/minuto|hora|dia` com orçamento de tempo | A fila é o banco (`DisparoMensagem`), lida pela rotina do minuto, depois do atendimento |
| Arquivos | `lib/armazenamento.ts` (Supabase Storage / Vercel Blob; banco só sem armazenamento) | Biblioteca usa o mesmo armazenamento |
| Avisos | `avisarNoWhatsapp` (Aries ou chat "Você"), `LeadFollow` (vira atividade) | Resposta de campanha avisa o vendedor e cria o follow |
| Permissões | `acessos.ts` (módulos NENHUM/VER/EDITAR por pessoa), `leadWhereDe` | Módulo novo `disparo`; público respeita a carteira de cada um |
| Auditoria | Gatilho `aries_imutavel`, `EventoAuditoria`, `comAutor` | Eventos, tentativas e autorizações do Disparo são imutáveis |

Problemas achados na auditoria e tratados:
- O eco de uma mensagem enviada pelo número do vendedor era tratado como "o vendedor escreveu primeiro", e o contato virava conversa pessoal. O Disparo agora reconhece o próprio eco.
- Uma resposta poucos minutos depois da campanha seria tratada como "contato novo", e o robô se apresentaria. A origem `DISPARO` passou a ser checada antes.
- O webhook não pedia `MESSAGES_UPDATE`, então não havia entregue nem lida.

## 2. Arquitetura implementada

```
Tela (site) ──HTTP──> /pro-labore/disparo/*  (só muda estado; nunca envia)
                                  │
Rotina do minuto (/sm/cron/minuto) ──> rodarDisparo(prazo 18 s), depois do atendimento
   1 preparação: VALIDATING → snapshot dos destinatários → READY / NEEDS_REVIEW
   2 agendamento: SCHEDULED na hora → QUEUED
   3 distribuição: QUEUED → mensagens do 1º passo (AGENDADA) → RUNNING (trava por campanha)
   4 reconciliação: ENVIANDO travada e DESCONHECIDO → confirma no WhatsApp antes de qualquer reenvio
   5 envio: por número remetente, em paralelo; trava por linha (FOR UPDATE SKIP LOCKED)
   6 conclusão: COMPLETED / COMPLETED_WITH_ERRORS; recorrência cria a próxima execução
Webhook do WhatsApp (já existente) ──> entregue/lida, eco, resposta → CRM
Adaptador do provedor (lib/disparo/provedor.ts) ──> Evolution (hoje) | provedor de teste
```

Correspondência com as filas pedidas:

| Fila pedida | Onde está |
| --- | --- |
| campaign-preparation e campaign-validation | campanhas `VALIDATING` |
| campaign-dispatch | `DisparoMensagem` `AGENDADA` |
| campaign-retry | `AGENDADA` com `proximaTentativaEm` |
| campaign-reconciliation | `DESCONHECIDO` e `ENVIANDO` travada |
| campaign-webhooks | o webhook que já existe |
| campaign-media | o arquivo é lido do armazenamento na hora do envio |
| Dead Letter Queue | `FALHOU` com `erroClasse = ESGOTOU`, com reprocessamento manual |

## 3. Modelo de dados

Migração `20261227120000_disparo`: só tabelas novas, nenhuma tabela existente é alterada.

| Tabela | Papel |
| --- | --- |
| `pro_labore_disparo_campanhas` | Campanha: finalidade, remetente (FK para `AssistenteComercial`), público, conteúdo, configuração, agendamento, recorrência, status, versão, aprovação, totais |
| `..._campanha_versoes` | Uma linha por edição |
| `..._publicos` | Públicos salvos (só a definição) |
| `..._destinatarios` | Destinatário por versão, `@@unique(campanha, versão, telefone)`. FK para `Lead` e `Cliente` (SET NULL). Snapshot das variáveis e motivo de exclusão |
| `..._mensagens` | A fila: um passo por destinatário, `chave` única `campanha:destinatário:passo`, `providerId` único, status, tentativas e horários |
| `..._tentativas` | Cada tentativa (não pode ser apagada) |
| `..._eventos` | Linha do tempo e auditoria (imutável) |
| `..._modelos`, `..._midias` | Biblioteca |
| `pro_labore_contato_autorizacoes` | Autorização, revogação e bloqueio por telefone (imutável; a linha mais recente vale) |
| `pro_labore_disparo_config` | Regras da loja |

Não foram criadas `provider_connections` (é a `AssistenteComercial`, sem credencial nova) nem `campaign_audit_logs` (os eventos imutáveis cumprem o papel).

## 4. Serviços (`apps/api/src/lib/disparo/`)

- **`regras.ts`**: estados e transições, configuração, telefone, variáveis, janela, classificação de erros, espera com variação e detecção de pedido de descadastro.
- **`publico.ts`**: bases (incluindo a Equipe, que são os WhatsApps conectados), 13 públicos prontos, filtros E/OU com um nível de subgrupo, seleção manual, junção por telefone e exclusões com motivo único.
- **`autorizacao.ts`**: situação atual por telefone, registro, e revogação ou bloqueio que cancela as promocionais pendentes.
- **`provedor.ts`**: o contrato do provedor (conexão, capacidades, envio, reconciliação, números existentes) e a implementação Evolution, mais um provedor de teste.
- **`motor.ts`**: preparação, distribuição, envio, retentativa, reconciliação, conclusão, recorrência, decisão manual, entregue/lida, eco e respostas.
- **`relatorios.ts`**: resumo da campanha, visão geral, resultado comercial e comparativo.

## 5. Endpoints (`/pro-labore/disparo/...`)

Permissões: `VER` = módulo `disparo` em VER; `EDITAR` = módulo em EDITAR; Dono = só o dono; Gestão = dono ou supervisor.

| Método e caminho | Permissão | O que faz |
| --- | --- | --- |
| GET `/meta` | VER | Capacidades, variáveis, campos, prontos, remetentes, configuração |
| GET, PUT `/config` | Dono | Regras da loja |
| POST `/publicos/previa` | VER | Contagem, motivos, página de elegíveis ou excluídos, exemplo renderizado |
| GET, POST `/publicos`; PUT `/publicos/:id`; POST `/publicos/:id/arquivar` | EDITAR para gravar | Públicos salvos |
| GET `/contatos?busca=` | VER | Busca para seleção manual |
| GET, POST `/campanhas`; GET, PUT `/campanhas/:id` | EDITAR para gravar | Lista paginada; criar; ver; editar (volta a rascunho, nova versão) |
| POST `/campanhas/:id/duplicar` | EDITAR | Cópia |
| POST `/campanhas/:id/validar` | EDITAR | Prepara o público e vai para pronta ou aprovação |
| POST `/campanhas/:id/aprovar`, `/reprovar` | Gestão | Aprovação |
| POST `/campanhas/:id/iniciar`, `/pausar`, `/retomar`, `/cancelar`, `/arquivar` | EDITAR | Ações da campanha |
| GET `/campanhas/:id/resumo`, `/destinatarios`, `/eventos`, `/comercial` | VER | Monitoramento e resultado comercial |
| GET `/destinatarios/:id` | VER | Mensagens, tentativas e eventos do destinatário |
| POST `/mensagens/:id/decidir` | EDITAR | `REENVIAR` ou `CONSIDERAR_ENVIADA` |
| GET `/visao-geral`; GET `/relatorios/comparativo` | VER | Painel e comparação |
| GET, POST `/modelos`; PUT, arquivar | EDITAR para gravar | Modelos de mensagem |
| GET, POST `/midias`; GET `/midias/:id/arquivo`; arquivar | EDITAR para gravar | Upload binário de até 4 MB, tipo conferido pelo conteúdo, arquivo só com login |
| GET, POST `/autorizacoes` | Autorizar: gestão; revogar ou bloquear: EDITAR; lote: dono | Autorizações |

## 6. Idempotência, retentativas e controle de capacidade

- **Uma tarefa, um envio.** A chave única `campanha:destinatário:passo` e a troca `AGENDADA → ENVIANDO` numa atualização condicional com `SKIP LOCKED` garantem isso. Duas rodadas ao mesmo tempo não repetem nada; isso é testado.
- **Falha do banco depois do envio.** Se o WhatsApp aceitou e a gravação falhar, a mensagem fica `DESCONHECIDO`, nunca volta para a fila.
- **Tempo esgotado ou conexão cortada no meio.** A mensagem fica `DESCONHECIDO` e é confirmada no WhatsApp (`/chat/findMessages`). Se em 30 min não houver confirmação, fica para decisão de uma pessoa.
- **Processo caiu no meio do envio.** `ENVIANDO` há mais de 3 min vira `DESCONHECIDO`.
- **Classificação dos erros:**
  - Definitivo (número sem WhatsApp, inválido): não repete.
  - Sem conexão: volta para a fila sem gastar tentativa, e a campanha mostra "aguardando conexão".
  - Temporário: espera de 1, 2, 4, 8… min (até 60) com ±25% de variação, até o limite de tentativas; depois vai para a fila morta.
- **Ritmo por número.**
  - Intervalo mínimo entre mensagens: padrão 20 s, piso de 8 s, com até 30% de variação.
  - Por hora: padrão 90, teto de 400.
  - Por dia: padrão 400, teto de 3.000.
  - Fora da janela de horário (padrão: segunda a sábado, das 9h às 19h, horário de Brasília) não envia.
- **Prioridade do atendimento.** O Disparo roda depois do atendimento na rotina do minuto e espera quando houve mensagem de atendimento naquele número nos últimos 20 s.
- **Revalidação a cada mensagem.** Antes de cada envio, o sistema confere de novo:
  - situação da campanha;
  - revogação e bloqueio;
  - autorização;
  - resposta;
  - compra;
  - se o vendedor assumiu a conversa.

## 7. Integração com o CRM (respostas)

1. A resposta chega pelo webhook de sempre e o número é identificado.
2. Com a origem `DISPARO`, o fluxo normal do ARIES localiza o lead aberto do telefone ou cria um, sem duplicar, e cria ou usa a conversa. O robô não se apresenta.
3. O destinatário é marcado como respondeu. A sequência para (é o padrão) e a resposta fica ligada à campanha e à conversa.
4. As mensagens da campanha entram no histórico da conversa.
5. O vendedor recebe um follow e um aviso pelo Aries ou pelo chat "Você".
6. "SAIR", "PARAR", "CANCELAR" e afins registram a revogação, e as promocionais pendentes são canceladas.
7. Vendas não são atribuídas à campanha. O relatório comercial mostra o que os destinatários fizeram até 30 dias depois, como correlação.

Números da equipe: podem receber campanhas (comunicado à empresa toda pelo público "Equipe"); só o próprio número que envia fica de fora. Mensagem vinda de um WhatsApp conectado da equipe nunca vira lead nem aciona o robô; se for resposta a uma campanha, fica registrada nela.

## 8. Manual de uso

1. **Campanhas › Nova campanha.**
   1. **Identificação:** nome, objetivo, finalidade e o número que envia.
   2. **Público:** um pronto, filtros ou seleção manual. A prévia mostra quem recebe e quem fica de fora, com o motivo. "Tirar" remove um contato.
   3. **Conteúdo:** uma ou mais mensagens de texto, imagem, áudio, vídeo ou documento da Biblioteca, com a espera entre elas.
   4. **Personalização:** as variáveis e o valor alternativo de cada uma. Sem valor, o contato fica de fora.
   5. **Agendamento:** quando, repetição, janela, ritmo e quando parar a sequência.
   6. **Revisão.**
   7. **Preparar o público**, depois **Confirmar e enviar** (ou agendar). Se a campanha precisar de aprovação, o dono ou o supervisor aprovam na própria campanha.
   8. **Monitoramento:** números ao vivo (atualiza a cada 5 s), destinatários, histórico de cada um, decisões e resultado comercial.
2. **Públicos:** salvar critérios para reutilizar e registrar autorizações. Autorizar exige base legal e evidência; o registro em lote é do dono.
3. **Biblioteca:** modelos e arquivos.
4. **Configurações** (dono): regra de autorização, aprovação, rodapé, palavras de descadastro e o padrão de ritmo e janela.

## 9. Testes realizados

| Bateria | Resultado |
| --- | --- |
| `npm run test:disparo` (`disparo.test.ts`, 14 testes) | 14/14. Cobre telefone, variáveis, estados e erros, filtros E/OU, público com duplicados, sem telefone e autorização, revogado, bloqueado, seleção manual e carteira do vendedor, sequência completa, rodadas simultâneas sem envio repetido, pausa, retomada, cancelamento, desconhecido reconciliado sem reenvio, temporário com espera, definitivo, queda do processo, revogação no meio da campanha, entregue e lida (só avança), eco, resposta no CRM sem lead duplicado, follow, SAIR, prioridade do atendimento, número desconectado e auditoria imutável |
| `disparoRotas.test.ts` (4 testes, pela API com tokens) | 4/4. Cobre permissões, aprovação, biblioteca (tipo pelo conteúdo, arquivo só com login) e autorizações |
| Regressão | `test:central` 18/18, `test:painel` 2/2, `test:diagnostico` 2/2, `test:agente` 10/10, `test:assistente` 38/42 (as mesmas 4 falhas de simulação que já existiam) |
| Ponta a ponta no navegador | Dono cria a campanha nas 8 etapas, prepara, confirma; a rotina distribui e envia 12 mensagens pelo provedor de teste; monitor, detalhe do destinatário e comparativo funcionam; nenhum erro no navegador; as 5 áreas cabem em 390 px. Capturas em `prints/` |
| Carga (`tests/disparoCarga.ts`, `carga.json`) | Ver a tabela abaixo |

Resultado da carga (Postgres local, provedor de teste, sem ritmo de proteção; mede o motor, não o WhatsApp):

| Destinatários | Remetentes | Preparação | Envio | Vazão | Falhas | Repetidos | Consulta do CRM durante o envio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | 1 | 0,06 s | 3 s | 33 msg/s | 0 | 0 | 7 ms |
| 500 | 1 | 0,13 s | 9 s | 54 msg/s | 0 | 0 | 6 ms |
| 1.000 | 1 | 0,17 s | 19 s | 53 msg/s | 0 | 0 | 6 ms |
| 5.000 | 10 | 2,5 s | 29 s | 174 msg/s | 0 | 0 | 12 ms |
| 10.000 | 10 | 5,8 s | 60 s | 168 msg/s | 0 | 0 | 21–27 ms |

Na produção, a vazão real é o ritmo de proteção: no padrão, cerca de 3 mensagens por minuto por número, até 90 por hora. Os volumes do teste não são limites autorizados de envio.

## 10. Limitações do provedor (Evolution, número do vendedor)

- É conexão não oficial (WhatsApp Web). Envio em massa para quem não conhece o número, ou com denúncias, pode restringir ou banir o número. Isso atinge também o atendimento individual daquele vendedor.
- Não há modelos aprovados (templates), botões, janela de 24 h nem limites de qualidade da Meta. Isso só existe na API oficial (WhatsApp Cloud API), que exige conta Business verificada, número próprio e modelos aprovados. O adaptador está pronto para receber essa implementação.
- "Lida" só aparece para quem mantém a confirmação de leitura ligada.
- Arquivos de até 4 MB, por causa do limite de pedido da Vercel.

## 10b. Rotina de envio na produção

A rotina `/sm/cron/minuto` é chamada pelo cron-job.org a cada 5 min e, pela economia de banco, só trabalha a cada 15 min. Por isso o Disparo tem rotina própria:

- `POST /pro-labore/sm/cron/disparo` com o cabeçalho `x-cron-secret` (o mesmo segredo das outras rotinas), **a cada 1 minuto** no cron-job.org. Sem campanha ativa, sai sem trabalho.
- Sem essa rotina, o Disparo ainda roda nas chamadas de 5 min que a economia pularia, quando há campanha ativa.
- Ritmo efetivo com o padrão (20 s + variação): cerca de 1 mensagem por minuto por número com a rotina de 1 minuto; cerca de 1 a cada 5 min sem ela.

## 10c. Envio pela tela e travas seguras no pooler

- **A tela da campanha aberta também envia.** Enquanto a campanha está na fila ou enviando, a tela pede uma rodada do motor a cada 20 s (`POST /pro-labore/disparo/processar`, módulo Disparo). É o mesmo trabalho da rotina: respeita intervalo, limites, janela, conexão e a prioridade do atendimento. Assim a campanha nunca fica parada esperando a rotina automática; com a rotina de 1 minuto ligada, pode fechar a tela.
- **Painel "Situação do envio"** no acompanhamento: o caminho da campanha (Montar → Revisar → Agendada/na fila → Enviando → Concluída) e, em linguagem simples, o que acontece agora (na fila, enviando, próxima mensagem em X s, fora do horário e quando volta, limite da hora/dia, número desconectado, pausada) e se o envio automático está ligado.
- **Configurações › Envio automático** mostra se a rotina automática está rodando (última rodada nos últimos 10 min) e como ligá-la.
- **Travas:** `pg_advisory_lock` foi trocado por travas com prazo na tabela `pro_labore_disparo_travas`. No pooler de transação do Supabase (porta 6543) a trava de sessão podia ficar presa numa conexão e a campanha parar na fila. Agora: distribuição e preparação por campanha, e um laço por número remetente de cada vez (tela e rotina juntas não furam o intervalo). A mesma tabela guarda a última rodada do motor (da rotina e da tela).

## 10d. Cronômetros e prioridade do atendimento

- **Cronômetros** no painel "Situação do envio" (atualizam a cada segundo): próxima mensagem (contagem regressiva), desde a última enviada, tempo de envio da campanha e ritmo médio por mensagem (com o intervalo mínimo configurado e quantas já saíram).
- **Prioridade do atendimento:** antes, se o número tivesse qualquer mensagem de atendimento nos últimos 20 s, a rodada desistia; com o WhatsApp do vendedor movimentado a campanha podia nunca sair. Agora a rodada espera 8 s de silêncio do atendimento e envia na mesma rodada.
- **Motivo de cada parada:** ao fim de cada rodada, o número remetente grava por que parou (intervalo, limite, fora do horário, atendimento, sem conexão, erro) em `pro_labore_disparo_travas` (`estado:remetente:<id>`); o painel mostra quando é atendimento ou erro, e a tela mostra o resultado da última rodada que ela pediu.

## 11. Variáveis de ambiente

Nenhuma variável nova na produção. Usa as que já existem: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `SOCIAL_MEDIA_CRON_SECRET` e o armazenamento (`SUPABASE_*` ou `BLOB_READ_WRITE_TOKEN`).

Só para testes e demonstração local (bloqueadas quando `VERCEL=1`):
- `DISPARO_TESTE_SEM_RITMO=1`
- `DISPARO_PROVEDOR_TESTE=1`

## 12. Pendências e decisões do dono

- [ ] **Reapontar o aviso de cada número.** Em Conversas › Conexão › Diagnóstico, clicar em "Reapontar o aviso". Isso passa a incluir `MESSAGES_UPDATE`; sem esse passo, não aparecem entregue e lida.
- [ ] **Regra de autorização.** O padrão é "só quem autorizou". Sem autorizações registradas, nenhuma campanha promocional tem destinatário. Escolha em Configurações; a alternativa de relação comercial é decisão e risco da loja.
- [ ] **Decidir sobre a API oficial do WhatsApp** para campanhas promocionais em volume, para proteger os números dos vendedores.
- [ ] **Ritmo padrão.** 20 s, 90 por hora e 400 por dia é conservador; ajuste em Configurações.

Pendências técnicas, sem decisão do dono:
- A preparação lê a carteira inteira na memória: medido até 10.000 leads em 5,8 s. Lojas muito maiores pedem filtros direto no SQL.
- O monitor atualiza consultando o servidor a cada 5 s; o ARIES não tem canal de tempo real.
- Recorrência diária, semanal e mensal está implementada; outras frequências não.
- O relatório comercial não mostra custo nem retorno, porque não há custo por mensagem registrado.
