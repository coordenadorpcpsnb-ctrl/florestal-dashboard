# Checklist de substituição de fontes de mercado

> **Documento público.** Este arquivo não contém, e não deve nunca conter,
> credenciais, chaves, tokens, senhas, URLs privadas, pareceres jurídicos
> completos, valores comerciais internos, dados de compra, nomes de
> fornecedores de formulados, composição de formulações ou qualquer dado
> confidencial. Evidências confidenciais (contratos, e-mails jurídicos,
> preços negociados) ficam em ambiente corporativo privado — aqui entra
> apenas referência sanitizada a essas evidências, nunca o conteúdo.
>
> Este checklist **não substitui parecer jurídico, avaliação de segurança ou
> aprovação formal da organização**. É um instrumento operacional de
> contingência: registra, de forma padronizada, a avaliação de uma fonte
> candidata quando a fonte atual de um indicador apresenta problema — nunca
> executa, sozinho, uma substituição.

## 1. Objetivo

Este arquivo documenta candidatas para eventual substituição das fontes
atualmente usadas pela pipeline (`fetch-data.mjs`, `fetch-fertilizers.mjs`),
para os casos em que a fonte atual de um indicador fique:

- indisponível;
- bloqueada;
- descontinuada;
- metodologicamente alterada;
- com licença alterada;
- com qualidade reduzida;
- sem histórico suficiente;
- ou quando surgir necessidade de maior rastreabilidade.

**Preencher este checklist não altera nenhuma fonte, nenhum coletor e nenhum
fallback.** Nenhuma linha da matriz da seção 6, e nenhum modelo preenchido a
partir da seção 7, autoriza por si só qualquer mudança de código — isso é
sempre uma etapa separada (seção 3 e seção 8).

## 2. Como utilizar

1. Ao identificar um motivo de avaliação (seção 4) para um indicador, copie o
   modelo individual da seção 7 para um novo registro (neste arquivo, num
   documento interno vinculado, ou numa issue — o que a equipe já usa para
   rastrear trabalho).
2. Preencha os campos textuais e marque os checkboxes conforme cada etapa é
   concluída, seguindo a ordem do fluxo:

   ```
   FONTE CANDIDATA
   → AVALIAÇÃO DOCUMENTAL
   → TESTE LOCAL
   → EXECUÇÃO EM PARALELO
   → COMPARAÇÃO
   → APROVAÇÃO HUMANA
   → PLANO DE SUBSTITUIÇÃO
   → ALTERAÇÃO DE CÓDIGO EM ETAPA SEPARADA
   ```

3. Atualize o `Status` (seção 3) conforme o registro avança. Um status mais
   avançado nunca é presumido — cada transição exige o preenchimento dos
   campos e checkboxes da etapa correspondente.
4. Atualize a linha correspondente na matriz resumida (seção 6) quando o
   status de uma candidata mudar.
5. Só depois de `APROVADA_PARA_SUBSTITUICAO` (seção 8) uma etapa separada de
   alteração de código pode ser aberta — e essa etapa é quem efetivamente
   muda `fetch-data.mjs`/`fetch-fertilizers.mjs`, nunca este documento.
6. Ao concluir (ou rejeitar) uma substituição que chegou a alterar código,
   registre o resultado na tabela da seção 10 — sem dados fictícios.

## 3. Status permitidos

Usar somente estes seis valores, em qualquer registro deste checklist:

- `PENDENTE`
- `EM_AVALIACAO`
- `APROVADA_PARA_TESTE`
- `APROVADA_COM_RESTRICOES`
- `APROVADA_PARA_SUBSTITUICAO`
- `REJEITADA`

**Somente `APROVADA_PARA_SUBSTITUICAO` permite abrir uma etapa separada de
alteração do código.** Nenhum outro status — nem `APROVADA_PARA_TESTE`, nem
`APROVADA_COM_RESTRICOES` — autoriza, sozinho, qualquer mudança em
`fetch-data.mjs`, `fetch-fertilizers.mjs` ou em qualquer outro coletor. Ver
definições completas na seção 8.

## 4. Motivos para iniciar uma avaliação

Usar um (ou mais) destes valores para justificar a abertura de um registro:

