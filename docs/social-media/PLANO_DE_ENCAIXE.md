# Social Media com acesso isolado · Plano de encaixe

> Passos 1 e 2 do `PROMPT_CLAUDE_CODE.md`. Li a especificação inteira e os 14 protótipos de `referencia-visual/`. Este documento mapeia o repositório, mostra onde cada seção da especificação se encaixa, aponta os conflitos com a arquitetura atual e reúne **todas** as perguntas de uma vez. Nada foi construído ainda: espero a aprovação do plano.

---

## 1. Mapa do repositório

### 1.1 Stack e organização

| Camada | O que existe hoje |
|---|---|
| Monorepo | `apps/web` (front) e `apps/api` (back) |
| Front | **Next.js 16** (App Router) + **React 19**, componentes cliente, sem biblioteca de estado global: estado local com `useState`/`useEffect` e contexto para autenticação (`lib/proLaboreAuth.tsx`) e tema (`lib/proLaboreTheme.tsx`) |
| Back | **Express 5** + **Prisma 5** + **PostgreSQL**, validação com `zod` |
| Deploy | Vercel nos dois projetos (`aries` e `ariessistemacomercial`). A API roda como **função serverless** (`apps/api/vercel.json`, `maxDuration: 30s`) e roda `prisma migrate deploy` no build |
| Agendamentos | Não há processo contínuo. Jobs são **endpoints protegidos por segredo** chamados por um cron externo (cron-job.org), como já é feito em `POST /pro-labore/social-media/sincronizar-cron` e no Tráfego |
| Testes | Testes de ponta a ponta com Playwright (API + navegador) contra mocks da Meta e da Evolution |

O repositório tem **dois produtos**:
- **ARIES principal**: modelos `Empresa`, `Usuario`, `Unidade` (estoque), `Oportunidade`.
- **Pró-Labore**: `ProLaboreUsuario`, `Vendedor`, `Lead`, `Venda`, Social Media, Tráfego, Assistente Comercial. O módulo novo entra aqui.

### 1.2 Autenticação e papéis (Pró-Labore)

- **Login:** JWT próprio (`lib/jwtProLabore.ts`). O payload traz `sub` (a conta do dono), `papel` e `vendedorId`.
- **Papéis hoje:**
  - `DONO` (a conta `ProLaboreUsuario`);
  - `VENDEDOR` e `SUPERVISOR`: são `Vendedor` com e-mail e senha, e o papel vai no campo `Vendedor.papel`.
- **Middlewares:** `requireProLaboreAuth`, `requireDono`, `requireDonoOuSupervisor`.
- **Menu lateral:** em `app/pro-labore/(painel)/layout.tsx`, com `donoOnly` e `hideFromVendedor` por item.

### 1.3 CRM, vendas e consultores

- **`Lead`:**
  - campos `estagio` (LEAD → FECHADO/PERDIDO), `vendedorId`, `modeloInteresse`, `tipoLead` (`TRAFEGO` | `ORGANICO`), `vendaId`;
  - histórico de estágios em `LeadEstagioHistorico`.
- **`Venda`:** `valorVenda`, `valorProLabore`, `valorComissao` (financeiro), `vendedorId`, ligada ao lead pela conversão.
- **Rodízio automático de consultores:** **não existe** (ver conflito C3).

### 1.4 Estoque

- **O Pró-Labore não tem estoque.**
- O estoque que existe é o do **ARIES principal**:
  - modelo `Unidade`, por `Empresa`;
  - campos modelo, ano, cor, `dataCompra`, `situacao`, além de vários campos de custo;
  - tela em `app/(app)/estoque`.
- Não há ligação entre a conta do Pró-Labore e uma `Empresa` (ver conflito C2).

### 1.5 Instagram hoje (aba Social Media)

- **Conexão:**
  - Instagram API **com login do Instagram** (`graph.instagram.com`, OAuth em `api.instagram.com`);
  - **cada pessoa conecta a própria conta**, com token de 60 dias (`SocialMediaConta`, 1 por pessoa).
- **Dados:**
  - `SocialMediaMidia`: métricas por mídia, inclusive tempo assistido, navegação de story e "seguidores gerados";
  - `SocialMediaSnapshotDiario`: métricas diárias da conta;
  - na conta: demografia, seguidores online por hora e distribuição do alcance.
