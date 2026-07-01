# ADR-0007 — Ignorar um Alerta é uma Decisão Formal Registrada

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0007 |
| **Título** | Desconsiderar um Alerta Exige Decisão Explícita D2 com Justificativa Registrada |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENG-03, ENG-11, ENG-06 |

---

## Contexto

Em qualquer sistema de alertas, o comportamento padrão quando um alerta não é tratado é: silêncio. O responsável não age, o alerta permanece ativo, o sistema continua registrando a situação, mas ninguém sabe se o responsável (a) não viu, (b) viu e está tratando, (c) viu e decidiu que não é necessário agir, ou (d) viu e está procrastinando.

Esse silêncio é ambíguo e perigoso. Ambíguo porque não revela intenção. Perigoso porque cria a ilusão de que alertas estão sendo gerenciados quando podem estar sendo simplesmente ignorados.

A maioria dos sistemas de gestão, CRMs e ERPs trata o não-tratamento de alertas como "pending" indefinidamente. Isso significa que alertas que foram conscientemente avaliados como irrelevantes ocupam o mesmo espaço que alertas que nunca foram vistos — e ninguém consegue distinguir entre os dois casos.

---

## Decisão

Desconsiderar formalmente um alerta no Commercial OS é uma **decisão de nível mínimo D2** (gestor), com os seguintes requisitos obrigatórios:

```yaml
ignorar_alerta:
  alerta_id: "[UUID]"
  responsavel_decisao_id: "[ID]"
  nivel_decisao: "D2"
  justificativa: "[mínimo 50 caracteres]"
  condicao_de_revisao: "[quando este alerta será reavaliado]"
  aprovador_id: "[ID do gestor que aprovou]"
  registrado_em: "[timestamp]"
```

O alerta permanece no histórico com status `DESCONSIDERADO_FORMALMENTE` e é incluído na próxima auditoria para revisão. Silêncio — não agir e não registrar — não é uma opção válida. O Motor de Escalonamento da ENG-11 trata silêncio como omissão e escala automaticamente.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Alertas "fecham" automaticamente após N dias sem ação | Masca o problema; incentiva procrastinação; perde rastreabilidade de alertas que deveriam ter sido tratados |
| Qualquer responsável pode descartar alertas sem justificativa | Sem accountability; impossível auditar se decisão foi correta; cria cultura de descarte irresponsável |
| Alertas podem ser silenciados por categoria (mute) | Mute coletivo esconde problemas sistemáticos; um alerta legítimo pode ser silenciado junto com os ruidosos |

---

## Consequências Positivas

- **Accountability completo:** toda decisão de não agir tem um responsável, uma justificativa e uma condição de revisão
- **Auditabilidade:** alertas desconsiderados aparecem na auditoria; padrão de descarte pode revelar problemas na configuração de alertas (muito ruído) ou na cultura de gestão (descarte sem critério)
- **Diferenciação clara:** o sistema distingue entre "não vi", "estou tratando" e "decidi não tratar"; três estados com respostas operacionais diferentes
- **Pressão positiva:** o custo de registrar formalmente incentiva que apenas alertas genuinamente irrelevantes sejam desconsiderados

## Trade-offs Aceitos

- **Fricção deliberada:** desconsiderar um alerta custa mais do que simplesmente ignorá-lo; essa fricção é intencional — é o preço da accountability
- **D2 mínimo para descartar:** gestores precisam estar envolvidos em qualquer decisão de não agir; isso pode parecer overhead, mas é exatamente a supervisão que o sistema precisa para funcionar