- `FONTE_INDISPONIVEL`
- `FALHAS_RECORRENTES`
- `BLOQUEIO_DE_ACESSO`
- `FONTE_DESCONTINUADA`
- `ALTERACAO_METODOLOGICA`
- `ALTERACAO_DE_UNIDADE`
- `ALTERACAO_DE_LICENCA`
- `HISTORICO_INSUFICIENTE`
- `DATA_DE_REFERENCIA_INADEQUADA`
- `MAIOR_RASTREABILIDADE`
- `MELHORIA_DE_QUALIDADE`
- `OUTRO` (descrever no campo "Motivo" do modelo individual)

## 5. Critérios mínimos de substituição

Antes de qualquer substituição real de fonte, a candidata precisa ter, no
mínimo, todos os itens abaixo — não apenas alguns:

- indicador claramente identificado;
- unidade identificada;
- data econômica identificada;
- granularidade conhecida;
- metodologia documentada;
- histórico avaliado;
- acesso testado;
- falha tratável;
- comparação com a fonte atual;
- aprovação técnica;
- avaliação de governança;
- plano de reversão.

Ver também os critérios de bloqueio (seção 9), que impedem a substituição
mesmo que parte destes itens já esteja atendida.

## 6. Matriz resumida das fontes

Pré-preenchida apenas com os indicadores e candidatas já identificados nas
Etapas 6/6.1/6.2 (`docs/market-history-sources-assessment.md`) — **nenhuma
candidata abaixo está aprovada**. "Fonte atual" refere-se à cadeia já
documentada na seção 6 do `README.md` (fonte primária + fallbacks), não a um
único endpoint.