- **Sincronização:** `lib/socialMediaSync.ts`, manual ou pelo cron externo. Grava `ultimoErroSync`.
- **Tela:** `app/pro-labore/(painel)/social-media`, com KPIs, evolução diária, composição, radar, formatos, horários, dias da semana, crescimento, audiência, publicações e o funil circular.
- **Miniaturas:** apontam para a CDN do Instagram, por isso quebram.

### 1.6 Tráfego (Meta Marketing API)

- Já conecta **pela empresa**, com token de **usuário do sistema** do Business Manager (app "ARIES Tráfego", `ads_read`).
- Sincroniza insights diários, estrutura (campanhas, conjuntos, anúncios com criativo) e públicos.
- Tem diagnóstico da conexão.
- É a base para separar **pago de orgânico**.

### 1.7 Assistente Comercial

- WhatsApp via **Evolution API**: roteiro de perguntas, regras e CRM. **Não é IA**.
- **Não existe nenhuma integração com modelo de linguagem** no repositório (ver conflito C6).
- Está pausado no momento.

### 1.8 Armazenamento, e-mail e notificações

- **Imagens:** guardadas **no próprio Postgres** (`ImagemUpload`, bytes), servidas por `GET` com chave. Serve para miniaturas, **não para vídeo**.
- **E-mail:** não há envio (nenhum provedor configurado).
- **Push:** não há Web Push, nem service worker, nem PWA.
- **Notificações:** existem internas (`Notificacao`, do ARIES principal) e alertas na própria tela.

### 1.9 Design system

- **`pro-labore.css`:**
  - tokens `--pl-*` (tema escuro e claro já existem, preferência salva por pessoa);
  - fontes **Sora** (títulos), **IBM Plex Sans** (texto) e **IBM Plex Mono** (rótulos);
  - componentes por classe: `.pl-card`, `.pl-btn`, `.pl-alert`, `.pl-field`, `.pl-table`, `.pl-modal-*`, `.pl-theme-toggle`.
- **Visualizações da aba Social Media** em `social-media/_componentes/viz.tsx`: `CartaoViz` com alternância para tabela, `Abas`, `Vazio`, tooltip, paleta azul de dados.

---

## 2. Onde cada seção da especificação se encaixa

### Seção 2 · Design system

- **Escopo:** os tokens da especificação entram como `--sm-*` numa classe `.sm-app`, que vale **só no espaço do papel Social Media e na tela 07**.
- **Reaproveitamento:** onde o valor bate com um token `--pl-*`, o `--sm-*` aponta para ele. O tema claro é derivado mantendo a semântica e contraste ≥ 4,5:1, usando o mesmo mecanismo de tema que já existe.
- **Componentes base:** criados em `app/pro-labore/sm/_ui/`: `Card`, `Chip`, `Button`, `SegmentedControl`, `Toggle`, `KpiCard`, `ProgressBar`, `Banner`, `Kbd`, `AccountStatusCard`, `EmptyState`, `Skeleton`, `Toast` com desfazer.
- **Gráficos:** reaproveito `CartaoViz`, `Abas`, `Vazio` e o tooltip de `viz.tsx`.
- **Fontes:** o protótipo usa **Manrope** nos títulos, e o Pró-Labore usa **Sora** (pergunta P14).

### Seção 3.1 · Papel e permissões

**Papel e login**
- Novo papel `SOCIAL_MEDIA` no JWT.
- O login usa a mesma tela `/pro-labore/login`.

**Bloqueio por padrão no backend**
- Um token `SOCIAL_MEDIA` só passa nas rotas novas `/pro-labore/sm/*` e em `auth/me`. Qualquer outra rota do Pró-Labore responde 403.
- Isso fica num middleware único, para não depender de lembrar rota por rota.

**Permissões por módulo**
- Tabela `PermissaoSocialMedia`: nível Completo / Leitura / Sem acesso por módulo, mais os 4 toggles de regras.
- Cada rota `/sm/*` checa o nível com `requireModuloSM('crm', 'leitura')`.
- As consultas **omitem os campos sensíveis já no `select`**:
  - venda nunca devolve `valorProLabore` nem `valorComissao`;
  - estoque nunca devolve custo nem margem;
  - Tráfego só devolve gasto de impulsionamento de posts.

**"Ver como Social Media"**
- O dono navega no espaço do papel com o próprio token mais o cabeçalho `x-ver-como: SOCIAL_MEDIA`.
- O backend aplica exatamente os mesmos filtros, em modo só leitura.

