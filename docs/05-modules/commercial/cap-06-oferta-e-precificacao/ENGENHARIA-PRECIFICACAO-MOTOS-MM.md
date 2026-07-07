---
id: DOC-COM-CAP06-PRECIFICACAO-MOTOS
titulo: "Engenharia Estratégica de Precificação — MM Negócios Veículos"
versao: "1.0.0"
status: aprovado
categoria: Commercial-OS-Module
autor: Especialista em Engenharia Financeira, Pricing e Controladoria
criado-em: 2026-07-07
atualizado-em: 2026-07-07
dependencias:
  - MOD-CAP-06
tags: [precificacao, pricing, motos, mm-negocios, lucro-presumido, margens, financeiro, controladoria, bi]
relacionamentos:
  implementa: MOD-CAP-06
  planilha: "./planilha-precificacao/MM-Negocios-Precificacao-Motos.xlsx"
---

# ENGENHARIA ESTRATÉGICA DE PRECIFICAÇÃO — MM NEGÓCIOS VEÍCULOS

> **Como ler este documento**
> Este é o manual de engenharia financeira de precificação da MM Negócios Veículos.
> Ele não é uma planilha — é o **raciocínio completo** por trás da planilha
> (`planilha-precificacao/MM-Negocios-Precificacao-Motos.xlsx`, entregue junto a este documento).
> Cada fórmula aqui descrita é implementada, célula a célula, naquele arquivo.
> Este documento responde três perguntas para cada conceito: **o que é**, **por que existe**
> e **como decidir com ele**.
>
> Um único exemplo numérico (a "Moto-Modelo") atravessa todo o documento, para que cada
> fórmula possa ser conferida manualmente, sem depender da planilha.

---

## SUMÁRIO

