# Assistente Comercial — engenharia reversa, referências e plano

Objetivo: um assistente que **aborde, qualifique e aqueça** o lead desde a
primeira mensagem, ajude o vendedor durante o atendimento e entregue a ele, no
próprio WhatsApp, o que precisa saber da produção comercial.

## 1. O que já existe (engenharia reversa)

**Conexão**
- WhatsApp de cada vendedor por QR Code ou código de pareamento (Evolution API,
  hoje na Railway). Status, desconexão e duas chaves: *Respondendo leads novos*
  e *Cadastrando leads no CRM*.

**Motor (o que acontece quando chega mensagem)**
- Reconhece lead novo por anúncio (clique para WhatsApp), frase de campanha ou
  contato sem histórico. Ignora grupos, status, mensagens antigas, conversas
  pessoais (quando o vendedor escreveu primeiro) e números bloqueados.
- Roteiro fixo e configurável: até 10 perguntas, opções numeradas, "digitando…",
  junta mensagens em rajada, pede texto quando chega áudio, reconhece por
  palavras-chave quando o lead pede atendente ou pede para parar.
- Sai de cena assim que o vendedor escreve no celular.
- No fim do roteiro, manda o resumo para o vendedor no chat "Você".
- Lead no CRM já na primeira mensagem, sem duplicar telefone. Lead perdido que
  volta a chamar fica quente com follow para hoje. Excluir o lead bloqueia o número.

**Suporte ao vendedor no chat "Você"**
- Só comandos exatos: *menu*, *resumo*, *pendentes*, *pausar*, *ativar*.

**Painel**
- *Desempenho*: atendidos, conclusão do roteiro, espera, tempo de resposta, leads
  no CRM, vendas, funil do roteiro, origem, horário e "do WhatsApp à venda".
- *Conversas*: filtros, conversa completa, responder pelo painel, devolver ao
  assistente, assumir, encerrar, "não é lead", criar lead.
- *Roteiro e teste*: editor de mensagens e perguntas, simulador.

**Em outras abas**
- *Copiloto Comercial*: sugestão de resposta por IA (Claude Haiku, sem valores em
  reais), relatório diário opcional no WhatsApp, chat, memória e estudos.
- *Estoque leve* (Social Media): modelo, marca, ano, cor e situação. Não tem foto,
  ficha técnica, km nem preço.
- *Follow* manual no CRM e *Reativação* dos perdidos.

## 2. Lacunas frente ao objetivo

| Objetivo | Hoje | Falta |
|---|---|---|
| Abordar | Boas-vindas + roteiro fixo | Responder dúvidas no meio do roteiro sem travar |
| Qualificar | 4 perguntas fixas | Nota do lead (0–100), sinais de compra, prioridade |
| Aquecer | Nada depois do roteiro | Apresentar a moto (fotos, ficha), follow com mídia |
| Aprender | Nada | Capturar dúvidas e objeções reais e melhorar as respostas |
| Base de respostas | Nada | Biblioteca de respostas, objeções, argumentos e gatilhos aprovados |
| Sugerir respostas | Só no Copiloto, sem base própria | Sugestão na própria conversa, puxando da base e do estoque |
| Jornada | Etapa muda só na mão | Etiquetas automáticas e avanço de etapa por sinais |
| Assistente pessoal | 5 comandos fixos | Perguntas livres sobre a produção, alertas de lead esperando |

## 3. Referências de mercado