**Convite**
- O gestor informa e-mail, nome e forma de tratamento.
- O sistema gera um link de convite para definir a senha. O envio por e-mail depende de P10.

### Seção 3.2 · Conexão pela empresa

**Nova conexão "Conta da empresa"**
- Via **Graph API do Facebook** (`graph.facebook.com`), com token do **usuário do sistema** do Business Manager.
- Mesmo caminho que o Tráfego já usa. Se for o mesmo app, é um token só para as duas coisas (P1).
- Reaproveita o cartão de diagnóstico do Tráfego, adaptado para as permissões do Instagram.

**Por que trocar a API**
- A conexão por login do Instagram de hoje não tem a Business Discovery (concorrentes).
- E não cruza com a conta de anúncios do Business Manager.

**Jobs (cron externo, protegidos por segredo)**

| Job | Frequência |
|---|---|
| Conta e mídias recentes | `sm/cron/hora`, de hora em hora |
| Mídias de 7 a 90 dias | `sm/cron/dia`, diário |
| Publicação agendada, avisos e retentativas com backoff | `sm/cron/minuto`, a cada 5 min |

- Cada execução grava em `SmSincronizacao` (job, início, fim, status, erro, próxima tentativa).
- Lacunas de dados ficam em `sincronizado` no snapshot diário.

**Webhooks da Meta**
- `POST /pro-labore/sm/webhook/instagram`, com verificação de assinatura `X-Hub-Signature-256` e token de verificação.
- Cobrem comentários, menções e mensagens.

**Cache de miniaturas**
- Baixa a imagem ao sincronizar e guarda em armazenamento próprio (P8).

### Seção 3.3 · Métricas

**Campos novos em `SocialMediaMidia`**
- Duração, pulo nos 3 s, reposts, trial reel, código do post e pauta.
- Miniatura local e pilar.
- Views por plataforma nos reels cruzados com o Facebook.

**Orgânico, pago e total**
- Tabela nova `SmMidiaInsight`, com uma linha por mídia por origem (`ORGANICO` | `PAGO` | `TOTAL`).
- O pago vem do Tráfego: anúncios cujo criativo usa `effective_instagram_media_id`. Esse campo passa a ser sincronizado na estrutura do Tráfego.

**Limite da API**
- A Meta entrega o total por mídia e o pago pelo anúncio.
- Interações e views somam, então **orgânico = total − pago**.
- **Alcance único não soma** (a mesma pessoa pode ter visto pelos dois). O alcance orgânico de posts impulsionados fica marcado como **estimado**, com uma dica explicando.

### Seção 3.4 · Modelo de dados

O que já existe é estendido em vez de duplicado:

| Especificação | No banco |
|---|---|
| `ig_account` | `SocialMediaConta`, ganha `tipoConexao` (`EMPRESA` \| `PESSOAL`) e status de sync |
| `ig_account_daily` | `SocialMediaSnapshotDiario`, ganha `sincronizado` |
| `ig_media` | `SocialMediaMidia`, com os campos novos |
| `ig_media_insights` | `SmMidiaInsight` (novo) |
| `ig_story` e insights | `SocialMediaMidia` com formato `STORY` |
| `ig_audience_snapshot` | `SmAudienciaSnapshot`: a demografia passa a ter histórico |

Tabelas novas, com prefixo `pro_labore_sm_`:
- **Produção:** `SmPauta`, `SmPautaMidia`.
- **Atendimento e atribuição:** `SmConversa`, `SmMensagem`, `SmAutomacao`, `SmRespostaRapida`, `SmLinkRastreado` (+ cliques).
- **Metas, rituais e IA:** `SmMetaSemanal`, `SmTesteAB`, `SmGancho`, `SmConquista`, `SmRitualExecucao`, `SmSaudacaoFrase`, `SmSaudacaoExibida`, `SmInsightEstado` (feito/desfeito), `SmConcorrente`.
- **Estoque:** `SmMotoEstoque` (ver conflito C2).

**Notificações**
- Tabela própria do Pró-Labore `SmNotificacao`, com agrupamento.
- Não reaproveito a `Notificacao` do ARIES principal, que é presa a `Empresa` e `Usuario`.

**CRM**
- `Lead` ganha `origem`, `postCode`, `midiaId`, `canalEntrada` e `conversaId`. O `tipoLead` continua.
- A venda herda a origem **pelo lead** (`Lead.vendaId`). Não é preciso duplicar campos em `Venda`.

### Seção 3.5 · Atribuição

