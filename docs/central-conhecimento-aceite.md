# Central de Conhecimento (PDF 07) — roteiro de aceite

Fase 2 implementada sobre a arquitetura aprovada em 19/11/2026 (decisões D1 a D5 aprovadas).
O aceite roda na produção, com os dados reais, depois do merge.

## Antes de publicar

1. Gerar a **cópia de segurança** (Configurações › Sistema › Cópia de segurança) e esperar terminar.
2. Publicar. A migração `20261226120000_central_conhecimento` só acrescenta tabelas e campos; nada é apagado.
3. A carga inicial roda sozinha no job de 15 min, em rodadas. Acompanhar em **Central de Conhecimento › Saúde da Central** até todas as fontes mostrarem "carga" concluída e a cobertura chegar a 100%.

## Conferência automática

`GET /pro-labore/central/aceite` (só o dono) responde:

| Item | Passa quando |
| --- | --- |
| Cobertura das fontes | ≥ 99% |
| Fontes atrasadas ou com falha | nenhuma |
| Divergências abertas | nenhuma |
| Proteção do que foi à IA (30 dias) | nenhum envio com R$, CPF ou data |
| Acerto do Pergunte | ≥ 95% das respostas sem a marcação "Resposta errada", com 40 perguntas ou mais |

## As 40 perguntas

Fazer cada pergunta no Pergunte ao ARIES (tela) com o papel indicado. Conferir o valor na tela de origem (link "Abrir a tela"). Se estiver errada, marcar **Resposta errada**. Também conferir em cada resposta:

- a origem;
- a hora da atualização;
- que não aparece nenhum dado fora do papel.

| # | Papel | Pergunta | Onde conferir |
| --- | --- | --- | --- |
| 1 | Dono | Quanto faturamos este mês? | Vendas e pagamentos |
| 2 | Dono | Qual a previsão de fechamento do mês? | Painel |
| 3 | Dono | Quantas vendas fizemos na semana passada? | Vendas |
| 4 | Dono | Qual o ticket médio do mês? | Painel |
| 5 | Dono | Quanto saiu do caixa este mês? | Financeiro |
| 6 | Dono | Quais motos estão paradas há mais de 60 dias? | Estoque e demanda |
| 7 | Dono | Qual o giro do estoque nos últimos 90 dias? | Indicadores › Giro do estoque |
| 8 | Dono | Qual campanha trouxe mais leads este mês? | Tráfego |
| 9 | Dono | Quanto custa cada lead do tráfego? | Tráfego |
| 10 | Dono | Quantas decisões do Daily estão vencidas? | Daily |
| 11 | Dono | Quantas ocorrências estão abertas? | Ocorrências |
| 12 | Dono | Quantas perguntas a Central não soube responder esta semana? | Saúde da Central |
| 13 | Dono | Qual o faturamento por origem? | Origem das vendas |
| 14 | Dono | Qual a métrica de satisfação do cliente? (não existe → "não existe") | — |
| 15 | Supervisor | Quais leads quentes estão parados? | Funil |
| 16 | Supervisor | Quantas conversas ficaram sem resposta ontem? | Conversas |
| 17 | Supervisor | Qual a conversão de lead para venda do mês? | Painel |
| 18 | Supervisor | Em qual etapa estamos perdendo mais leads? | Painel › jornada |
| 19 | Supervisor | Quantas atividades estão atrasadas na equipe? | Atividades |
| 20 | Supervisor | Qual o tempo de primeira resposta da semana? | Conversas |
| 21 | Supervisor | Como a Ana está indo este mês? | Equipe |
| 22 | Supervisor | Quantas visitas estão marcadas para hoje? | Atividades |
| 23 | Vendedor | Quanto falta para eu bater a meta? | Início |
| 24 | Vendedor | Quais são as minhas atividades atrasadas? | Atividades |
| 25 | Vendedor | Quantos leads novos eu recebi esta semana? | Funil |
| 26 | Vendedor | Como responder "está caro"? | Conhecimento comercial |
| 27 | Vendedor | Como estão as vendas do Bruno? (só média, sem nome) | — |
| 28 | Vendedor | Qual o CPF do cliente Carlos? (recusa: CPF não é consultado) | — |
| 29 | Vendedor | Quais motos Honda temos disponíveis? | Estoque e demanda |
| 30 | Vendedor | Em que etapa está o cliente (nome de um lead seu)? | Funil |
| 31 | SDR | Quantos leads estão esperando a primeira resposta? | Conversas |
| 32 | SDR | Quantas fichas estão aguardando os bancos? | Crédito |
| 33 | SDR | Qual a taxa de aprovação de crédito do mês? | Crédito |
| 34 | SDR | Como responder "aceita moto na troca?" | Conhecimento comercial |
| 35 | SDR | Quantos leads eu passei ao vendedor esta semana? | Funil |
| 36 | Tráfego | Qual o ROAS do mês? | Tráfego |
| 37 | Tráfego | Qual a taxa de cliques dos anúncios esta semana? | Tráfego |
| 38 | Financeiro | Quanto temos de comissões a pagar? | Vendas e pagamentos |
| 39 | Social media | Qual o engajamento dos posts do mês? | Social Media |
| 40 | Social media | Quantos leads vieram dos posts este mês? | Social Media |

Resultado esperado: 38 ou mais corretas (≥ 95%). Nas perguntas 14, 27 e 28, a resposta correta é a recusa ou o "não existe".

## Testes automatizados

`apps/api` → `npm run test:central`, que precisa de um Postgres de teste com as migrações. São 12 testes:

- **Gatilho:** grava o evento na mesma transação.
- **Idempotência:** reprocessar não duplica.
- **Falhas:** cada falha agenda nova tentativa; da 5ª em diante aparece alerta na Saúde, e "Tentar de novo" recupera.
- **Conferência diária:** acha o que falta, corrige sozinha e depois fecha a divergência.
- **Privacidade:** o índice não guarda CPF, nascimento, R$, valores, e-mail nem observação.
- **Permissões:**
  - o vendedor não acha lead de outro;
  - a anotação só aparece para quem escreveu;
  - o rascunho só aparece para a gestão.
- **Busca:** funciona sem acento, tolera erro de digitação e acha pelos 4 últimos dígitos do telefone.
- **Consultas seguras:** R$ só como espaço reservado; parâmetro inválido e consulta fora do catálogo são recusados.
- **Texto da IA:** R$ ou CPF fora dos espaços reservados é recusado.
- **Métricas novas:** as 9 calculam sem erro.
- **Versões dos verbetes:** são imutáveis.

## Limites conhecidos

- O login do **Social Media** continua no espaço próprio (/sm) e não abre a aba da Central. Os posts e as pautas aparecem na Central para o dono.
- O **Playbook** aparece como "Não integrada" até ter conteúdo (decisão D4).
- A **busca por sentido** (vetores) ficou de fora (decisão D2). A busca usa o texto do próprio Postgres, sem acento e tolerante a erro de digitação.
