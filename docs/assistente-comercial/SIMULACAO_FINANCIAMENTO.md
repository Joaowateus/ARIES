# Simulação de financiamento no Assistente Comercial

Objetivo: o lead chega ao vendedor **já com uma simulação** (entrada, prazo,
parcela) e com uma leitura de quanto a parcela pesa no orçamento dele, para o
vendedor priorizar quem tem condição de comprar.

## Como o mercado faz

Há dois níveis, e eles não se misturam:

1. **Simulação estimada.** Calculadora com as taxas que a loja informa: valor
   da moto, entrada e prazo dão a parcela (Tabela Price). É instantânea, não
   consulta CPF e não promete aprovação. É o que os robôs de concessionária
   oferecem no WhatsApp como "simulação prévia" antes de passar ao vendedor.
2. **Pré-aprovação de crédito.** A financeira (Banco Honda, Banco Yamaha, BV,
   Santander, C6 e outras) analisa CPF, data de nascimento e renda e devolve
   aprovado, recusado ou pendente com a taxa real. Exige convênio da loja com
   a financeira (portal ou API do lojista) e autorização do cliente (LGPD).
   Falar em "pré-aprovado" antes da resposta do banco gera reclamação de
   propaganda enganosa.

## O que entra agora (nível 1)

- **Aba "Simulação" no Assistente** (gestão): taxas de referência por prazo
  (% ao mês), entrada mínima (% do valor), se o robô pergunta a renda,
  comprometimento máximo da renda (padrão 30%) e o aviso que acompanha a
  simulação. **Começa desligada** e só liga depois de a loja salvar as taxas.
- **Robô:** quando o cliente diz que vai financiar e a moto de interesse tem
  preço no estoque, no fim do roteiro o assistente pergunta a renda aproximada
  (opcional: "pular" vale) e manda a simulação com 3 ou 4 prazos, antes da
  mensagem de encerramento. Sem preço no estoque, não simula.
- **O que o cliente vê:** as parcelas por prazo, a entrada usada (a mínima, se
  a dele for menor), a taxa de referência e o aviso "simulação ilustrativa,
  sem IOF e tarifas, sujeita à análise de crédito". O preço da moto só
  aparece se "Preço no WhatsApp" estiver ligado.
- **O que o vendedor recebe:** no resumo do lead, a simulação e a leitura:
  *cabe no bolso* (alguma parcela fica dentro do comprometimento máximo),
  *apertada* (até 10 pontos acima) ou *não cabe*. Isso vira etiqueta no CRM
  (Simulou, Parcela cabe, Parcela apertada, Parcela não cabe) e entra na nota
  do lead: +5 por ter simulado, +10 se cabe, −10 se não cabe.
- **Na conversa:** botão "Simular financiamento" para o vendedor refazer com
  outros números e mandar ao cliente (abre com a moto, a entrada e a renda da
  conversa; só grava quando envia). Funciona mesmo com o robô desligado,
  desde que as taxas estejam salvas. A lateral da conversa mostra a última
  simulação. No chat "Você": *? simular CG 160 entrada 3 mil renda 2500* ou
  *? simular 15 mil sem entrada*.
- **Teste do roteiro:** o simulador da aba "Roteiro e teste" passa pela
  pergunta da renda e mostra a simulação, como no WhatsApp.

Princípios mantidos: cálculo por regra, sem IA; a IA nunca recebe a renda nem
valores em reais (as respostas internas do roteiro saem do contexto e a
mensagem em que o cliente informou a renda vai mascarada); nada é chamado de
"aprovado".

## Onde está

- Cálculo e textos: `apps/api/src/lib/assistenteSimulacao.ts` (puro, com testes
  em `tests/assistente.test.ts`).
- Robô: passo extra da renda em `avancarRoteiro` e `simuladorDoRobo`
  (`assistenteRespostas.ts`); a simulação fica em `AssistenteConversa.simulacao`.
- Rotas: `GET/PUT /assistente/simulacao`, `POST /assistente/simulacao/previa`
  e `POST /assistente/conversas/:id/simulacao`.
- Configuração da loja: `AssistenteLoja.simulacaoAtiva` e `simulacaoConfig`.

## Depois (nível 2)

Quando a loja tiver acesso de lojista a uma financeira:
- o robô pede, com consentimento explícito, CPF e data de nascimento;
- a ficha vai para a financeira (API ou, sem API, para o vendedor lançar no
  portal) e a resposta volta para a conversa e para o CRM;
- a simulação passa a usar a taxa devolvida pela financeira.

Para isso é preciso saber com quais financeiras a loja trabalha e qual canal
cada uma oferece ao lojista.