- **Código do post:** gerado ao agendar a pauta (`#P-DDMM-MODELO`), com `#S-…` para stories e `#BIO` para a bio.
- **Link rastreado:**
  - `GET /r/{code}` fica no **front** (rota curta e pública);
  - registra o clique pela API e redireciona para `wa.me/{numero}?text=…`, com a mensagem que contém o código.
- **Reconhecer o código:**
  - no CRM, o formulário de lead detecta `#P-…` colado em qualquer campo e liga o lead ao post;
  - no WhatsApp automático, depende de P9.
- **"Transformar em lead":** cria o `Lead` com origem e código já preenchidos, e o consultor é escolhido pelo rodízio (C3).
- **Venda:** é creditada ao post do lead mesmo quando fechada depois do período analisado.
- **Tempo até a venda:** do primeiro contato até `fechadoEm` do lead.

### Seções 4 a 11 · Telas

- **Onde ficam:** rotas novas em `app/pro-labore/sm/`, com layout próprio (menu lateral do papel e cartão da conta):
  - `/sm` (Hoje);
  - `/sm/calendario`, `/sm/producao`, `/sm/atendimento`;
  - `/sm/desempenho`, `/sm/vendas-por-post`;
  - `/sm/boas-vindas`, `/sm/foco`, `/sm/retrospectiva`;
  - `/sm/recepcao` (simulador, só para o gestor).
- **Tela 07:** fica em `/pro-labore/equipe/acessos`, dentro do menu do gestor (grupo Equipe → "Acessos e permissões").
- **Login do papel:** redireciona para `/sm`, ou para `/sm/boas-vindas` no primeiro acesso.
- **Paleta Ctrl+K e atalhos:** componente global no layout de `/sm`.
- **Arrastar e soltar** (calendário e kanban): implementação própria com Pointer Events, sem biblioteca nova. O mapa mental já faz isso assim.
- **Celular (seção 11.5):** PWA com `manifest`, service worker e Web Push com chaves VAPID.
  - "Pulso" e "Aprovação" usam rotas `/sm/m/*` otimizadas para tela pequena.
  - "Captura na loja" usa `<input capture>` e envio direto para o armazenamento (P8).

### Seção 8 · Desempenho e a aba atual

- **Uma implementação só:** a tela 05 reaproveita os componentes de `social-media/_componentes` (evolução diária, composição, radar, formatos, horários, dias da semana, crescimento, audiência e publicações). Eles ganham o controle Orgânico | Pago | Total e as correções da seção 17.
- **Aba do dono:** passa a usar a mesma tela.
- **Funil circular atual:** é substituído pelo funil novo.

### Seções 12 e 13 · Métricas e motor de insights

- **Motor no backend:** `lib/smInsights.ts`, com funções puras e testadas.
  - Uma regra por linha da tabela 13.4.
  - Aplica as regras de qualidade de 13.2 (amostra mínima, lacunas, orgânico como padrão, sem contradição).
  - Cada insight sai com tipo, aba, confiança, amostra, ação e validade.
- **Ações executáveis:** passam por uma rota única com **desfazer** de 5 s.
- **Testes:** com dados equivalentes aos dos protótipos, o motor tem que produzir as frases do objeto `D` de `Assistente.html`.

### Seção 14 · Saudação

- **Motor:** `lib/smSaudacao.ts`, com as 8 prioridades da seção 14.2.
- **Banco de frases:** `SmSaudacaoFrase`, com 8 a 10 variações por momento, carregadas por seed.
- **Rotação:** 7 dias por usuário.
- **Expediente:** respeita o horário configurado (P13).
- **Tratamento:** nome e forma de tratamento vêm do cadastro do convite.

### Seção 16 · Assistente da aba e IA

- **Componente único:** `<AssistenteAba aba="…" />`.
  - O conteúdo vem do motor de insights.
  - O estado de recolhido fica salvo por pessoa e por aba, em `PreferenciaProLabore`, que já existe.
- **IA:** um serviço único, `lib/smIA.ts`.
  - Recebe **só números já calculados** e os campos que o papel pode ver.
  - Nunca recebe custo, margem, pró-labore nem comissão (lista de bloqueio com teste automatizado).
  - Depende de P5.

---

## 3. Conflitos e adaptações propostas

