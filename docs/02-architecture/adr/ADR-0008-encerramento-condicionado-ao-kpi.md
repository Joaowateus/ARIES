# ADR-0008 — Encerramento de Incidente Condicionado ao Retorno do KPI à Meta

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0008 |
| **Título** | Incidente Só Pode ser Encerrado Quando KPI Retornou a ≥ 90% da Meta |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENG-05, ENG-11, ENG-06 |

---

## Contexto

O padrão mais comum de gerenciamento de incidentes em empresas é: um problema é detectado, uma ação é tomada, a ação é marcada como concluída, o incidente é fechado. O fechamento do incidente é gatilhado pelo fim da ação, não pelo resultado da ação.

Esse padrão cria uma ilusão de resolução. A equipe "resolveu" o problema porque executou a ação planejada. O incidente foi fechado. Mas o KPI original ainda está abaixo da meta. O problema não foi resolvido — foi administrado burocraticamente.

O custo dessa ilusão é alto: métricas de "eficácia de planos de ação" ficam infladas (muitos planos marcados como concluídos, poucos como eficazes), o aprendizado organizacional fica comprometido (não se sabe se a ação funcionou ou não), e o problema pode reaparecer algumas semanas depois — sem que o sistema o reconheça como recorrente.

---

## Decisão

Um incidente no Commercial OS só pode ser encerrado quando **quatro condições são satisfeitas simultaneamente**:

```
CONDIÇÃO 1: Plano de ação associado tem status = ENCERRADO
     E
CONDIÇÃO 2: Verificação de eficácia registrada (EFICAZ / INEFICAZ / PARCIALMENTE_EFICAZ)
     E
CONDIÇÃO 3: KPI afetado retornou a ≥ 90% da meta (ou justificativa formal de por que não)
     E
CONDIÇÃO 4: Motor de Aprendizado registrou o incidente na base de conhecimento
```

Encerramento sem satisfazer todas as 4 condições requer aprovação D3 com justificativa registrada — e mesmo assim, o histórico mostra que o encerramento foi por exceção, não por resolução.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Encerrar quando plano de ação é concluído | Não diferencia ação executada de problema resolvido; incentiva execução performática de ações sem verificação de resultado |
| Encerrar após N dias sem novo alerta | Silêncio de alertas pode significar problema resolvido OU que o threshold de alerta foi ajustado; não é evidência de resolução |
| Encerrar por decisão do responsável sem critério objetivo | Subjetividade; responsável tem incentivo para fechar incidentes (métricas de resolução); critério objetivo remove esse viés |
| Exigir 100% de retorno à meta | Muito rígido; em alguns casos, 90% representa resolução real com variação normal; 100% pode nunca ser atingido por sazonalidade |

---

## Consequências Positivas

- **Eficácia real, não aparente:** o sistema distingue entre "executamos a ação" e "o problema foi resolvido"
- **Aprendizado baseado em evidência:** a classificação de eficácia (EFICAZ/INEFICAZ) é feita com dados do KPI, não com percepção subjetiva
- **Recorrência detectável:** se o mesmo problema aparece após encerramento EFICAZ, o sistema sabe que o plano anterior foi eficaz mas insuficiente — e que a causa raiz é provavelmente mais profunda
- **Métricas de qualidade do sistema de gestão:** a taxa de incidentes encerrados com KPI retornado à meta é um KPI do próprio sistema de gestão

## Trade-offs Aceitos

- **Incidentes ficam abertos mais tempo:** o tempo de ciclo de um incidente aumenta; aceito porque reflete a realidade, não a burocracia
- **KPI pode demorar para recuperar:** algumas ações levam semanas para mostrar resultado; o sistema fica com incidentes abertos nesses períodos; compensado pela visibilidade explícita de "resolução em andamento"
- **Complexidade da exceção:** encerrar por exceção requer D3; isso é intencional — exceções devem ser raras e justificadas
