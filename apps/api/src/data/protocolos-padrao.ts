/**
 * Protocolos comerciais reais da MM Negócios, transcritos fielmente do mapa
 * mental do Diretor Comercial. Cada um segue o framework de 7 níveis
 * (identidade, estrutura operacional, gestão de execução, controle e
 * auditoria, gestão, risco e contingência, melhoria contínua).
 *
 * `id` é fixo (slug) para que o upsert no seed nunca duplique nem sobrescreva
 * edições feitas depois pela interface — ver prisma/seed.ts.
 */

export interface ProtocoloSeed {
  id: string
  categoria: string
  nome: string
  ordem: number
  objetivo: string
  resultadoEsperado: string[]
  responsaveis: string[]
  processo: string[]
  pop: { titulo: string; descricao?: string; checklist?: string[] }[]
  regras: string[]
  ferramentas: string[]
  rotina: { chave: string; valor: string }[]
  sla: { item: string; prazo: string }[]
  kpis: { categoria: string; indicador: string }[]
  auditoriaItens: string[]
  frequenciaAuditoria: string
  criteriosConformidade: string[]
  naoConformidadesCatalogo: string[]
  reunioes: { chave: string; valor: string }[]
  perguntasAnalise: string[]
  riscos: string[]
  planoContingencia: { cenario: string; acao: string }[]
  revisaoFrequencia?: string
  revisaoResponsavel?: string
  oportunidadesMelhoriaNotas?: string[]
  anexos?: { titulo: string; itens: string[] }[]
}