| # | Conflito | Adaptação proposta |
|---|---|---|
| **C1** | **O Instagram de hoje é conectado com o login do Instagram, um por pessoa.** A especificação quer conexão pela empresa via usuário do sistema. | Adicionar a conexão "Conta da empresa" pela Graph API do Facebook com o token do usuário do sistema (mesmo caminho do Tráfego). A conta `@mmnegociosveiculos` passa a usar essa conexão. As contas pessoais continuam no fluxo atual, separado, se a resposta de P2 for sim. |
| **C2** | **O Pró-Labore não tem estoque.** O único estoque (`Unidade`) é do ARIES principal, preso a uma `Empresa`, e não há ligação entre as duas contas. | Depende de P3. Opções: **(a)** ligar a conta do Pró-Labore a uma `Empresa` do ARIES e ler `Unidade` só com modelo, ano, cor e dias em estoque; **(b)** criar um estoque leve dentro do Pró-Labore (`SmMotoEstoque`), mantido pelo gestor; **(c)** importar de outro sistema que vocês usem. |
| **C3** | **"Rodízio automático do CRM" não existe.** Hoje o lead é atribuído à mão (ou ao próprio vendedor que cria). | Criar o rodízio no CRM: próximo consultor ativo da fila, guardando o último atendido. Ele vale para os leads do Social Media e pode valer para o CRM todo, se você quiser (P4). |
| **C4** | **A API roda em função serverless (30 s, sem processo contínuo).** A especificação pede jobs de hora em hora, publicação no horário exato e captura de stories. | Endpoints de cron protegidos por segredo, chamados pelo cron-job.org que vocês já usam: a cada 5 min (publicação, avisos, retentativas), de hora em hora (conta, mídias e stories) e diário (mídias antigas). Cada execução processa em lotes curtos para caber em 30 s. A publicação sai com até 5 min de atraso em relação ao horário marcado. |
| **C5** | **Vídeos e miniaturas.** Hoje as imagens ficam no Postgres. A Vercel limita requisições a 4,5 MB, vídeo não cabe no banco, e a API de publicação da Meta exige uma **URL pública** do vídeo. | Armazenamento de objetos (P8). O celular envia direto para o armazenamento com URL assinada, sem passar pela API. As miniaturas também vão para lá. |
| **C6** | **Não existe integração de IA para reaproveitar.** O "Assistente Comercial" é um roteiro de regras no WhatsApp, não um modelo de linguagem. | Criar a integração do zero, num serviço único, com chave em variável de ambiente (P5). Enquanto ela não estiver ligada, o produto funciona com textos por template; a IA só melhora a redação. |
| **C7** | **Sem envio de e-mail** (convite, relatório de segunda, canal "E-mail"). | Provedor de e-mail transacional (P10). Sem ele, o convite sai como link para copiar e o relatório fica na tela e no push. |
| **C8** | **Canal "WhatsApp" dos avisos** e reconhecimento automático do código no WhatsApp. O único WhatsApp integrado é a Evolution, por vendedor, e está pausado. | P9 e P11. |
| **C9** | **Alcance orgânico não é subtraível.** Total − pago dá certo para interações e views, mas não para alcance único. | Mostrar o alcance orgânico de posts impulsionados como **estimado**, com dica. É honesto com a regra 15.8. |
| **C10** | **Permissões da Meta que exigem App Review** (`instagram_manage_messages`, `instagram_manage_comments`, `instagram_content_publish`, `business_management`) e app em modo Live, com verificação da empresa. | Construo e testo tudo contra mocks da Meta, como fiz no Tráfego. Ligar em produção depende de vocês enviarem o app para revisão (eu preparo o roteiro e os textos de justificativa). Até a aprovação, Atendimento e Publicação ficam com o aviso "aguardando aprovação da Meta" e o resto funciona. |
| **C11** | **O protótipo usa Manrope nos títulos; o Pró-Labore usa Sora.** | P14. |
| **C12** | **Funil e meta de frequência atuais estão errados** (seção 17). | Substituir na própria aba: uma implementação só, como na seção 8 acima. |

---

## 4. Perguntas (todas de uma vez)

**Da especificação ([CONFIRMAR COM O JOÃO])**