0. [Princípio Central e Moto-Modelo de Referência](#0-princípio-central-e-moto-modelo-de-referência)
1. [Pilar 1 — Ganho na Compra](#pilar-1--ganho-na-compra)
2. [Pilar 2 — Lucro Presumido (LP)](#pilar-2--lucro-presumido-lp)
3. [Pilar 3 — Construção das Margens](#pilar-3--construção-das-margens)
4. [Pilar 4 — Competitividade](#pilar-4--competitividade)
5. [Pilar 5 — Saúde do Estoque](#pilar-5--saúde-do-estoque)
6. [Pilar 6 — Negociação Controlada](#pilar-6--negociação-controlada)
7. [Pilar 7 — Performance Comercial](#pilar-7--performance-comercial)
8. [Pilar 8 — Custos Basilares](#pilar-8--custos-basilares)
9. [Pilar 9 — Governança](#pilar-9--governança)
10. [Pilar 10 — Precificação Dinâmica](#pilar-10--precificação-dinâmica)
11. [Engenharia Matemática Consolidada (a cadeia completa)](#11-engenharia-matemática-consolidada)
12. [Engenharia de Planilha](#12-engenharia-de-planilha)
13. [Dashboard Executivo](#13-dashboard-executivo)
14. [Glossário de Variáveis](#14-glossário-de-variáveis)
15. [Erros Comuns e Boas Práticas](#15-erros-comuns-e-boas-práticas)
16. [Objetivo Final](#16-objetivo-final)

---

## 0. PRINCÍPIO CENTRAL E MOTO-MODELO DE REFERÊNCIA

### 0.1 O princípio

> **"O lucro começa na compra."**

Toda a engenharia deste documento decorre de uma única consequência prática desse princípio:
**o preço de venda não é uma opinião — é o resultado de uma equação.** Se a equação estiver
certa, qualquer vendedor, em qualquer loja, em qualquer dia, chega ao mesmo piso de
lucro mínimo. A negociação passa a ser sobre **quanto acima do piso** a empresa consegue
capturar — nunca sobre **se o piso será respeitado**.

Isso muda a pergunta que a empresa faz todos os dias, de:

> "Quanto eu quero ganhar nessa moto?"

para:

> "Qual é o preço mínimo que garante que a empresa não perdeu dinheiro com essa moto,
> e qual é o preço máximo que o mercado aceita pagar por ela hoje?"

Toda a engenharia matemática deste documento existe para responder essas duas perguntas
com números, não com sensação.

### 0.2 A Moto-Modelo de referência

Para que cada fórmula deste manual possa ser conferida manualmente (sem abrir a planilha),
todos os exemplos numéricos usam a mesma motocicleta fictícia:

| Campo | Valor |
|---|---|
| Modelo | Honda CG 160 Titan 2022, seminova |
| Quilometragem | 8.200 km |
| Valor de compra | **R$ 9.500,00** |
| Custos diretos (revisão + estética + documentação) | **R$ 450,00** |
| Dias de estoque considerados na precificação inicial (meta de giro) | **45 dias** |
| Taxa de custo financeiro (custo de capital) | **2,0% ao mês** |
| Custo operacional rateado por unidade | **R$ 180,00** |
| Impostos efetivos sobre a venda | **6,0%** |
| Comissão padrão do vendedor | **3,0%** |
| Marketing provisionado | **2,5%** |
| Reserva financeira (contingência) | **2,0%** |
| Margem Estratégica | **25%** |
| Margem Comercial | **16%** |
| Margem de Negociação | **9%** |
| Margem do LP | **4%** |

Todos os percentuais acima são **parâmetros**, não constantes — vivem na aba `00-Parametros`
da planilha e podem (devem) ser recalibrados pela diretoria conforme o mercado muda. Os
valores acima são apenas o cenário de referência usado neste manual.

---

## PILAR 1 — GANHO NA COMPRA

### 1.1 Por que este pilar existe

Nenhuma fórmula de precificação, por mais sofisticada, recupera uma compra malfeita.
Se a moto foi comprada acima do valor de mercado, todo o restante da engenharia — margens,
negociação, dinâmica de estoque — está apenas administrando um prejuízo já nascido. Por
isso o Pilar 1 não é sobre "quanto vender", é sobre **quanto pagar**.

### 1.2 Preço Máximo de Compra (PMC)

O Preço Máximo de Compra é o valor mais alto que a empresa pode pagar por uma motocicleta
e ainda assim conseguir formar um Preço Comercial competitivo, respeitando a Margem Comercial
mínima.

**Fórmula (por inversão da fórmula do divisor, ver Seção 11):**

```
PMC = (Preço de Mercado Estimado × Divisor Comercial) − (Custos Diretos + Custo Financeiro Provisionado + Custo Operacional Rateado)

onde:
Divisor Comercial = 1 − (%Impostos + %Comissão + %Marketing + %Reserva + %Margem Comercial)
```

**Aplicação com a Moto-Modelo:**
Se o preço médio de mercado para uma CG 160 Titan 2022 nessa quilometragem é **R$ 14.700**,
e o Divisor Comercial é `1 − (0,06+0,03+0,025+0,02+0,16) = 0,705`:

```
PMC = (14.700 × 0,705) − (450 + 285 + 180)
PMC = 10.363,50 − 915
PMC = R$ 9.448,50
```

Ou seja: **acima de R$ 9.448,50, essa compra específica não sustenta a Margem Comercial
padrão** — a empresa teria que vender no Preço Estratégico (pouco competitivo) ou operar
abaixo da margem-alvo. Comprar a R$ 9.500 (nosso cenário) já está **R$ 51,50 acima do teto
ideal** — um sinal de atenção, não de bloqueio, tratado no indicador de Risco da Aquisição
(1.4).

### 1.3 Potencial de Valorização

Mede quanto uma motocicleta específica tende a performar acima da média de mercado da sua
categoria, por raridade, procura ou estado de conservação.

```
Potencial de Valorização (%) = (Preço Médio de Anúncios Ativos Comparáveis ÷ Preço Médio Histórico de Venda da Categoria) − 1
```

- **Uso:** ao decidir entre duas motos concorrentes para compra com o mesmo capital
  disponível, prioriza-se a de maior Potencial de Valorização.
- **Interpretação:** valores > 10% indicam categoria aquecida (justifica pagar próximo ao
  teto do PMC); valores negativos indicam categoria em queda (exige compra abaixo do PMC
  para compensar o risco).

### 1.4 Risco da Aquisição (Índice Composto)

```
Índice de Risco da Aquisição = w1×(Valor Compra ÷ PMC) + w2×(1 ÷ Liquidez da Categoria) + w3×(Km ÷ Km Médio da Categoria)
```

com pesos padrão `w1=0,5 | w2=0,3 | w3=0,2` (parametrizáveis). Resultado:

| Faixa do Índice | Classificação | Ação recomendada |
|---|---|---|
| ≤ 0,90 | Compra Segura | Seguir para precificação normal |
| 0,91 – 1,05 | Compra Aceitável | Precificar e monitorar giro nos primeiros 30 dias |
| 1,06 – 1,20 | Compra de Atenção | Reduzir imediatamente para Margem Comercial (pular a fase Estratégica) |
| > 1,20 | Compra de Risco | Exige aprovação da diretoria antes de entrar no estoque |

**Por que existe:** transforma "essa compra foi boa?" — uma pergunta emocional respondida
depois do fato — em um número calculado **no ato da compra**, quando ainda há tempo de
negociar o valor pago ou recusar o negócio.

### 1.5 Margem Esperada na Compra

```
Margem Esperada = (Preço Comercial Estimado − Valor de Compra) ÷ Preço Comercial Estimado
```

Usada como **critério de decisão de compra**: a MM Negócios não compra motos cuja Margem
Esperada projetada seja inferior à Margem de Negociação (piso operacional definido no
Pilar 3) — abaixo disso, a compra já nasce sem espaço de negociação.

---

## PILAR 2 — LUCRO PRESUMIDO (LP)

### 2.1 Definição

O **Lucro Presumido (LP)** é a margem líquida mínima aceitável em qualquer venda. Ele
representa o ponto em que **todas** as camadas de desconto comercial já foram consumidas e,
mesmo assim, a operação continua sustentável — paga impostos, comissão, marketing, custo
financeiro e ainda sobra lucro líquido positivo.

O LP **não é zero a zero**. Se fosse zero, qualquer imprevisto (atraso na venda, retrabalho
mecânico, oscilação de mercado) transformaria a venda em prejuízo. Por isso o LP embute uma
margem líquida mínima de sobrevivência (no cenário de referência, **4%** sobre o preço de
venda).

### 2.2 Fórmula matemática do LP

O LP usa exatamente a mesma mecânica de todos os preços da casa — o **método do divisor**
(detalhado na Seção 11) — variando apenas o percentual de margem, que passa a ser o menor
de todos:

```
Divisor LP = 1 − (%Impostos + %Comissão + %Marketing + %Reserva + %Margem LP)

LP (preço mínimo de venda) = Custo Base ÷ Divisor LP

onde:
Custo Base = Valor de Compra + Custos Diretos + Custo Financeiro Provisionado + Custo Operacional Rateado
```

**Aplicação com a Moto-Modelo:**

```
Custo Base = 9.500 + 450 + 285 + 180 = R$ 10.415,00
Divisor LP = 1 − (0,06 + 0,03 + 0,025 + 0,02 + 0,04) = 0,825
LP = 10.415 ÷ 0,825 = R$ 12.624,24
```

Abaixo de **R$ 12.624,24**, esta motocicleta específica não pode ser vendida — nenhum
vendedor, em nenhuma circunstância, sem aprovação formal de diretoria com justificativa
registrada (Pilar 9).

### 2.3 Por que o LP protege a empresa

O Lucro Líquido embutido no LP é:

```
Lucro Líquido no LP = LP × %Margem LP = 12.624,24 × 0,04 = R$ 504,97
```

Esse valor cobre exatamente o que o nome promete: um lucro **presumido**, isto é, garantido
matematicamente antes mesmo de a moto ser vendida — desde que o preço de venda não fique
abaixo do LP. Ele NÃO cobre despesas fixas gerais acima do rateio já embutido no Custo
Operacional (ver Pilar 8) — por isso o LP é o mínimo aceitável, não o alvo.

### 2.4 O LP como "linha vermelha"

| Situação | Interpretação |
|---|---|
| Venda ≥ Preço Comercial | Operação saudável, meta batida |
| Preço Comercial > Venda ≥ Preço de Negociação | Negociação normal, margem reduzida mas positiva |
| Preço de Negociação > Venda ≥ LP | Zona de atenção — negociação levada ao limite |
| Venda < LP | **Não permitido sem exceção formal.** Cada venda abaixo do LP é registrada como
  não-conformidade na aba `12-Governanca-Historico` e exige justificativa (Pilar 9). |

---

## PILAR 3 — CONSTRUÇÃO DAS MARGENS

### 3.1 A lógica das camadas

Cada motocicleta, ao ser precificada, recebe **quatro preços simultâneos**, não um preço
único. Essas quatro camadas formam um "corredor de negociação" com limites claros: o
vendedor negocia dentro do corredor, nunca fora dele.

```
Preço Estratégico  (margem máxima)
        │
Preço Comercial    (margem padrão — onde a maioria das vendas deve acontecer)
        │
Preço de Negociação (margem mínima de negociação — última concessão autorizada ao vendedor)
        │
LP                 (margem de proteção — só com aprovação formal)
```

### 3.2 Fórmula geral de cada camada

Todas as quatro camadas usam a mesma fórmula (método do divisor — Seção 11), variando
apenas `%Margem`:

```
Preço(camada) = Custo Base ÷ [1 − (%Impostos + %Comissão + %Marketing + %Reserva + %Margem(camada))]
```

### 3.3 Tabela consolidada — Moto-Modelo

| Camada | % Margem | Divisor | Preço | Lucro Líquido Presumido |
|---|---|---|---|---|
| **Margem Estratégica** | 25% | 0,615 | **R$ 16.934,96** | R$ 4.233,74 |
| **Margem Comercial** | 16% | 0,705 | **R$ 14.773,05** | R$ 2.363,69 |
| **Margem de Negociação** | 9% | 0,775 | **R$ 13.438,71** | R$ 1.209,48 |
| **LP** | 4% | 0,825 | **R$ 12.624,24** | R$ 504,97 |

*(Custo Base = R$ 10.415,00 em todas as linhas — ver Seção 2.2)*

### 3.4 Função estratégica de cada margem

**Margem Estratégica** — usada em: motos de alta procura, baixa concorrência local, produto
exclusivo/raro, primeiros 30 dias de estoque (Pilar 10, Fase 1). Objetivo: capturar o
máximo de lucro possível enquanto a moto ainda tem "novidade" no anúncio.

**Margem Comercial** — é o **preço-padrão da casa**. Todo anúncio público, toda tabela
publicada, todo vendedor abre a conversa por aqui. A meta de faturamento da empresa é
calculada assumindo que a maior parte do volume de vendas acontece nesta camada — por isso
o KPI de "% de vendas no preço comercial ou acima" (Pilar 7) é o principal termômetro de
saúde comercial.

**Margem de Negociação** — é a margem de **fechamento**, não de abertura. Existe para
destravar vendas com clientes decididos mas sensíveis a preço, sem sacrificar a
sustentabilidade da operação. Ainda gera lucro líquido confortável (R$ 1.209,48 no exemplo).

**LP** — não é margem comercial, é margem de **sobrevivência**. Só é usada em cenários
excepcionais e documentados: giro de estoque crítico (Pilar 10, Fase 4), erro de compra já
consumado, necessidade extrema de caixa. Toda venda no LP gera automaticamente uma entrada
na trilha de auditoria (Pilar 9).

---

## PILAR 4 — COMPETITIVIDADE

### 4.1 O paradoxo do preço

Preço alto reduz giro. Preço baixo destrói margem. A engenharia de competitividade existe
para responder, com dados, à pergunta certa:

> "Quanto o mercado aceita pagar, mantendo nossa margem saudável?" — e não "quanto eu quero
> ganhar?".

### 4.2 Índice de Competitividade de Preço (ICP)

```
ICP = Preço Praticado (Comercial) ÷ Preço Médio de Mercado (concorrentes diretos comparáveis)
```

| Faixa do ICP | Leitura |
|---|---|
| < 0,95 | Moto abaixo do mercado — risco de estar "deixando dinheiro na mesa" |
| 0,95 – 1,05 | Preço alinhado ao mercado — zona saudável |
| > 1,05 | Moto acima do mercado — exige justificativa (raridade, estado, km) ou revisão |

**Como usar:** o ICP é recalculado a cada atualização de tabela de preços de concorrentes
(insumo do Pilar 1 de inteligência comercial). Ele **não substitui** a fórmula do divisor —
ele é o teto de realismo aplicado sobre o preço calculado. Se o Preço Comercial calculado
gera ICP > 1,10, a empresa tem duas opções documentadas: (a) reduzir margem para a próxima
camada (Negociação) já na publicação, ou (b) manter o preço e aceitar giro mais lento,
registrando a decisão.

### 4.3 Elasticidade-Preço da Demanda (por categoria)

```
Elasticidade = (%Δ Quantidade Vendida) ÷ (%Δ Preço Médio Praticado)
```

- **|Elasticidade| > 1** → categoria elástica: pequenas reduções de preço geram grandes
  ganhos de volume (ex.: motos de entrada, alta concorrência). Prioriza-se giro.
- **|Elasticidade| < 1** → categoria inelástica: preço tem pouco efeito sobre o volume
  (ex.: motos raras, nicho). Prioriza-se margem.

### 4.4 Índice de Liquidez de Estoque por Categoria

```
Liquidez da Categoria = Unidades Vendidas da Categoria no Período ÷ Estoque Médio da Categoria no Período
```

Quanto maior, mais rápido a categoria gira — isso **calibra os pesos do Índice de Saúde do
Estoque** (Pilar 5) e o Índice de Risco da Aquisição (Pilar 1.4).

### 4.5 Índice de Valor Percebido

```
IVP = (Nº de Leads Gerados ÷ Dias em Anúncio) ÷ Média de (Leads ÷ Dias) da Categoria
```

Mede se uma moto específica está performando acima ou abaixo do esperado para sua
categoria **independentemente do preço** — sinal de que o anúncio, fotos ou descrição
precisam de revisão (IVP baixo com preço competitivo = problema de percepção, não de preço).

### 4.6 Tempo Médio em Estoque por Categoria

```
TME (categoria) = Σ(Dias em Estoque até a Venda) ÷ Nº de Motos Vendidas da Categoria
```

Usado como referência para calibrar a **Matriz de Evolução da Precificação Dinâmica**
(Pilar 10) — categorias com TME historicamente baixo podem ter fases mais curtas; categorias
de giro lento justificam fases mais longas antes de reduzir margem.

---

## PILAR 5 — SAÚDE DO ESTOQUE

### 5.1 Por que classificar o estoque

Preço não é a única alavanca de uma motocicleta parada — a **estratégia** muda conforme o
tempo em estoque. Classificar cada unidade permite que a diretoria veja, em um único
relatório, onde está o risco de capital parado antes que ele vire prejuízo.

### 5.2 Classificações e critério simples (baseado em dias)

| Classificação | Critério (dias em estoque) | Estratégia |
|---|---|---|
| **Estoque Premium** | ≤ 20 dias | Margem Estratégica, sem desconto |
| **Estoque Saudável** | 21 – 45 dias | Margem Comercial, competitividade normal |
| **Estoque Atenção** | 46 – 75 dias | Margem de Negociação liberada, campanha ativa |
| **Estoque Crítico** | > 75 dias | Revisão gerencial obrigatória (Pilar 10, Fase 4) |

Este critério simples é o que roda automaticamente na planilha (aba `07-Estoque-Dinamica`),
porque é objetivo, auditável e não depende de dados subjetivos.

### 5.3 Critério avançado — Índice de Saúde do Estoque (ISE)

Para diretorias que já possuem dados de liquidez por categoria e desempenho de anúncio,
recomenda-se complementar o critério simples com um **score ponderado**:

```
ISE = w1×(1 − Dias em Estoque ÷ Dias Máximo de Referência da Categoria)
    + w2×(Liquidez da Categoria normalizada 0–1)
    + w3×(IVP normalizado 0–1)

pesos padrão: w1 = 0,5 | w2 = 0,3 | w3 = 0,2
```

| Faixa do ISE | Classificação |
|---|---|
| ≥ 0,75 | Estoque Premium |
| 0,50 – 0,74 | Estoque Saudável |
| 0,25 – 0,49 | Estoque Atenção |
| < 0,25 | Estoque Crítico |

**Quando usar cada um:** o critério simples (5.2) é o **padrão operacional diário** —
roda sozinho, sem input manual. O ISE (5.3) é usado na **revisão gerencial mensal**, quando
a diretoria quer entender *por que* uma moto está patinando (tempo vs. mercado vs. anúncio),
não apenas *que* está patinando.

### 5.4 Capital Parado por Classificação

```
Capital Parado = Σ (Valor de Compra de cada moto na classificação)
```

Reportado por classificação no Dashboard (Pilar 13) — o número que mais importa para o CFO:
quanto capital da empresa está imobilizado em estoque "Crítico" agora.

---

## PILAR 6 — NEGOCIAÇÃO CONTROLADA

### 6.1 O que o vendedor recebe

Nenhum vendedor recebe "o preço da moto". Ele recebe **três preços de venda mais o piso**,
gerados automaticamente pela aba `06-Precificacao`:

1. **Preço Estratégico** — ponto de partida da conversa (âncora alta).
2. **Preço Comercial** — preço-alvo da negociação, o que aparece no anúncio.
3. **Preço de Negociação** — última concessão que o vendedor pode dar **sem aprovação**.
4. **LP** — nunca mostrado ao cliente; é o piso absoluto de sistema. Vender abaixo dele
   exige aprovação registrada (Pilar 9), nunca é uma decisão unilateral do vendedor.

### 6.2 Regra de ouro

```
SE Preço Proposto < LP:
    Venda bloqueada no sistema → Requer Solicitação de Aprovação (nível N3, ver Pilar 9)
SENÃO SE Preço Proposto < Preço de Negociação:
    Venda permitida, mas registrada como "desconto máximo atingido" → alerta de monitoramento
SENÃO:
    Venda permitida sem restrição
```

### 6.3 Por que separar negociação de precificação

Separar "quem calcula o preço" (o sistema, via Custo Base + margens) de "quem negocia o
preço" (o vendedor, dentro do corredor liberado) é o que permite medir, depois, **a
qualidade da negociação isoladamente da qualidade da precificação** — é essa separação que
alimenta todos os indicadores do Pilar 7.

---

## PILAR 7 — PERFORMANCE COMERCIAL

### 7.1 Por que medir o vendedor, não só a venda

Duas vendas do mesmo valor podem ter qualidades completamente diferentes: uma foi vendida
no Preço Comercial sem desconto, outra foi arrastada até o LP. Sem indicadores por
vendedor, as duas parecem idênticas no caixa — mas são o oposto uma da outra em disciplina
comercial.

### 7.2 Indicadores e fórmulas

| Indicador | Fórmula | O que revela |
|---|---|---|
| **Desconto Médio Concedido (%)** | `Média [(Preço Comercial − Preço Vendido) ÷ Preço Comercial]` por vendedor | Quem cede mais margem por hábito |
| **Margem Líquida Média Realizada (%)** | `Média (Lucro Líquido Real ÷ Preço Vendido)` por vendedor | Quem realmente protege lucro, não só fecha venda |
| **Lucro Total Entregue (R$)** | `Σ Lucro Líquido Real` das vendas do vendedor no período | Contribuição absoluta ao caixa da empresa |
| **Ticket Médio (R$)** | `Σ Preço Vendido ÷ Nº de Vendas` do vendedor | Perfil de produto que o vendedor mais fecha |
| **% de Vendas no Preço Cheio** | `Nº vendas ≥ Preço Comercial ÷ Nº total de vendas` | Capacidade de vender sem depender de desconto |
| **% de Vendas no Piso (LP ou próximo)** | `Nº vendas com Preço Vendido ≤ Preço de Negociação ÷ Nº total` | Sinal de vendedor "liquidador", não negociador |
| **Ranking Financeiro** | `RANK(Lucro Total Entregue)` entre todos os vendedores | Quem entrega mais resultado em R$ |
| **Ranking Comercial** | `RANK(Nº de Vendas no período)` entre todos os vendedores | Quem gira mais volume |

### 7.3 Como ler os dois rankings juntos

| Perfil | Ranking Financeiro | Ranking Comercial | Leitura |
|---|---|---|---|
| A | Alto | Alto | Vendedor de elite — vende muito e protege margem |
| B | Alto | Baixo | Vende pouco, mas com excelente margem — foco em produtos de maior valor |
| C | Baixo | Alto | Vende muito, mas com desconto excessivo — **candidato a treinamento de negociação de valor**, não a demissão |
| D | Baixo | Baixo | Requer plano de ação imediato — volume e margem comprometidos |

O objetivo do Pilar 7 nunca é punir — é **direcionar treinamento e reconhecimento com
precisão**, em vez de decisão por impressão do gestor.

---

## PILAR 8 — CUSTOS BASILARES

Toda motocicleta, antes de receber qualquer preço, precisa ter seu **Custo Base** e seus
**percentuais variáveis** completamente apurados. Nenhuma fórmula de margem entra em vigor
sem essas fórmulas resolvidas primeiro.

### 8.1 Custo de Compra

```
Custo de Compra = Valor pago pela motocicleta (nota fiscal / recibo de compra)
```

### 8.2 Custos de Preparação (Diretos)

```
Custos Diretos = Revisão + Estética + Documentação + Frete + Combustível + Acessórios + Outros
```

Cada componente é lançado individualmente na aba `02-Custos-Diretos` — nunca como valor
único estimado — para permitir auditoria item a item.

### 8.3 Custo Financeiro (custo de capital)

O capital usado para comprar a moto tem custo, esteja ele parado em caixa próprio (custo de
oportunidade) ou financiado (juros de capital de giro). Ambos são cobrados **contra a
própria moto**, proporcional ao tempo que ela permanece em estoque:

```
Custo Financeiro Provisionado = Valor de Compra × Taxa Financeira Mensal × (Dias de Estoque Meta ÷ 30)
```

No momento da precificação (antes de vender), usa-se **Dias de Estoque Meta** (giro médio
esperado, parâmetro da empresa — 45 dias no cenário de referência). Depois de vendida, a
aba `05-Financeiro` recalcula o valor **real**, usando os dias reais em estoque:

```
Custo Financeiro Real = Valor de Compra × Taxa Financeira Mensal × (Dias Reais em Estoque ÷ 30)
```

Essa diferença entre provisionado e real é o que permite medir se a empresa está girando
o estoque mais rápido ou mais devagar do que o planejado (KPI de Precisão de Giro, 8.13).

### 8.4 Custo de Oportunidade

Separado do custo financeiro quando a empresa usa capital próprio: representa o retorno que
esse mesmo capital teria em uma aplicação alternativa (renda fixa, outro investimento).

```
Custo de Oportunidade = Valor de Compra × Taxa de Oportunidade Mensal × (Dias em Estoque ÷ 30)
```

**Uso:** reportado como métrica gerencial (não soma ao Custo Base para não duplicar com o
custo financeiro) — usado pela diretoria para decidir se vale mais investir em giro de
estoque ou em outra frente de capital.

### 8.5 Custo Operacional Rateado

Despesas fixas da empresa (aluguel, folha administrativa, energia, sistemas, tributos
administrativos) não pertencem a nenhuma moto específica — mas precisam ser cobertas por
todas elas, coletivamente.

```
Custo Operacional Rateado por Unidade = Total de Despesas Operacionais Fixas do Mês ÷ Nº Médio de Motos Vendidas por Mês
```

Esse valor entra no Custo Base de cada moto (Seção 11) como um valor fixo em R$, revisado
mensalmente na aba `00-Parametros`.

### 8.6 Marketing (ROAS, CAC, CPL, CPC)

**Verba provisionada** (usada na precificação, antes da venda):
```
Marketing Provisionado (%) = parâmetro definido pela empresa, aplicado sobre o preço final (método do divisor)
```

**Indicadores reais** (apurados depois, por moto ou por campanha, aba `03-Marketing`):

```
CPL (Custo por Lead) = Verba Investida ÷ Nº de Leads Gerados
CPC (Custo por Clique) = Verba Investida ÷ Nº de Cliques
CAC (Custo de Aquisição de Cliente) = Verba Investida ÷ Nº de Vendas Atribuídas à Campanha
ROAS (Retorno sobre Investimento em Anúncios) = Receita Gerada pela Campanha ÷ Verba Investida
```

**Como interpretar o ROAS:** ROAS de 8 significa que cada R$1 investido em anúncio gerou
R$8 em receita de vendas atribuídas — não é lucro, é receita bruta. Para saber se o
marketing está de fato lucrativo, cruza-se o CAC com o Lucro Líquido médio por venda:

```
Marketing é lucrativo SE: Lucro Líquido Médio por Venda > CAC
```

### 8.7 Comissões e Bonificações

```
Comissão = Preço Vendido × %Comissão do Vendedor (padrão ou por faixa, tabela em 04-Comercial)
Bonificação = valor fixo ou percentual adicional, condicionado a metas (ex.: bônus por venda no Preço Comercial ou acima)
```

**Por que a comissão é % sobre o preço, não sobre o lucro:** simplicidade operacional e
alinhamento de incentivo — o vendedor ganha mais vendendo mais caro, o que empurra o
comportamento na direção certa (defender margem) sem exigir que ele veja o Custo Base da
empresa.

### 8.8 Impostos

```
Impostos Efetivos (%) = alíquota efetiva aplicável ao regime tributário da empresa sobre a operação de revenda de veículo
```

Tratado como percentual único no motor de precificação (parâmetro configurável), pois o
regime de apuração (ex.: tributação sobre a diferença entre compra e venda, comum em
revenda de veículos usados) já é resolvido pela controladoria antes de alimentar o parâmetro.

### 8.9 Capital Investido e Capital Parado

```
Capital Investido (total, por período) = Σ Valor de Compra de todas as motos em estoque no período
Capital Parado = Σ Valor de Compra das motos com classificação "Atenção" ou "Crítico" (Pilar 5)
```

### 8.10 Fluxo de Caixa por Moto

```
Fluxo de Caixa da Moto = − Valor de Compra (saída, na compra)
                         − Custos Diretos (saída, na preparação)
                         + Preço Vendido (entrada, na venda)
                         − Comissão − Impostos − Marketing Real (saídas, na venda)
```

Usado para consolidar o **Fluxo de Caixa do Estoque** no Dashboard — soma de todas as
motos, por mês.

### 8.11 Depreciação (motos não vendidas)

Para motos que permanecem em estoque além da Fase 3 (> 90 dias, Pilar 10), aplica-se uma
depreciação de referência de mercado, monitorada (não automática no preço):

```
Depreciação Estimada = Valor de Compra × Taxa de Depreciação Mensal da Categoria × (Meses em Estoque acima de 90 dias)
```

Serve de alerta para a revisão gerencial obrigatória da Fase 4 — não reduz o LP
automaticamente, pois qualquer redução do LP exige aprovação formal (Pilar 9).

### 8.12 ROI e Retorno sobre Capital Investido

```
ROI da Moto = Lucro Líquido Real ÷ (Valor de Compra + Custos Diretos)
ROI Anualizado = ROI da Moto × (365 ÷ Dias Reais em Estoque)
```

**Por que anualizar:** um ROI de 12% em 20 dias é muito superior a um ROI de 12% em 100
dias — anualizar torna motos de giro diferente comparáveis na mesma régua, essencial para
decidir onde reinvestir o capital que volta ao caixa.

### 8.13 KPI de Precisão de Giro

```
Precisão de Giro = Dias de Estoque Meta ÷ Dias Reais em Estoque
```

- **= 1,0** → a moto girou exatamente no prazo planejado (custo financeiro provisionado
  bateu com o real).
- **< 1,0** → girou mais devagar que o planejado (custo financeiro real maior que o
  provisionado — a margem real ficou menor que a margem presumida).
- **> 1,0** → girou mais rápido (margem real melhor que a presumida).

---

## PILAR 9 — GOVERNANÇA

### 9.1 Princípio

Nenhuma alteração de preço acontece por impulso. Toda alteração responde, por escrito, a
perguntas objetivas — se nenhuma resposta justificar a mudança, o preço permanece como está.

### 9.2 Perguntas obrigatórias antes de qualquer redução de preço

1. Qual o motivo da alteração?
2. Qual margem será utilizada a partir de agora (Estratégica / Comercial / Negociação / LP)?
3. Qual o impacto financeiro estimado (R$ de margem cedida)?
4. Qual o prazo/duração dessa alteração (campanha pontual ou reposicionamento definitivo)?
5. A motocicleta perdeu competitividade (ICP subiu)?
6. O estoque envelheceu (Pilar 10)?
7. O mercado reduziu o preço médio da categoria?

### 9.3 Matriz de Aprovação

| Nível | Faixa de preço | Quem aprova | Registro obrigatório | Prazo de aprovação |
|---|---|---|---|---|
| N0 | ≥ Preço Comercial | Vendedor | Não | Imediato |
| N1 | Preço Comercial → Preço de Negociação | Vendedor | Não (monitorado por KPI) | Imediato |
| N2 | Preço de Negociação → LP | Gestor Comercial | Sim | 24 horas |
| N3 | < LP | Diretoria | Sim, com justificativa obrigatória | 48 horas |

### 9.4 Histórico e Versionamento

Toda motocicleta mantém, na aba `12-Governanca-Historico`, um registro imutável de cada
alteração de preço:

```
Registro = {Data, ID da Moto, Preço Anterior, Preço Novo, Motivo, Margem Utilizada, Solicitante, Aprovador, Nível de Aprovação}
```

**Regra de auditoria:** o preço vigente de qualquer moto deve sempre ser reconstruível a
partir do histórico — se o histórico não explica o preço atual, há uma falha de governança
a ser corrigida antes de qualquer nova venda.

### 9.5 Quem pode alterar o quê

| Ação | Papel autorizado |
|---|---|
| Alterar Custo Base (custos diretos, compra) | Financeiro/Controladoria |
| Alterar parâmetros globais (%margens, %impostos, taxas) | Diretoria |
| Conceder desconto dentro do corredor N0/N1 | Vendedor |
| Aprovar desconto N2 | Gestor Comercial |
| Aprovar desconto N3 (abaixo do LP) | Diretoria |
| Descontinuar/reclassificar estoque crítico | Gestor Comercial + Diretoria |

---

## PILAR 10 — PRECIFICAÇÃO DINÂMICA

### 10.1 Princípio: o preço não envelhece, o estoque envelhece

A cada dia que uma moto permanece parada, ela consome capital, espaço físico e atenção
comercial. A precificação dinâmica administra esse envelhecimento de forma planejada — nunca
por reação de última hora à pressão de um cliente.

### 10.2 Matriz de Evolução

| Fase | Dias em Estoque | Margem Prioritária | Preço Sugerido | Objetivo |
|---|---|---|---|---|
| **Fase 1 — Lançamento** | 0 – 30 | Margem Estratégica | Preço Estratégico | Maximizar lucro enquanto há novidade |
| **Fase 2 — Consolidação** | 31 – 60 | Margem Comercial | Preço Comercial | Equilibrar margem e velocidade |
| **Fase 3 — Aceleração de Giro** | 61 – 90 | Margem de Negociação | Preço de Negociação | Converter estoque em caixa |
| **Fase 4 — Estoque Envelhecido** | > 90 | Revisão Gerencial | Revisão obrigatória (nunca abaixo do LP sem N3) | Proteger o caixa, liberar capital |

### 10.3 Regra automática (o que a planilha faz sozinha)

```
SE Dias em Estoque ≤ 30:  Preço Sugerido = Preço Estratégico
SE Dias em Estoque ENTRE 31 e 60:  Preço Sugerido = Preço Comercial
SE Dias em Estoque ENTRE 61 e 90:  Preço Sugerido = Preço de Negociação
SE Dias em Estoque > 90:  Preço Sugerido = Preço de Negociação, com FLAG "Revisão Gerencial Obrigatória"
```

Em nenhuma fase o Preço Sugerido é calculado abaixo do LP — a Fase 4 aciona um alerta para
decisão humana (Pilar 9), nunca reduz preço automaticamente para baixo do piso.

### 10.4 Fase 4 em detalhe — o que revisar

Ao completar 90 dias, a moto entra em revisão obrigatória, que analisa:

- Valor de mercado atualizado (a categoria caiu de preço desde a compra?)
- Concorrência direta (quantos anúncios comparáveis, a que preço?)
- Histórico de propostas recebidas (a moto teve propostas próximas ao LP que foram
  recusadas? Isso é sinal de que o preço está alto.)
- Quantidade de contatos/leads gerados (baixo volume = problema de anúncio ou de preço)
- Desempenho do anúncio (IVP — Pilar 4.5)
- Condição física atual (pode ter mudado desde a entrada no estoque)
- Rentabilidade projetada em cada cenário de novo preço

Saídas possíveis: reposicionamento de preço (dentro do corredor já calculado), campanha
exclusiva, bonificação comercial pontual para o vendedor fechar naquela faixa, ou — em
casos extremos, com aprovação N3 — venda abaixo do LP, sempre registrada.

### 10.5 Indicadores de controle da precificação dinâmica

| Indicador | Fórmula |
|---|---|
| Tempo Médio de Permanência em Estoque | `Σ Dias em Estoque das motos vendidas ÷ Nº de motos vendidas` |
| Giro Médio por Categoria | ver Pilar 4.4 (Liquidez da Categoria) |
| Lucro Bruto por Faixa de Tempo em Estoque | `Σ Lucro Líquido Real agrupado por Fase (1/2/3/4)` |
| % de Vendas por Margem Utilizada | `Nº vendas na margem X ÷ Nº total de vendas`, para cada camada |
| Nº de Motos acima de 90 dias | `COUNT(Dias em Estoque > 90)` |
| Capital Imobilizado em Estoque | ver Pilar 8.9 |
| Índice de Depreciação do Estoque | ver Pilar 8.11, agregado por categoria |

---

## 11. ENGENHARIA MATEMÁTICA CONSOLIDADA

### 11.1 Por que "método do divisor" e não "markup sobre o custo"

A forma mais comum (e mais perigosa) de precificar é o **markup multiplicativo**:
`Preço = Custo × (1 + %Margem)`. O problema: quando existem custos variáveis que também são
percentuais **do preço de venda** (impostos, comissão, marketing), aplicar a margem sobre o
*custo* subestima sistematicamente o preço necessário — a empresa acredita que ganhou a
margem-alvo, mas na prática ganhou menos, porque impostos e comissão "comeram" uma fatia do
preço que não foi provisionada.

A MM Negócios usa o **método do divisor** (também chamado de precificação por diluição),
que resolve a equação corretamente, garantindo que a margem-alvo seja sempre medida **sobre
o preço de venda final** — a única base que realmente importa (é sobre o preço de venda que
o cliente paga, o imposto incide, e a comissão é calculada).

### 11.2 A cadeia completa

```
Preço de Compra
     ↓
+ Custos Diretos (revisão, estética, documentação, frete, combustível, acessórios)
     ↓
+ Custo Financeiro Provisionado (Valor Compra × Taxa Financeira × Dias Meta ÷ 30)
     ↓
+ Custo Operacional Rateado (rateio das despesas fixas por unidade)
     ↓
= CUSTO BASE
     ↓
÷ Divisor = [1 − (%Impostos + %Comissão + %Marketing Provisionado + %Reserva Financeira + %Margem)]
     ↓
= PREÇO (Estratégico | Comercial | Negociação | LP — conforme %Margem usada)
```

### 11.3 Fórmula geral única

```
Preço(margem) = Custo Base ÷ [1 − (i + c + m + r + margem)]

onde:
Custo Base = Compra + CustosDiretos + CustoFinanceiroProvisionado + CustoOperacionalRateado
i = % Impostos efetivos
c = % Comissão padrão
m = % Marketing provisionado
r = % Reserva financeira
margem ∈ {Margem Estratégica, Margem Comercial, Margem de Negociação, Margem LP}
```

### 11.4 Verificação (a fórmula "fecha")

Substituindo o Preço Comercial da Moto-Modelo de volta na equação:

```
Preço × Divisor = Custo Base?
14.773,05 × 0,705 = 10.414,99 ≈ 10.415,00 ✓ (diferença de arredondamento)
```

E o Lucro Líquido:

```
Lucro Líquido = Preço × %Margem = 14.773,05 × 0,16 = R$ 2.363,69
```

Que é exatamente o valor apurado na Seção 3.3 — a fórmula é consistente porque, por
construção, `Preço − Custo Base = Preço × (i+c+m+r+margem)`, isto é, tudo que não é Custo
Base é automaticamente coberto pelos percentuais aplicados sobre o próprio preço.

### 11.5 Reconciliação Planejado vs. Real (pós-venda)

Depois que a moto é vendida, a aba `08-Vendas-Negociacao` recalcula os valores **reais**
(substituindo os provisionados pelos efetivos):

```
Lucro Líquido Real = Preço Vendido
                    − Custo Base Real (com Custo Financeiro Real, dias reais em estoque)
                    − (Preço Vendido × %Impostos)
                    − (Preço Vendido × %Comissão Real)
                    − Marketing Real (R$ efetivamente investido, aba 03-Marketing)
                    − (Preço Vendido × %Reserva, se utilizada)

Margem Líquida Realizada (%) = Lucro Líquido Real ÷ Preço Vendido
```

Essa reconciliação é o elo entre a precificação (que usa premissas) e a realidade (o que de
fato aconteceu) — e é a base de todos os KPIs de performance comercial (Pilar 7) e de
precisão de giro (Pilar 8.13).

---

## 12. ENGENHARIA DE PLANILHA

A planilha `planilha-precificacao/MM-Negocios-Precificacao-Motos.xlsx`, entregue junto a
este documento, implementa integralmente a engenharia matemática acima. Nenhum valor de
preço, margem, KPI ou classificação é digitado manualmente — tudo é fórmula, encadeada a
partir de três tipos de entrada: **cadastro da moto**, **parâmetros da empresa** e
**registro da venda real**.

### 12.1 Arquitetura das abas

| Aba | Função | Alimenta |
|---|---|---|
| `00-Leia-me` | Instruções de uso, ordem de preenchimento | — |
| `00-Parametros` | Banco de parâmetros: todas as %, taxas e faixas de dias (fonte única de verdade) | Todas as abas de cálculo |
| `01-Cadastro-Motos` | Dados cadastrais de cada motocicleta, status, datas | `02` a `08` |
| `02-Custos-Diretos` | Revisão, estética, documentação, frete, combustível, acessórios por moto | `06-Precificacao` |
| `03-Marketing` | Verba investida, leads, cliques, CPL, CPC, CAC por moto | `06`, `10-Indicadores` |
| `04-Comercial` | Cadastro de vendedores, comissão padrão, metas | `06`, `08`, `09-Ranking` |
| `05-Financeiro` | Custo financeiro e de oportunidade reais, por moto | `10-Indicadores` |
| `06-Precificacao` | **Motor de cálculo**: Custo Base + 4 preços (Estratégico/Comercial/Negociação/LP) | `07`, `08`, `13-Dashboard` |
| `07-Estoque-Dinamica` | Dias em estoque, fase (1–4), classificação de saúde, preço sugerido atual, capital parado | `13-Dashboard` |
| `08-Vendas-Negociacao` | Registro da venda real: vendedor, preço vendido, desconto, lucro líquido real | `09`, `10`, `11` |
| `09-Ranking-Vendedores` | KPIs de performance por vendedor (Pilar 7), rankings | `13-Dashboard` |
| `10-Indicadores-KPIs` | KPIs agregados da operação (margem média, ROI, ROAS, capital parado, giro) | `13-Dashboard` |
| `11-Curva-ABC` | Classificação A/B/C das motos por contribuição de lucro | `13-Dashboard` |
| `12-Governanca-Historico` | Log de alterações de preço, aprovações, justificativas | Auditoria |
| `13-Dashboard` | Painel executivo consolidado, com gráficos | — (camada final) |

### 12.2 Ordem correta de preenchimento

```
1. 00-Parametros           → calibrar % e taxas antes de tudo
2. 01-Cadastro-Motos        → cadastrar a moto ao entrar no estoque
3. 02-Custos-Diretos        → lançar custos de preparação assim que ocorrerem
4. 03-Marketing (opcional)  → lançar verba/leads se houver campanha específica
5. 06-Precificacao          → já calcula sozinha (não editar células de fórmula)
6. 07-Estoque-Dinamica      → monitorar diariamente (calcula sozinha, baseada na data de hoje)
7. 08-Vendas-Negociacao     → registrar apenas quando a moto for vendida
8. 09 / 10 / 11 / 13        → leitura (dashboards, calculam sozinhos)
9. 12-Governanca-Historico  → registrar manualmente toda vez que um preço for alterado fora do fluxo automático
```

### 12.3 Regra de integridade

Todas as fórmulas entre abas usam **`ID da Moto` como chave de busca** (`ÍNDICE`/`CORRESP`),
não a posição da linha — isso significa que a ordem das motocicidades pode ser diferente em
cada aba sem quebrar nenhum cálculo, e novas motos podem ser inseridas em qualquer linha
livre.

---

## 13. DASHBOARD EXECUTIVO

### 13.1 Indicadores exibidos

| Indicador | Leitura para quem |
|---|---|
| Lucro Médio por Moto Vendida | CEO / CFO — saúde geral da operação |
| Margem Líquida Média Realizada (%) | CFO — a margem-alvo está sendo entregue de fato? |
| Capital Investido Total em Estoque | CFO — exposição total de capital |
| Capital Parado (Atenção + Crítico) | CFO — risco imediato de capital imobilizado |
| Lucro por Vendedor / Ranking | Diretor Comercial — gestão de equipe |
| ROI Médio Anualizado | CEO — eficiência do capital girado |
| ROAS Consolidado | Diretor Comercial/Marketing — eficiência de mídia |
| Tempo Médio em Estoque (Dias) | Diretor Comercial — velocidade de giro |
| Distribuição do Estoque por Fase (1/2/3/4) | CEO — visão de risco de envelhecimento |
| Nº de Motos Críticas (>90 dias) | CEO / CFO — atenção prioritária |
| % de Vendas no Preço Comercial ou Acima | Diretor Comercial — qualidade média de negociação da equipe |
| Curva ABC do Estoque | CEO — onde está concentrado o lucro |

### 13.2 Como o CEO deve ler o dashboard em 60 segundos

1. **Capital Parado** subiu no mês? → Verificar Fase 4 (Pilar 10) antes de qualquer outra
   coisa — é o número que mais rápido vira prejuízo se ignorado.
2. **Margem Líquida Média Realizada** está abaixo do target da Margem Comercial? →
   Verificar Ranking de Vendedores (Pilar 7) — é problema de negociação ou de precificação
   (ICP alto, Pilar 4)?
3. **% de Vendas no Preço Comercial ou Acima** caindo? → Sinal de pressão competitiva
   (revisar ICP) ou de treinamento comercial necessário.
4. **ROI Anualizado** abaixo da meta? → Cruzar com Tempo Médio em Estoque — o problema é
   margem ou é velocidade de giro?

---

## 14. GLOSSÁRIO DE VARIÁVEIS

| Variável | Definição | Onde é usada |
|---|---|---|
| **LP** | Lucro Presumido — margem líquida mínima aceitável; preço-piso absoluto | Pilares 2, 3, 6, 9, 10 |
| **Custo Base** | Compra + Custos Diretos + Custo Financeiro Provisionado + Custo Operacional Rateado | Pilares 2, 3, 8, 11 |
| **Divisor** | `1 − (i+c+m+r+margem)` — denominador da fórmula de preço | Pilar 11 |
| **ICP** | Índice de Competitividade de Preço — Preço Praticado ÷ Preço Médio de Mercado | Pilar 4 |
| **ISE** | Índice de Saúde do Estoque — score ponderado de 0 a 1 | Pilar 5 |
| **PMC** | Preço Máximo de Compra | Pilar 1 |
| **CPL / CPC / CAC / ROAS** | Indicadores de eficiência de marketing (Pilar 8.6) | Pilares 4, 8, 13 |
| **ROI** | Retorno sobre o capital investido na moto | Pilar 8.12 |
| **Capital Parado** | Valor de compra somado das motos classificadas Atenção/Crítico | Pilares 5, 8, 13 |
| **Precisão de Giro** | Dias Meta ÷ Dias Reais em Estoque | Pilar 8.13 |
| **Fase (1–4)** | Estágio do ciclo de vida do estoque conforme dias parados | Pilar 10 |

---

## 15. ERROS COMUNS E BOAS PRÁTICAS

### 15.1 Erros comuns

1. **Aplicar margem sobre o custo, não sobre o preço** (markup multiplicativo) — subestima
   o preço necessário sempre que existem custos percentuais sobre a venda (ver 11.1).
2. **Tratar o LP como meta**, não como piso — leva a diretoria a "normalizar" vendas no LP,
   destruindo a margem média da operação.
3. **Negociar com o cliente mostrando o corredor inteiro** — o vendedor deve conhecer o LP,
   o cliente nunca.
4. **Reduzir preço por pressão do cliente sem seguir a Matriz de Aprovação (Pilar 9)** —
   toda concessão fora do padrão vira precedente informal para a próxima negociação.
5. **Ignorar o Custo Financeiro** por a moto ainda não ter sido vendida — o capital parado
   custa dinheiro todo santo dia, vendida ou não.
6. **Comparar ROI entre motos sem anualizar** — motos de giro rápido parecem "menos
   lucrativas" que motos de giro lento se o prazo não for normalizado (ver 8.12).
7. **Deixar o Custo Operacional Rateado desatualizado** — se as despesas fixas sobem e o
   rateio não é revisado mensalmente, toda a cadeia de preços fica subavaliada.

### 15.2 Boas práticas

1. Revisar os parâmetros (`00-Parametros`) mensalmente — nunca deixar taxas e percentuais
   "engessados" por mais de um ciclo de fechamento.
2. Toda venda abaixo do Preço de Negociação gera registro automático — tratar isso como
   sinal, não como exceção administrativa sem consequência.
3. Usar o Índice de Risco da Aquisição (Pilar 1.4) **antes** de fechar a compra, não depois.
4. Cruzar sempre Ranking Financeiro com Ranking Comercial (Pilar 7.3) antes de qualquer
   decisão sobre a equipe — nunca julgar vendedor por volume isolado.
5. Tratar a Fase 4 (>90 dias, Pilar 10.4) como reunião obrigatória de diretoria, não como
   tarefa do vendedor responsável pela moto.

---

## 16. OBJETIVO FINAL

Este sistema entrega à MM Negócios Veículos a capacidade de:

- **Padronizar** a entrada de qualquer motocicleta no estoque, do cadastro ao preço, sem
  depender de planilhas paralelas ou decisões informais;
- **Eliminar decisões emocionais de preço**, substituindo-as por uma cadeia de fórmulas
  auditável do início ao fim;
- **Proteger o lucro mínimo da empresa** através do LP, matematicamente definido e
  governado (Pilares 2 e 9);
- **Medir a eficiência real de cada vendedor**, separando qualidade de negociação de
  qualidade de precificação (Pilar 7);
- **Preservar o caixa**, tornando visível o capital parado antes que vire prejuízo
  (Pilares 5 e 8);
- **Acelerar o giro do estoque de forma planejada**, não reativa (Pilar 10);
- **Aumentar a competitividade** sem abrir mão de margem, através de indicadores de
  mercado calibrados (Pilar 4);
- **Criar previsibilidade financeira**, com reconciliação constante entre o planejado e o
  realizado (Seção 11.5);
- **Transformar a precificação em ferramenta de gestão estratégica**, não em tarefa
  operacional do balcão de vendas.

> A precificação não existe para vender motos. Existe para proteger a empresa que vende
> motos — hoje e no tamanho que ela pretende ter amanhã.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|---|---|---|---|
| 1.0.0 | 2026-07-07 | Especialista em Engenharia Financeira, Pricing e Controladoria | Criação da Engenharia Estratégica de Precificação completa (10 pilares, engenharia matemática, especificação da planilha) |