export const PROTOCOLOS_SEED: ProtocoloSeed[] = [
  {
    id: 'protocolo-agendamento-confirmacao-visita',
    categoria: 'Protocolos Comerciais',
    nome: 'Agendamento e Confirmação de Visita Presencial',
    ordem: 1,
    objetivo:
      'Garantir que todo cliente qualificado compareça à visita agendada, chegando à loja com todas as informações alinhadas sobre a negociação realizada.',
    resultadoEsperado: [
      'Cliente com visita confirmada.',
      'Horário definido.',
      'Negociação validada.',
      'Equipe preparada para atendimento.',
      'Redução de faltas (No Show).',
      'Aumento da taxa de comparecimento.',
    ],
    responsaveis: ['Supervisor', 'Coordenador', 'Vendedor'],
    processo: [
      'SDR/Vendedor finaliza qualificação',
      'Cliente demonstra interesse na visita',
      'Criação do Grupo WhatsApp',
      'Envio das informações da negociação (Relatório de Agendamento de Proposta)',
      'Envio da foto da moto negociada',
      'Envio da enquete de horário',
      'Cliente escolhe horário',
      'Coordenador realiza ligação de confirmação',
      'Validação da negociação',
      'Validação do horário',
      'Visita confirmada + Acompanhamento até a loja',
    ],
    pop: [
      { titulo: 'Criação do Grupo', descricao: 'Criar grupo WhatsApp imediatamente após confirmação da visita.' },
      { titulo: 'Inserção dos Participantes', descricao: 'Participantes do grupo: 1 Supervisor, 1 Vendedor, 1 Cliente.' },
      {
        titulo: 'Envio da Negociação',
        descricao: 'Publicar resumo completo:',
        checklist: ['Nome do cliente', 'Modelo da moto', 'Valor negociado', 'Entrada', 'Parcelamento', 'Condições acordadas', 'Benefícios concedidos', 'Data da visita'],
      },
      { titulo: 'Envio da Foto', descricao: 'Enviar foto atualizada da motocicleta negociada. Objetivo: gerar conexão emocional.' },
      { titulo: 'Escolha do Horário', descricao: 'Publicar enquete contendo Horário A / B / C. Cliente deve selecionar uma opção.' },
      {
        titulo: 'Ligação de Confirmação',
        descricao: 'Coordenador realiza ligação.',
        checklist: ['Confirmar nome', 'Confirmar CPF', 'Confirmar modelo', 'Confirmar valor', 'Confirmar entrada', 'Confirmar parcelas', 'Confirmar horário', 'Confirmar endereço', 'Confirmar presença'],
      },
      { titulo: 'Registro', descricao: 'Atualizar CRM. Status: VISITA CONFIRMADA' },
    ],
    regras: [
      'Grupo criado em até 5 minutos após confirmação.',
      'Foto obrigatória.',
      'Enquete obrigatória.',
      'Ligação obrigatória.',
      'CRM atualizado obrigatoriamente.',
      'Nenhuma visita pode ocorrer sem confirmação telefônica.',
    ],
    ferramentas: ['WhatsApp Business', 'CRM', 'Sistema de Estoque (Tabela)', 'Banco de Imagens', 'Telefonia'],
    rotina: [
      { chave: 'Diária', valor: 'Criação dos grupos. Ligações de confirmação. Atualização CRM.' },
      { chave: 'Semanal', valor: 'Conferência dos grupos criados. Conferência das visitas realizadas.' },
      { chave: 'Mensal', valor: 'Análise de comparecimento.' },
    ],
    sla: [
      { item: 'Criação do grupo', prazo: 'Até 5 minutos' },
      { item: 'Envio da negociação', prazo: 'Até 10 minutos' },
      { item: 'Ligação de confirmação', prazo: 'Até 30 minutos após escolha do horário' },
      { item: 'Atualização CRM', prazo: 'Imediata' },
    ],
    kpis: [
      { categoria: 'Volume', indicador: 'Total de visitas agendadas.' },
      { categoria: 'Conversão', indicador: 'Taxa de comparecimento.' },
      { categoria: 'Eficiência', indicador: 'Tempo médio de confirmação.' },
      { categoria: 'Qualidade', indicador: 'Percentual de grupos completos.' },
      { categoria: 'Comercial', indicador: 'Taxa de venda por visita.' },
    ],
    auditoriaItens: ['Grupo criado.', 'Participantes corretos.', 'Foto enviada.', 'Enquete enviada.', 'Ligação realizada.', 'CRM atualizado.'],
    frequenciaAuditoria: 'Diária',
    criteriosConformidade: ['Grupo criado.', 'Participantes adicionados.', 'Foto enviada.', 'Negociação publicada.', 'Horário escolhido.', 'Ligação realizada.', 'CRM atualizado.'],
    naoConformidadesCatalogo: ['Grupo não criado.', 'Cliente sem enquete.', 'Ligação não realizada.', 'Informações divergentes.', 'CRM sem atualização.'],
    reunioes: [
      { chave: 'Auditoria Comercial', valor: 'Revisão dos agendamentos do dia.' },
      { chave: 'Semanal', valor: 'Análise dos comparecimentos.' },
      { chave: 'Mensal', valor: 'Análise dos indicadores de visita.' },
    ],
    perguntasAnalise: ['Quantos compareceram?', 'Quantos faltaram?', 'Por que faltaram?', 'Houve divergência na negociação?', 'Houve atraso de confirmação?'],
    riscos: ['Cliente esquecer horário.', 'Cliente receber informação errada.', 'Desistência antes da visita.', 'Moto não disponível.', 'Falha de comunicação interna.'],
    planoContingencia: [
      { cenario: 'Cliente não atende', acao: 'Enviar áudio + mensagem. Nova tentativa em 30 minutos.' },
      { cenario: 'Cliente não escolhe horário', acao: 'Contato ativo via ligação.' },
      { cenario: 'Cliente não compareceu', acao: 'Reforçar o compromisso | Condição | Oferta | Acrescentar benefício' },
    ],
    revisaoFrequencia: 'Mensal',
    revisaoResponsavel: 'Supervisor Comercial',
    oportunidadesMelhoriaNotas: ['Aumenta significativamente o comprometimento psicológico do cliente e tende a reduzir faltas.'],
    anexos: [
      {
        titulo: 'Relatório de Agendamento de Proposta (modelo de mensagem)',
        itens: [
          'Data do atendimento',
          'Vendedor responsável',
          'Supervisor',
          '👤 Dados do Cliente — Nome',
          'Telefone/WhatsApp',
          'Cidade/UF',
          '🏍️ Dados da Motocicleta — Marca',
          'Modelo',
          'Condição: ( ) Nova ( ) Seminova',
          '💰 Proposta Apresentada — Valor total da moto: R$',
          'Obs: condições especiais combinadas com o cliente',
          'Forma de pagamento: ( ) Financiamento ( ) À vista ( ) Cartão',
        ],
      },
    ],
  },

  {
    id: 'protocolo-pre-vendas-blindagem-fechamento',
    categoria: 'Protocolos Comerciais',
    nome: 'Pré-Vendas e Blindagem de Fechamento',
    ordem: 2,
    objetivo:
      'Antecipar e eliminar obstáculos operacionais, técnicos, documentais e administrativos que possam impedir ou atrasar o fechamento da venda, reduzindo tempo de atendimento e aumentando a taxa de conversão.',
    resultadoEsperado: [
      'Pré-revisão realizada',
      'Orçamento de manutenção disponível',
      'Contrato pré-preenchido (mínimo 50%)',
      'Documentação validada',
      'Pendências identificadas antecipadamente',
      'Cliente apto para conclusão rápida da venda',
      'Atendimento presencial concluído em até 40 minutos',
    ],
    responsaveis: [
      'Executor: Coordenador Comercial',
      'Executor: Supervisor Comercial',
      'Apoio: Responsável pela manutenção',
      'Apoio: Despachante',
      'Apoio: Equipe administrativa',
      'Gerente Comercial',
    ],
    processo: [
      'Cliente confirma visita',
      'Grupo WhatsApp criado',
      'Solicitação de Cartão de Revisão',
      'Solicitação enviada ao responsável pela manutenção',
      'Assinatura de recebimento da solicitação',
      'Pré-revisão rápida realizada',
      'Orçamento elaborado',
      'Assinatura de entrega do orçamento',
      'Pré-contrato iniciado',
      'Validação documental',
      'Consulta junto ao despachante',
      'Identificação de pendências',
      'Correção das pendências',
      'Cliente chega à loja',
      'Processo de fechamento iniciado',
    ],
    pop: [
      { titulo: 'Etapa 1 — Abrir Cartão de Revisão' },
      { titulo: 'Etapa 2 — Preencher Cartão', descricao: 'Preencher: Cliente, Modelo da moto, Data, Solicitante, Responsável manutenção.' },
      { titulo: 'Etapa 3 — Coletar assinatura de solicitação' },
      { titulo: 'Etapa 4 — Realizar revisão rápida', descricao: 'Responsável manutenção realiza revisão rápida.' },
      { titulo: 'Etapa 5 — Preencher orçamento preliminar' },
      { titulo: 'Etapa 6 — Definir peças prioritárias' },
      { titulo: 'Etapa 7 — Definir tempo estimado' },
      { titulo: 'Etapa 8 — Coletar assinatura de entrega' },
      { titulo: 'Etapa 9 — Iniciar pré-contrato' },
      {
        titulo: 'Etapa 10 — Realizar checklist documental',
        checklist: [
          'RG: não podendo passar de 10 anos',
          'CNH: até um ano depois do vencimento',
          'Comprovante de residência (não precisa estar no nome da pessoa)',
          'Caso não tenha comprovante de residência no momento da compra, solicitar ao Felipe a declaração de residência.',
        ],
      },
      { titulo: 'Etapa 11 — Consultar despachante' },
      { titulo: 'Etapa 12 — Atualizar CRM' },
    ],
    regras: [
      'Toda negociação deverá gerar Cartão de Revisão.',
      'Toda solicitação deverá possuir assinatura dupla.',
      'Toda entrega deverá possuir assinatura dupla.',
      'Toda revisão preliminar deverá ocorrer em até 30 minutos.',
      'Todo contrato deverá chegar no mínimo 50% preenchido.',
      'Todo cliente deverá possuir documentação validada previamente.',
      'Nenhuma venda seguirá para fechamento com pendências críticas.',
    ],
    ferramentas: ['CRM', 'WhatsApp Business', 'Sistema interno', 'Cartão de Revisão', 'Sistema de documentação', 'Sistema do despachante', 'Telefone'],
    rotina: [
      { chave: 'Diária', valor: 'Abrir Cartões de Revisão. Solicitar pré-revisões. Realizar consultas documentais. Atualizar CRM.' },
      { chave: 'Semanal', valor: 'Conferência das solicitações. Conferência das entregas.' },
      { chave: 'Mensal', valor: 'Análise de atrasos. Análise de erros operacionais.' },
      { chave: 'Trimestral', valor: 'Revisão do fluxo.' },
      { chave: 'Anual', valor: 'Revisão completa do protocolo.' },
    ],
    sla: [
      { item: 'Solicitação da revisão', prazo: 'Até 5 minutos após agendamento' },
      { item: 'Pré-revisão', prazo: 'Até 30 minutos' },
      { item: 'Orçamento', prazo: 'Até 30 minutos' },
      { item: 'Pré-contrato', prazo: 'Até 20 minutos' },
      { item: 'Tempo máximo de atendimento presencial', prazo: 'Até 40 minutos' },
    ],
    kpis: [
      { categoria: 'Volume', indicador: 'Quantidade de pré-vendas realizadas' },
      { categoria: 'Eficiência', indicador: 'Tempo médio de revisão' },
      { categoria: 'Conversão', indicador: 'Taxa de fechamento' },
      { categoria: 'Qualidade', indicador: 'Percentual de contratos antecipados' },
      { categoria: 'Operacional', indicador: 'Tempo médio de atendimento' },
    ],
    auditoriaItens: ['Existência do Cartão de Revisão', 'Assinaturas', 'Tempo de execução', 'Pré-contrato preenchido', 'Consulta realizada', 'CRM atualizado'],
    frequenciaAuditoria: 'Diária',
    criteriosConformidade: ['Cartão criado', 'Assinaturas coletadas', 'Revisão realizada', 'Orçamento entregue', 'Contrato preenchido', 'Consulta documental realizada', 'CRM atualizado'],
    naoConformidadesCatalogo: ['Cartão inexistente', 'Falta de assinatura', 'Revisão atrasada', 'Contrato incompleto', 'Consulta não realizada', 'Documentação inválida', 'CRM não atualizado'],
    reunioes: [
      { chave: 'Acompanhamento operacional', valor: 'Diário' },
      { chave: 'Semanal', valor: 'Análise de gargalos' },
      { chave: 'Mensal', valor: 'Análise de indicadores' },
      { chave: 'Trimestral', valor: 'Revisão estratégica' },
    ],
    perguntasAnalise: ['Quantos processos tiveram atraso?', 'Qual etapa mais gera falha?', 'Qual pendência aparece com maior frequência?', 'Onde ocorreu perda de venda?'],
    riscos: ['Moto sem peças disponíveis', 'Atraso da manutenção', 'Documento inválido', 'Problema junto ao despachante', 'Contrato incompleto', 'Erro de comunicação'],
    planoContingencia: [
      { cenario: 'Moto indisponível', acao: 'Oferecer alternativa aprovada' },
      { cenario: 'Documento inválido', acao: 'Solicitar substituição imediata' },
      { cenario: 'Sistema fora do ar', acao: 'Registrar manualmente' },
      { cenario: 'Despachante indisponível', acao: 'Registrar e escalonar ao supervisor' },
    ],
    oportunidadesMelhoriaNotas: ['Integração automática CRM → Contrato', 'Integração CRM → Revisão', 'Padronização digital do cartão'],
  },

  {
    id: 'protocolo-fechamento-conducao-final-negociacao',
    categoria: 'Protocolos Comerciais',
    nome: 'Fechamento & Condução Final da Negociação',
    ordem: 3,
    objetivo:
      'Garantir que o cliente chegue ao fechamento com o mínimo de atrito possível, reforçando benefícios, conduzindo emocionalmente a negociação e convertendo o interesse em assinatura efetiva do contrato.',
    resultadoEsperado: ['Cliente recebido', 'Veículo enviado para preparação final', 'Contrato finalizado', 'Negociação reafirmada', 'Objeções neutralizadas', 'Venda concluída', 'Cliente encaminhado para entrega'],
    responsaveis: ['Vendedor responsável', 'Supervisor Comercial', 'Coordenador Comercial', 'Equipe de Preparação', 'Gerente Comercial'],
    processo: [
      'Cliente chega à loja',
      'Recepção inicial',
      'Motocicleta enviada para preparação final',
      'Vendedor revisa negociação no CRM',
      'Reforço dos benefícios da compra',
      'Confirmação dos detalhes negociados',
      'Finalização contratual',
      'Validação de documentos finais',
      'Tratamento de objeções',
      'Assinatura',
      'Pagamento',
      'Encaminhamento para entrega',
    ],
    pop: [
      { titulo: 'Recepcionar cliente' },
      { titulo: 'Confirmar chegada no CRM' },
      {
        titulo: 'Encaminhar motocicleta para preparação final',
        descricao: 'REALIZAR UM VÍDEO DE COMO A MOTO FOI PARA A OFICINA!',
        checklist: ['Peças', 'Elétrica', 'Mecânica'],
      },
      { titulo: 'Abrir resumo da negociação' },
      { titulo: 'Reforçar benefícios', descricao: 'Condições negociadas, vantagens obtidas, oportunidade, ganhos do cliente.' },
      { titulo: 'Confirmar dados finais' },
      { titulo: 'Finalizar contrato' },
      { titulo: 'Solicitar assinatura' },
      { titulo: 'Encaminhar para entrega' },
    ],
    regras: [
      'Nunca reiniciar negociação já aprovada.',
      'Foco em confirmação e reforço.',
      'Nunca apresentar novas dificuldades ao cliente.',
      'Benefícios obrigatoriamente reforçados.',
      'Contrato deve chegar previamente preenchido.',
      'Objeções devem ser registradas no CRM.',
      'Toda venda deve possuir plano de contingência.',
    ],
    ferramentas: ['CRM', 'Sistema contratual', 'WhatsApp', 'Telefone', 'Sistema financeiro', 'Checklist de entrega'],
    rotina: [
      { chave: 'Diária', valor: 'Fechamentos. Atualização CRM. Registro de objeções.' },
      { chave: 'Semanal', valor: 'Revisão de objeções.' },
      { chave: 'Mensal', valor: 'Análise de conversão.' },
    ],
    sla: [
      { item: 'Recepção', prazo: 'Até 2 minutos' },
      { item: 'Preparação final', prazo: 'Até 20 minutos' },
      { item: 'Contrato', prazo: 'Até 10 minutos' },
      { item: 'Tempo total em loja', prazo: 'Máximo 40 minutos' },
    ],
    kpis: [
      { categoria: 'Conversão', indicador: 'Taxa de fechamento' },
      { categoria: 'Tempo', indicador: 'Tempo médio de fechamento' },
      { categoria: 'Eficiência', indicador: 'Tempo médio de permanência' },
      { categoria: 'Qualidade', indicador: 'Taxa de contratos corretos' },
      { categoria: 'Comercial', indicador: 'Ticket médio' },
    ],
    auditoriaItens: ['CRM atualizado', 'Contrato preenchido', 'Objeções registradas', 'Tempo de atendimento', 'Benefícios apresentados'],
    frequenciaAuditoria: 'Diária',
    criteriosConformidade: ['Cliente recepcionado', 'Contrato atualizado', 'Benefícios apresentados', 'Objeções registradas', 'Assinatura realizada', 'CRM atualizado'],
    naoConformidadesCatalogo: ['Contrato incompleto', 'Benefícios não apresentados', 'Objeções não registradas', 'Tempo excedido', 'CRM desatualizado'],
    reunioes: [
      { chave: 'Acompanhamento operacional', valor: 'Diário' },
      { chave: 'Semanal', valor: 'Análise de perdas' },
      { chave: 'Mensal', valor: 'Análise de indicadores' },
      { chave: 'Trimestral', valor: 'Planejamento estratégico' },
    ],
    perguntasAnalise: ['Onde a venda foi perdida?', 'Qual objeção mais apareceu?', 'Qual barreira gerou maior impacto?', 'O que atrasou fechamento?'],
    riscos: ['Cliente mudar de ideia', 'Aumento de objeções', 'Falha documental', 'Demora operacional', 'Erro contratual'],
    planoContingencia: [
      { cenario: 'Cliente inseguro', acao: 'Retornar benefícios previamente acordados' },
      { cenario: 'Cliente com objeção financeira', acao: 'Apresentar alternativas aprovadas' },
      { cenario: 'Documento inconsistente', acao: 'Acionar administrativo imediatamente' },
      { cenario: 'Atraso operacional', acao: 'Supervisor assume acompanhamento' },
    ],
  },

  {
    id: 'protocolo-entrega-tecnica-documental-probatoria',
    categoria: 'Protocolos Comerciais',
    nome: 'Entrega Técnica, Documental e Probatória do Veículo',
    ordem: 4,
    objetivo:
      'Garantir que toda entrega de motocicleta seja realizada com respaldo operacional, técnico, documental e jurídico, reduzindo riscos futuros, prevenindo conflitos e assegurando transparência total para a empresa e para o cliente.',
    resultadoEsperado: [
      'Veículo entregue',
      'Documentação entregue',
      'Garantias formalizadas',
      'Histórico de manutenção entregue',
      'Evidências registradas',
      'Responsabilidades transferidas',
      'CRM atualizado',
      'Cliente orientado sobre funcionamento e garantias',
    ],
    responsaveis: ['Executor: Consultor/Vendedor responsável', 'Supervisor Comercial', 'Equipe Administrativa', 'Equipe de Manutenção', 'Despachante', 'Gerente Comercial'],
    processo: [
      'Venda concluída',
      'Contrato aprovado',
      'Preparação final do veículo',
      'Conferência documental',
      'Conferência técnica',
      'Separação do Kit de Entrega',
      'Gravação do vídeo de respaldo',
      'Assinaturas obrigatórias',
      'Explicação ao cliente',
      'Entrega física',
      'Atualização CRM',
    ],
    pop: [
      { titulo: 'Separar documentação obrigatória' },
      { titulo: 'Separar itens físicos obrigatórios' },
      { titulo: 'Conferir garantias' },
      { titulo: 'Conferir histórico completo de manutenção' },
      { titulo: 'Conferir checklist técnico' },
      { titulo: 'Gravar vídeo de respaldo' },
      { titulo: 'Coletar assinaturas' },
      { titulo: 'Explicar documentação' },
      { titulo: 'Entregar motocicleta' },
      { titulo: 'Atualizar CRM' },
    ],
    regras: [
      'Nenhuma motocicleta poderá ser entregue sem vídeo de respaldo.',
      'Nenhuma motocicleta poderá ser entregue sem checklist técnico.',
      'Toda manutenção executada deverá possuir comprovante.',
      'Toda garantia deverá possuir documentação.',
      'Todos os documentos deverão possuir duas vias.',
      'CRM deverá ser atualizado imediatamente.',
      'Cliente deverá receber orientação completa.',
    ],
    ferramentas: ['CRM', 'Sistema contratual', 'Sistema administrativo', 'WhatsApp', 'Banco de arquivos', 'Câmera/Smartphone', 'Checklist físico ou digital'],
    rotina: [
      { chave: 'Diária', valor: 'Conferência de entregas. Atualização CRM. Organização documental.' },
      { chave: 'Semanal', valor: 'Conferência de vídeos. Auditoria documental.' },
      { chave: 'Mensal', valor: 'Revisão de falhas.' },
    ],
    sla: [
      { item: 'Separação documental', prazo: 'Até 15 minutos' },
      { item: 'Checklist técnico', prazo: 'Até 15 minutos' },
      { item: 'Gravação do vídeo', prazo: 'Até 10 minutos' },
      { item: 'Tempo máximo do processo completo', prazo: 'Até 40 minutos' },
    ],
    kpis: [
      { categoria: 'Volume', indicador: 'Quantidade de entregas' },
      { categoria: 'Eficiência', indicador: 'Tempo médio de entrega' },
      { categoria: 'Qualidade', indicador: 'Percentual de entregas completas' },
      { categoria: 'Operacional', indicador: 'Quantidade de erros encontrados' },
      { categoria: 'Pós-venda', indicador: 'Reclamações por entrega' },
    ],
    auditoriaItens: ['Documentos entregues', 'Assinaturas', 'Garantias', 'Histórico de manutenção', 'Vídeo registrado', 'CRM atualizado'],
    frequenciaAuditoria: 'Diária',
    criteriosConformidade: ['Documentação completa', 'Garantias entregues', 'Histórico de manutenção entregue', 'Vídeo realizado', 'Assinaturas coletadas', 'CRM atualizado'],
    naoConformidadesCatalogo: ['Documento faltando', 'Garantia não entregue', 'Vídeo inexistente', 'Assinaturas ausentes', 'CRM desatualizado', 'Checklist incompleto'],
    reunioes: [
      { chave: 'Acompanhamento operacional', valor: 'Diário' },
      { chave: 'Semanal', valor: 'Análise de falhas' },
      { chave: 'Mensal', valor: 'Análise de indicadores' },
    ],
    perguntasAnalise: ['Qual erro ocorreu na entrega?', 'Qual item mais gera retrabalho?', 'Onde surgem reclamações?', 'Quais garantias geram maior acionamento?'],
    riscos: ['Falta de documento', 'Garantia ausente', 'Informações divergentes', 'Reclamação futura', 'Questionamento técnico'],
    planoContingencia: [
      { cenario: 'Documento ausente', acao: 'Emitir segunda via imediatamente' },
      { cenario: 'Garantia ausente', acao: 'Acionar fornecedor/oficina' },
      { cenario: 'Falha no vídeo', acao: 'Realizar nova gravação' },
      { cenario: 'Sistema indisponível', acao: 'Registrar manualmente' },
    ],
    anexos: [
      {
        titulo: 'Kit Obrigatório de Entrega — Documentação',
        itens: [
          'Contrato de venda — 2 vias',
          'Procuração para transferência — 2 vias',
          'Termo de garantia da loja (motos de pátio)',
          'CRLV (documento da motocicleta) — 2 vias',
          'Comprovante de pagamento do selo — 2 vias (quando aplicável)',
        ],
      },
      {
        titulo: 'Kit Obrigatório de Entrega — Manutenção',
        itens: [
          'Manual',
          'Chave reserva',
          'Cartão de manutenção detalhado (manutenções realizadas, peças substituídas, data das intervenções, oficina responsável)',
          'Comprovante da oficina — 2 vias',
          'Assinatura da oficina',
          'Assinatura da empresa',
          'Garantia da bateria',
          'Cópia da garantia arquivada internamente',
        ],
      },
      {
        titulo: 'Kit Obrigatório de Entrega — Respaldo em Vídeo (gravação obrigatória contendo)',
        itens: [
          'Luz de freio', 'Piscas', 'Lanternas', 'Chassi', 'Pneus', 'Disco', 'Painel e quilometragem (KM)',
          'Buzina', 'Rodas/Raios', 'Retrovisores', 'Placa', 'Retentores',
          'Verificação visual de fumaça no escapamento', 'Estado geral da motocicleta',
        ],
      },
    ],
  },

  {
    id: 'protocolo-transferencia-propriedade-veiculo',
    categoria: 'Protocolos Comerciais',
    nome: 'Transferência de Propriedade do Veículo',
    ordem: 5,
    objetivo:
      'Garantir que toda transferência de veículo seja realizada de forma segura, organizada, rastreável e dentro dos prazos estabelecidos, assegurando conformidade documental, jurídica e operacional.',
    resultadoEsperado: [
      'ATPV emitida',
      'Vistoria realizada',
      'Boleto solicitado e pago',
      'Processo protocolado no DETRAN',
      'Documento atualizado emitido',
      'Documento entregue ao novo proprietário',
      'Processo encerrado no CRM',
    ],
    responsaveis: ['Executor Inicial: Consultor/Vendedor responsável pela venda', 'Despachante', 'Supervisor Comercial', 'Gerente Comercial'],
    processo: [
      'Venda concluída',
      'Separação imediata do orçamento de transferência',
      'Envio para conta específica de transferência',
      'Solicitação ATPV',
      'ATPV emitida',
      'Responsabilidade transferida ao vendedor',
      'Cliente realiza vistoria',
      'Cliente entrega laudo ao vendedor',
      'Vendedor entrega laudo ao despachante',
      'Solicitação do boleto de transferência',
      'Pagamento do boleto',
      'Solicitação de atendimento junto ao DETRAN',
      'DETRAN processa solicitação',
      'Novo documento emitido',
      'Responsabilidade retorna ao vendedor',
      'Entrega do documento ao proprietário',
      'Encerramento do processo',
    ],
    pop: [
      { titulo: 'Separar imediatamente valor da transferência', descricao: 'Valor estimado: R$ 800 – R$ 1.000' },
      { titulo: 'Transferir valor para conta exclusiva de transferência' },
      { titulo: 'Solicitar ATPV', descricao: 'Prazo médio: 1 dia. Responsável: Despachante.' },
      { titulo: 'Encaminhar responsabilidade ao vendedor' },
      { titulo: 'Solicitar ao cliente realização da vistoria' },
      { titulo: 'Receber laudo' },
      { titulo: 'Entregar laudo ao despachante' },
      { titulo: 'Solicitar boleto de transferência' },
      { titulo: 'Efetuar pagamento' },
      { titulo: 'Solicitar protocolo junto ao DETRAN' },
      { titulo: 'Receber novo documento' },
      { titulo: 'Entregar documento ao cliente' },
      { titulo: 'Atualizar CRM' },
    ],
    regras: [
      'Toda venda deverá separar orçamento imediatamente.',
      'Valores deverão permanecer em conta exclusiva.',
      'ATPV obrigatória.',
      'Laudo obrigatório.',
      'Nenhuma etapa poderá avançar sem encerramento da anterior.',
      'Toda mudança de responsabilidade deverá ser registrada.',
      'CRM deverá ser atualizado em cada etapa.',
    ],
    ferramentas: ['CRM', 'Sistema interno', 'Sistema do despachante', 'Portal DETRAN', 'WhatsApp', 'Telefonia', 'Conta financeira exclusiva'],
    rotina: [
      { chave: 'Diária', valor: 'Acompanhamento dos processos abertos. Atualização CRM. Cobrança de pendências.' },
      { chave: 'Semanal', valor: 'Conferência dos processos.' },
      { chave: 'Mensal', valor: 'Revisão de atrasos.' },
    ],
    sla: [
      { item: 'Separação do orçamento', prazo: 'Imediata' },
      { item: 'ATPV', prazo: 'Até 1 dia' },
      { item: 'Recebimento do laudo da vistoria', prazo: 'Até 7 dias após solicitação' },
      { item: 'Solicitação do boleto', prazo: 'Até 2 dias' },
      { item: 'Entrega do documento', prazo: 'Conforme prazo do DETRAN' },
    ],
    kpis: [
      { categoria: 'Volume', indicador: 'Quantidade de transferências' },
      { categoria: 'Eficiência', indicador: 'Tempo médio de transferência' },
      { categoria: 'Qualidade', indicador: 'Percentual de processos sem erro' },
      { categoria: 'Operacional', indicador: 'Quantidade de pendências' },
      { categoria: 'Financeiro', indicador: 'Custo médio por transferência' },
    ],
    auditoriaItens: ['Reserva financeira realizada', 'ATPV emitida', 'Laudo recebido', 'Boleto pago', 'Protocolo DETRAN', 'Documento entregue', 'CRM atualizado'],
    frequenciaAuditoria: 'Diária',
    criteriosConformidade: ['Valor reservado', 'ATPV emitida', 'Laudo entregue', 'Boleto pago', 'Processo protocolado', 'Documento entregue', 'CRM atualizado'],
    naoConformidadesCatalogo: ['ATPV não emitida', 'Falta de laudo', 'Pagamento pendente', 'Processo parado', 'Documento ausente', 'CRM desatualizado'],
    reunioes: [
      { chave: 'Acompanhamento operacional', valor: 'Diário' },
      { chave: 'Semanal', valor: 'Análise de processos travados' },
      { chave: 'Mensal', valor: 'Indicadores' },
      { chave: 'Trimestral', valor: 'Planejamento' },
    ],
    perguntasAnalise: ['Onde ocorreu atraso?', 'Qual etapa gera maior gargalo?', 'Qual impeditivo mais ocorre?', 'Quanto tempo cada processo permanece aberto?'],
    riscos: ['Pendência judicial', 'Pendência administrativa', 'Processo aberto', 'Licenciamento atrasado', 'Gravame', 'Falta de documentos', 'Comunicação de venda ativa'],
    planoContingencia: [
      {
        cenario: 'ATPV — impedimentos (comunicação de venda, bloqueio judicial, bloqueio administrativo)',
        acao: 'Acionar despachante imediatamente.',
      },
      {
        cenario: 'Boleto de transferência — impedimentos (processo aberto, licenciamento pendente, ARC digital, veículo usado como empréstimo, gravame, falta documental)',
        acao: 'Escalar para administrativo + despachante.',
      },
    ],
    anexos: [
      {
        titulo: 'Checklist Obrigatório de Transferência',
        itens: [
          'Valor reservado', 'ATPV emitida', 'Cliente acionado', 'Vistoria realizada', 'Laudo recebido',
          'Laudo entregue ao despachante', 'Boleto solicitado', 'Boleto pago', 'Solicitação DETRAN realizada',
          'Documento emitido', 'Documento entregue', 'CRM encerrado',
        ],
      },
    ],
  },
]