1. **P1 · Meta app:** uso **o mesmo app e o mesmo usuário do sistema do Tráfego** ("ARIES Tráfego"), acrescentando os produtos e as permissões do Instagram? Recomendo que sim: um token só, um diagnóstico só.
2. **P2 · Contas pessoais (3.2):** outras pessoas da equipe continuam conectando o Instagram pessoal na aba Social Media? Se sim, mantenho esse fluxo separado da conta da empresa.
3. **P5 · IA (16.3):** qual provedor e modelo usar? Não há IA no sistema hoje para reaproveitar. Recomendo a API da Anthropic (Claude), com um modelo mais rápido para respostas sugeridas e saudações. Você cria a chave e eu configuro só na Vercel (nunca no repositório).
4. **P6 · Autorização de imagem (seção 6):** como registrar a autorização do cliente nas entregas? Sugestão:
   - um termo curto aceito no celular do cliente (nome, CPF e assinatura com o dedo), gravado na pauta;
   - **ou** só um checkbox "cliente autorizou" com foto do termo em papel.
5. **P7 · Celular (11.5):** PWA (recomendado: instalável, com push, sem loja de apps) ou app nativo?
6. **P12 · Concorrentes (Fase 6):** quais perfis de outras revendas da região acompanhar? Mande os @.

**Do encaixe no repositório**

7. **P3 · Estoque (C2):** onde está o estoque da MM hoje? (a) No ARIES principal, (b) em outro sistema (qual?), ou (c) em nenhum, e eu crio um estoque leve no Pró-Labore?
8. **P4 · Rodízio (C3):** como deve funcionar? Sugestão: entram só os consultores ativos com login, em ordem fixa, pulando quem estiver de folga. Vale só para leads do Instagram ou para o CRM todo?
9. **P8 · Armazenamento de mídia (C5):** posso usar **Vercel Blob** (já está na Vercel, cobra por uso) ou prefere Cloudflare R2 / Amazon S3?
10. **P9 · WhatsApp da loja (C8):** qual número recebe os cliques do link rastreado? O código é reconhecido automaticamente quando a mensagem chega (exige o WhatsApp da loja conectado na Evolution) ou o consultor cola o código no lead (o CRM reconhece sozinho)?
11. **P10 · E-mail (C7):** posso usar um provedor transacional (sugestão: Resend) para convite, relatório de segunda e avisos por e-mail? Precisa de um domínio para remetente.
12. **P11 · Avisos por WhatsApp:** o canal "WhatsApp" do onboarding envia por qual número? Sem a Evolution ativa, eu deixo só push e e-mail.
13. **P13 · Expediente:** qual o horário de trabalho do Social Media (ex.: seg a sex, 8h às 18h)? Fuso: Belém (igual a Brasília).
14. **P14 · Fonte dos títulos (C11):** Manrope, como no protótipo, só no espaço do Social Media, ou Sora, como o resto do Pró-Labore? Recomendo Manrope só no espaço do Social Media, para seguir o protótipo, mantendo os demais tokens compatíveis.
15. **P15 · Quem é o responsável:** nome, forma de tratamento (para "Bem-vindo/Bem-vinda") e e-mail de quem vai usar o acesso.

---

## 5. O que depende de vocês fora do código

- **Meta Business Manager:**
  - conta `@mmnegociosveiculos` ligada a uma Página do Facebook no mesmo BM;
  - usuário do sistema com acesso à conta do Instagram e à Página;
  - token novo com as permissões da seção 3.2;
  - **App Review** das permissões avançadas e app em modo Live.
- **cron-job.org:** 3 tarefas novas (5 min, 1 h e diária). Eu passo URLs e cabeçalhos; o segredo vai só na Vercel.
- **Chaves na Vercel:**
  - IA (P5);
  - armazenamento (P8);
  - e-mail (P10);
  - VAPID para o push (eu gero, você cola);
  - token de verificação do webhook da Meta.

Até isso estar pronto, cada fase é entregue funcionando contra os mocks, com o aviso honesto de que falta a ligação real.

---

## 6. Como vou entregar

- **Ordem:** as fases da seção 18, nesta ordem, incluindo a Fase 6.
- **PRs:** cada fase em PRs pequenos (banco + API, depois telas). Cada PR com testes de ponta a ponta contra os mocks, comparação visual com o protótipo e o checklist da fase marcado em `PROGRESSO.md`.
- **Fim de cada fase:** paro e mostro o que ficou pronto, com prints, antes de seguir.
- **Ordem interna da Fase 0:** correções da seção 17 que não dependem da Meta → conexão pela empresa e jobs → miniaturas → orgânico/pago → tokens e componentes base.
- **Dados:** os números dos protótipos são ilustrativos. Nas telas, todo número vem do banco ou da API. Nos testes, uso os dados reais citados na seção 0 (10.297 seguidores, 44 publicações em 30 dias, etc.) para conferir os cálculos.
