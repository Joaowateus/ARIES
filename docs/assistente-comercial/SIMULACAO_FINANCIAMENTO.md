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

## Pré-análise nos bancos parceiros (nível 2, sem API)

A loja trabalha com **Santander, BV e PAN**. Nenhum dos três publica API
aberta para lojista: cada um tem o portal ou app do parceiro (Santander
Financiamentos: app "Financiamento Lojista"; BV: Portal de Parceiros; PAN:
portal do lojista e o MobiGestor, da Mobiauto). Então a pré-análise entra
pelo caminho que já existe, sem retrabalho:

- **Aba "Simulação" → Pré-análise nos bancos parceiros:** a lista de bancos
  (até 8) e a chave "Robô pede a ficha depois da simulação". Começa desligada;
  sem banco cadastrado não liga.
- **Robô:** depois da simulação, pergunta se o cliente autoriza a pré-análise
  nos bancos (citando quais). Com o *sim*, pede o CPF (confere os dígitos
  verificadores; uma nova tentativa se vier errado) e a data de nascimento
  (18 a 100 anos). "Não", "agora não" ou "não quero" encerram normalmente:
  nessa etapa não contam como pedido para parar de receber mensagens.
- **Autorização registrada:** a pergunta exata, a resposta do cliente e o
  horário ficam guardados com a ficha (LGPD).
- **Ficha na conversa:** CPF (escondido por padrão), nascimento, renda, moto,
  valor e entrada, com "Copiar ficha" para colar no portal de cada banco. O
  vendedor também pode registrar a ficha (cliente passou por telefone ou na
  loja), marcando que o cliente autorizou. "Apagar ficha" remove a ficha e as
  respostas.
- **Resposta por banco:** a enviar, em análise, aprovada (entrada, prazo,
  parcela e taxa) ou recusada, com observação. Aprovada, "Enviar ao cliente"
  manda a condição pelo WhatsApp do vendedor, com "sujeito à confirmação dos
  documentos pelo banco".
- **CRM e funil:**
  - Etiquetas: Ficha de crédito, Crédito aprovado e Crédito recusado (quando
    todos recusaram).
  - Nota do lead: +10 pela autorização, +20 se algum banco aprovou, −20 se
    todos recusaram.
  - Funil: crédito aprovado leva de Abordado para Negociação, e a aprovação
    enviada ao cliente conta como proposta (Proposta).
  - O CPF vai para o campo CPF do lead, nunca para a observação.
- **Placar por banco (30 dias):** fichas lançadas, % de aprovação e taxa média
  aprovada, para saber em qual banco lançar primeiro.
- **Privacidade:** CPF e data de nascimento nunca vão para a IA (o filtro de
  todas as camadas de IA mascara CPF e datas de nascimento), nem para o aviso
  no WhatsApp do vendedor, nem para as respostas do roteiro. Só o vendedor da
  conversa e a gestão veem a ficha.

## Depois (nível 3: integração por API)

- **BV:** tem portal de desenvolvedores com APIs para parceiros F&I (inclui
  condições de financiamento para parceiros). Pedir ao gerente comercial do BV
  o credenciamento da loja como parceiro F&I e o acesso ao sandbox.
- **Santander Financiamentos:** sem API pública para lojista; pedir ao
  consultor de lojista se há integração (API ou parceiro homologado) para
  simulação e envio de proposta.
- **PAN:** a integração conhecida é via Mobiauto (MobiGestor mostra crédito
  pré-aprovado PAN na hora); perguntar ao operador PAN se há API para a loja
  ou se a integração passa pela Mobiauto.

Com o acesso de qualquer um deles, a ficha que já está no sistema vai direto
para o banco e a resposta volta sozinha para a conversa, no lugar do
lançamento manual.

## Onde está

- Cálculo e textos: `apps/api/src/lib/assistenteSimulacao.ts` (puro, com testes
  em `tests/assistente.test.ts`).
- Robô: passo extra da renda em `avancarRoteiro` e `simuladorDoRobo`
  (`assistenteRespostas.ts`); a simulação fica em `AssistenteConversa.simulacao`.
- Rotas: `GET/PUT /assistente/simulacao`, `POST /assistente/simulacao/previa`
  e `POST /assistente/conversas/:id/simulacao`.
- Configuração da loja: `AssistenteLoja.simulacaoAtiva` e `simulacaoConfig`
  (com `bancos` e `preAnalise`).
- Pré-análise: passos do robô em `passoDaFicha` (`assistenteRoteiro.ts`),
  tabelas `AssistenteFichaCredito` e `AssistenteAnaliseCredito`, rotas em
  `routes/proLaboreAssistenteCredito.ts` (`/assistente/conversas/:id/credito`,
  respostas por banco, envio da aprovação e `/assistente/credito/resumo`).