| Indicador | Fonte atual | Fonte candidata | Status | Motivo da avaliação | Compatibilidade técnica | Governança | Decisão | Data da decisão | Observação |
|---|---|---|---|---|---|---|---|---|---|
| Dólar | Cadeia atual documentada no README (seção 6) | BCB SGS (histórico) | `PENDENTE` | `MAIOR_RASTREABILIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | Mesmo órgão da fonte atual (BCB); ver `docs/market-history-sources-assessment.md`, seção 35 |
| Ureia | ComexStat | World Bank (Pink Sheet) ou outra referência oficialmente aprovada | `PENDENTE` | `MAIOR_RASTREABILIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | **World Bank não deve ser descrito como equivalente ao ComexStat** — praças/condições comerciais diferentes (seção 27 do documento de avaliação) |
| MAP | ComexStat | World Bank (Pink Sheet) ou outra referência oficialmente aprovada | `PENDENTE` | `MAIOR_RASTREABILIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | Mesma ressalva da ureia — não tratar como equivalente ao ComexStat |
| KCl | ComexStat | World Bank (Pink Sheet) ou outra referência oficialmente aprovada | `PENDENTE` | `MAIOR_RASTREABILIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | Mesma ressalva da ureia — não tratar como equivalente ao ComexStat |
| BDI/frete marítimo | Cadeia atual documentada no README (seção 6) | Baltic Exchange ou outra fonte licenciada | `PENDENTE` | `MELHORIA_DE_QUALIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | Baltic Exchange sem decisão nesta etapa (`SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` no documento de avaliação). **BDI não deve ser descrito como frete específico de fertilizante** — é um índice de frete a granel em geral. |
| Gás natural | Cadeia atual documentada no README (seção 6) | FRED ou World Bank, apenas como referências a avaliar | `PENDENTE` | `MAIOR_RASTREABILIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | Henry Hub (já usado) é referência regional — não deve ser descrito como custo direto do gás de todos os produtores de fertilizantes |
| Soja nacional | Cadeia atual documentada no README (seção 6) | CEPEA direto ou CONAB, respeitando diferenças metodológicas | `PENDENTE` | `MAIOR_RASTREABILIDADE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | **CONAB não deve ser descrita automaticamente como equivalente ao CEPEA** — produtos metodologicamente diferentes |
| Soja regional | Cadeia atual documentada no README (seção 6) | SEAGRO-TO ou outra fonte institucional confirmada | `PENDENTE` | `HISTORICO_INSUFICIENTE` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | — | — | **SEAGRO-TO continua como pista até confirmação documental** — não é fonte candidata aprovada. **Soja nacional não deve substituir soja regional.** |

**Nenhuma candidata desta tabela está aprovada para uso.** As colunas
"Compatibilidade técnica" e "Governança" ficam `NAO_VERIFICADO` até que um
registro individual (seção 7) seja aberto e preenchido; "Decisão" e "Data da
decisão" ficam vazias (`—`) até que exista uma decisão final registrada
(seção 7, "Decisão final").

## 7. Modelo individual de avaliação

Copie o bloco abaixo (do `### Identificação` até o fim do `### Decisão
final`) para abrir um novo registro de avaliação. Não inclua valores reais
nos campos quantitativos até que o teste correspondente seja realmente
executado.

---

### Identificação

- [ ] Indicador informado
- [ ] Fonte atual informada
- [ ] Fonte candidata informada
- [ ] Motivo da avaliação informado
- [ ] Responsável técnico definido
- [ ] Data de início informada

Campos textuais:

```
Indicador:
Fonte atual:
Fonte candidata:
Motivo:
Status:
Data de abertura:
Responsável técnico:
Referência interna:
```

### Documentação da candidata

- [ ] Instituição responsável identificada
- [ ] Página oficial identificada
- [ ] Documentação técnica localizada
- [ ] Metodologia localizada
- [ ] Termos de uso localizados
- [ ] Licença localizada
- [ ] Unidade documentada
- [ ] Periodicidade documentada
- [ ] Cobertura histórica documentada
- [ ] Data econômica documentada

Campos:

```
Instituição:
Documento oficial:
URL oficial:
Identificador da série:
Unidade:
Periodicidade:
Cobertura histórica:
referenceDate ou referencePeriod:
Metodologia:
Status de verificação:
```

### Comparabilidade

- [ ] Mede o mesmo indicador
- [ ] Mesma praça ou mercado
- [ ] Mesma condição comercial
- [ ] Unidade compatível
- [ ] Conversão documentada, quando necessária
- [ ] Frequência compatível
- [ ] Data econômica compatível
- [ ] Metodologia comparável
- [ ] Revisões históricas compreendidas
- [ ] Diferenças conhecidas registradas

Campos:

```
Diferenças em relação à fonte atual:
Conversões necessárias:
Riscos de comparação:
Limitações:
```

### Teste técnico

- [ ] Acesso testado localmente
- [ ] Autenticação testada
- [ ] Limite de requisições avaliado
- [ ] Estrutura de retorno documentada
- [ ] Tratamento de valor ausente avaliado
- [ ] Tratamento de erro avaliado
- [ ] Tratamento de timeout avaliado
- [ ] Histórico testado
- [ ] Data econômica preservada
- [ ] Unidade original preservada

Campos:

```
Ambiente do teste:
Data do teste:
Resultado do acesso:
Formato retornado:
Campos disponíveis:
Falhas encontradas:
Observações:
```

### Execução em paralelo

- [ ] Fonte atual mantida como oficial durante o teste
- [ ] Candidata executada sem substituir a atual
- [ ] Período mínimo de comparação definido
- [ ] Diferenças calculadas
- [ ] Ausências comparadas
- [ ] Datas de referência comparadas
- [ ] Unidades comparadas
- [ ] Eventos de falha registrados
- [ ] Mudanças metodológicas avaliadas
- [ ] Resultado revisado por responsável técnico

Campos:

```
Período de comparação:
Quantidade de observações:
Diferença média:
Maior diferença:
Observações ausentes:
Inconsistências:
Conclusão da comparação:
```

**Durante toda a execução em paralelo, a fonte atual permanece a fonte
oficial em produção.** A candidata roda apenas ao lado, sem substituir nada
— nenhum status desta seção autoriza uso em produção.

### Governança

- [ ] Automação avaliada
- [ ] Armazenamento interno avaliado
- [ ] Redistribuição avaliada
- [ ] Publicação avaliada
- [ ] Necessidade de cadastro avaliada
- [ ] Necessidade de chave avaliada
- [ ] Custo avaliado
- [ ] Restrições registradas
- [ ] Aprovação técnica registrada
- [ ] Aprovação de governança registrada

Campos (enquanto não preenchidos, usar `PENDENTE_DE_PREENCHIMENTO`):

```
Automação: PENDENTE_DE_PREENCHIMENTO
Armazenamento interno: PENDENTE_DE_PREENCHIMENTO
Redistribuição: PENDENTE_DE_PREENCHIMENTO
Publicação: PENDENTE_DE_PREENCHIMENTO
Cadastro: PENDENTE_DE_PREENCHIMENTO
Chave: PENDENTE_DE_PREENCHIMENTO
Custo: PENDENTE_DE_PREENCHIMENTO
Restrições: PENDENTE_DE_PREENCHIMENTO
Decisão técnica: PENDENTE_DE_PREENCHIMENTO
Decisão de governança: PENDENTE_DE_PREENCHIMENTO
Evidência arquivada: PENDENTE_DE_PREENCHIMENTO
```

### Riscos e contingência

- [ ] Risco de indisponibilidade avaliado
- [ ] Risco de mudança metodológica avaliado
- [ ] Risco de mudança de unidade avaliado
- [ ] Risco de descontinuação avaliado
- [ ] Risco de bloqueio avaliado
- [ ] Fallback definido
- [ ] Plano de reversão definido
- [ ] Critério para retornar à fonte anterior definido

Campos:

```
Riscos:
Fallback:
Plano de reversão:
Critério de reversão:
Responsável pela reversão:
```

### Decisão final

Campos:

```
Status final:
Decisão:
Justificativa:
Restrições:
Data da decisão:
Aprovação técnica:
Aprovação de governança:
Autorização para alteração do código:
Issue ou referência da futura alteração:
```

Checklist final:

- [ ] Documentação concluída
- [ ] Comparabilidade aprovada
- [ ] Teste técnico aprovado
- [ ] Execução paralela aprovada
- [ ] Governança aprovada
- [ ] Contingência definida
- [ ] Alteração de código autorizada

---

## 8. Regras de decisão

- **`PENDENTE`**: avaliação ainda não iniciada ou incompleta.
- **`EM_AVALIACAO`**: documentação ou teste em andamento.
- **`APROVADA_PARA_TESTE`**: pode participar de teste local ou paralelo; **não
  substitui a fonte atual; não autoriza produção; não autoriza publicação.**
- **`APROVADA_COM_RESTRICOES`**: tecnicamente adequada, mas possui
  restrições; as restrições devem ser registradas (campo "Restrições" da
  seção de Governança e da Decisão final); **não substitui automaticamente a
  fonte atual.**
- **`APROVADA_PARA_SUBSTITUICAO`**: documentação completa; comparação
  aprovada; governança aprovada; plano de reversão definido. **A alteração do
  código ainda ocorrerá em etapa separada** — este status nunca, por si só,
  modifica `fetch-data.mjs`, `fetch-fertilizers.mjs` ou qualquer coletor.
- **`REJEITADA`**: inadequada para o indicador ou para as condições de uso.

## 9. Critérios de bloqueio

A substituição **deve ser bloqueada** se qualquer um destes itens for
verdadeiro:

- unidade não identificada;
- data econômica não identificada;
- metodologia incompatível;
- praça incompatível;
- condição comercial incompatível;
- licença pendente quando necessária;
- armazenamento não avaliado;
- publicação não avaliada quando aplicável;
- teste paralelo não executado;
- diferenças não compreendidas;
- histórico insuficiente;
- ausência de plano de reversão;
- aprovação humana não registrada.

## 10. Registro de alterações futuras

Tabela vazia — preenchida apenas quando uma substituição real for executada
em etapa separada de código. Nenhum dado fictício foi inserido aqui.

| Data | Indicador | Fonte anterior | Fonte nova | Motivo | Commit | Responsável técnico | Resultado | Reversão necessária | Observação |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

## 11. Segurança e privacidade

Neste checklist (e em qualquer registro individual copiado dele):

- **não registrar** tokens;
- **não registrar** chaves;
- **não registrar** senhas;
- **não registrar** URLs privadas;
- **não registrar** documentos jurídicos completos;
- **não é obrigatório registrar pessoas** — o campo "Responsável técnico"
  pode usar um papel/função ou identificador interno em vez de nome próprio;
- **não registrar** valores comerciais internos;
- **não registrar** dados de formulados (preços, fornecedores, composição);
- evidências confidenciais (contratos, e-mails jurídicos, telas de sistemas
  internos) ficam guardadas em ambiente corporativo privado — este
  repositório é público;
- usar aqui apenas **referência sanitizada** a essas evidências (ex.: "ver
  evidência arquivada internamente, referência X"), nunca o conteúdo.

## 12. Fluxo resumido

```
PENDENTE
→ EM_AVALIACAO
→ APROVADA_PARA_TESTE
→ TESTE_EM_PARALELO
→ APROVADA_COM_RESTRICOES ou REJEITADA
→ APROVADA_PARA_SUBSTITUICAO
→ NOVA_ETAPA_DE_CODIGO
```

**Não existe substituição automática em nenhum ponto deste fluxo.** Cada seta
representa uma decisão humana registrada, nunca uma ação automática deste
documento ou de qualquer script. A "NOVA_ETAPA_DE_CODIGO" final é, ela
mesma, um trabalho separado — com seu próprio plano, testes e commit —, não
uma consequência automática de `APROVADA_PARA_SUBSTITUICAO`.