| Referência | O que faz | O que aproveitamos |
|---|---|---|
| [Kommo Salesbot](https://kommo.com/whatsapp/chatbot-for-whatsapp) | Qualifica, põe etiquetas, move o lead de etapa, follow quando o contato some por dias | Etiquetas + avanço por regra + follow por inatividade |
| [Trengo AI Agent](https://together.trengo.com/fr/changelog/ai-agent-2-0-knowledge-gap-detection-331014) | Detecta as "lacunas de conhecimento" nas conversas que foram para humanos e rascunha conteúdo a partir de como o humano resolveu | Aprendizado: dúvidas novas viram rascunhos a partir da resposta real do vendedor |
| [Trengo para concessionárias](https://www.trengo.com/industries/dealships) | IA coleta modelo, orçamento e troca, e passa o lead qualificado | Qualificação por sinais, não só por perguntas |
| [Fullpath](https://www.fullpath.com/ai-powered-lead-handling-for-car-dealers) | Agente de lead que consulta o estoque em tempo real e escala para humano por regra | Vitrine do estoque dentro da conversa |
| [AutoSDR (BR)](https://blog.autosdr.com.br/blog/crm-para-concessionaria-de-motos) | Nota do lead de 0 a 100, agenda visita, CRM e WhatsApp juntos; em moto, resposta em até 5 min decide | Nota do lead + alerta de lead esperando |
| [HubSpot: objeções](https://www.hubspot.com/agent.ai-sales-objection-agent) | Biblioteca de objeções e quais aparecem mais | Ranking das dúvidas e objeções da semana |
| [Respond.io](https://respond.io/pt/blog/whatsapp-api-for-automotive-industry) | Qualifica por preferência, orçamento e local antes de encaminhar | Perguntas de qualificação + base de respostas |
| [Glean](https://www.glean.com/perspectives/leveraging-ai-for-effective-objection-handling-in-sales) | IA procura e reconhece padrões; a pessoa dá a palavra final | Humano aprova o que o assistente aprende |

**Alerta sobre o número (fontes: [Achiya](https://achiya-automation.com/en/blog/whatsapp-spam-detection-2026/),
[docs da Evolution](https://mintlify.com/EvolutionAPI/evolution-api/whatsapp/baileys)):** em conexão por QR
Code, o risco de bloqueio está em mandar mensagem para quem não chamou primeiro e em disparos em massa.
Responder quem chamou é bem mais seguro. O follow automático segue essas regras (seção 5).

## 4. Princípios

1. **O assistente só diz ao cliente o que a loja aprovou.** Resposta para o cliente sai da base aprovada,
   do estoque cadastrado ou do roteiro. A IA ajuda a encontrar, agrupar e rascunhar; não inventa preço,
   condição, prazo nem estoque.
2. **A IA nunca recebe valores em reais** (custo, margem, comissão, faturamento, preço), como no resto do
   sistema. Preço da moto, se a loja quiser mostrar, entra por modelo pronto, fora da IA.
3. **Aprende com os nossos clientes, com aprovação.** Dúvidas e objeções reais são capturadas sozinhas e
   ficam esperando revisão antes de virar resposta automática.
4. **O vendedor manda.** Tudo que o assistente faz sozinho tem registro, aviso e "desfazer". Etapa só anda
   para frente e nunca vai sozinha para Fechado ou Perdido.
5. **Proteger o número.** Mensagem automática só para quem chamou primeiro, com limite por dia, horário
   comercial e parada imediata quando o lead responde ou pede para parar.
6. **Custo baixo.** IA no modelo mais barato (Haiku), com cota diária; o que dá para fazer por regra é feito
   por regra.

## 5. Plano por fases

**Fase 1 — Cérebro: base de conhecimento + aprendizado**
- Biblioteca única da loja com **dúvidas, objeções, argumentos e gatilhos**. Cada item tem a pergunta
  típica, a resposta aprovada, palavras-chave, frases reais dos clientes, moto ou etapa a que se aplica,
  quantas vezes apareceu, quantas vezes foi usada e quantas vezes o lead avançou depois.
- Vem com modelos prontos das objeções mais comuns em loja de motos ("tá caro", "vou pensar", "nome
  negativado", "sem entrada", "aceita troca", "qual a parcela", "tem garantia"…). Eles entram como
  **para revisar**, para ninguém mandar regra que a loja não pratica.
- **Aprendizado** a cada rodada do cron:
  - mensagens dos clientes que batem com um item somam ocorrências e viram exemplos;
  - as que parecem dúvida ou objeção e não batem com nada são agrupadas (pela IA, ou por regra sem a IA)
    em itens novos **para revisar**;
  - o rascunho da resposta parte do que o vendedor de fato respondeu naquela conversa.
- Aba **Conhecimento** no Assistente: para revisar, base ativa, ranking das dúvidas e objeções da semana,
  e quais respostas mais fazem o lead avançar.

**Fase 2 — Atendimento inteligente**
- O robô responde dúvidas no meio do roteiro **com a resposta aprovada** e volta para a pergunta em que parou.
- **Nota do lead (0–100)** por sinais: origem, forma de pagamento, entrada, urgência, perguntas de compra,
  rapidez nas respostas. Aparece nas conversas e no card do CRM.
- **Sugestões na própria conversa:** respostas da base para a última mensagem do cliente (na hora, sem IA)
  e "gerar com IA", que usa a base, o estoque e o histórico. Um clique leva a sugestão para a caixa de
  resposta; o uso conta para o ranking.

**Fase 3 — Vitrine do estoque**
- Estoque mais completo: km, versão, cilindrada, destaques, ficha técnica e fotos (comprimidas, guardadas
  pelo sistema), vídeo por link e preço opcional (só mostrado se a loja ligar e nunca passa pela IA).
- O robô responde "tem a XRE 300?" com a ficha e a foto, ou com opções parecidas quando não tem.
- Botão **Enviar moto** na conversa: ficha + fotos em um clique.

**Fase 4 — Jornada: etiquetas + avanço automático**
- Etiquetas automáticas no lead: quente, financiamento, à vista, tem troca, sem entrada, pediu simulação,
  objeção de preço, pediu visita, sumiu há 24h.
- Avanço conservador e reversível, com aviso ao vendedor no chat "Você" ("Movi o Ruan para Negociação:
  pediu simulação"):
  - Lead → Abordado: o vendedor respondeu;
  - Abordado → Negociação: sinal de compra (simulação, parcela, documentos, visita) ou nota alta;
  - Negociação → Proposta: só com sinal forte do vendedor (enviou proposta).

**Fase 5 — Follow automático com mídia**
- Cadências por etapa: por exemplo, 1 dia sem resposta → lembrete leve; 3 dias → foto ou vídeo da moto de
  interesse; 7 dias → última mensagem. Texto, foto e link de vídeo saem do estoque e da base.
- Segurança: só para quem chamou primeiro; 1 mensagem automática por dia por lead; teto diário por número;
  só das 9h às 19h de segunda a sábado; para quando o lead responde ou pede para parar.
- **Começa desligado**, para o dono revisar as mensagens antes de ligar.

**Fase 6 — Assistente pessoal do vendedor no WhatsApp**
- Perguntas livres no chat "Você": "como estou hoje?", "quem está esperando?", "minha conversão da semana",
  "ficha da XRE", "o que respondo para 'tá caro'?". Os números saem do sistema; valores em reais são
  montados por modelo pronto, fora da IA.
- Alerta de lead esperando (ex.: 10 min sem resposta) e resumo da manhã.

## 6. Decisões já tomadas (padrões, ajustáveis depois)
- Itens aprendidos e modelos prontos precisam de aprovação antes de o robô usá-los.
- Preço no WhatsApp desligado por padrão.
- Follow automático desligado por padrão.
- Avanço automático de etapa ligado, conservador e com "desfazer".
- Fotos comprimidas no próprio sistema; vídeos por link (YouTube, Instagram, Drive) enquanto não houver
  armazenamento de objetos.
