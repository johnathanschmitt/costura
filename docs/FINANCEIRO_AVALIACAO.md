# Financeiro — Avaliação e Plano de Melhoria

> Avaliação feita em 2026-08-02 sobre o código em `main` (commit `c69e6f5`).
> Objetivo: entender o que já existe, o que está quebrado, **o que é ruído** e o
> que precisa aparecer para o financeiro ajudar de verdade a organizar o ateliê.
>
> **Situação em 2026-08-03: as fases 1 a 5 foram implementadas por inteiro**,
> incluindo conciliação, regra de divisão por mês, taxa e prazo de maquininha,
> permissões em todos os módulos e os primeiros testes automatizados do projeto. O diagnóstico
> abaixo descreve o estado anterior e continua valendo como registro do porquê de
> cada mudança. O que ficou pronto está marcado ✅ no plano (§7).

## Implementado até aqui

| Fase | Entregue |
|---|---|
| **1** ✅ | Categoria na receita (inclusive nos caminhos automáticos) · fonte única de "realizado" (`realized.ts`) usada por Financeiro, Dashboard e Relatórios · gráfico errado removido · **painel de abertura** com dinheiro, mês, projeção com dia crítico, custo fixo, ponto de equilíbrio, ganho por hora e atrasados · **Configurações → Financeiro** · abas viraram rotas agrupadas · ruído removido do DRE, Resultado do Mês e Fluxo de Caixa |
| **2** ✅ | Quem abriu, fechou e lançou cada movimento · **histórico de caixas** · sangria com destino padronizado · **estorno de baixa** (fora de todas as somas, com contrapartida no caixa) · edição de conta em aberto · contagem por cédula e conferência às cegas |
| **3** ✅ | **Contas e saldos** (gaveta, banco, carteira, cofre, reserva) · toda baixa aponta para uma conta · sangria vira "Gaveta → Banco" · transferência entre contas · extrato por conta · painel mostrando o saldo real |
| **4** ✅ | **Percentual configurável** por sócia e do ateliê (soma travada em 100%) · sinais de peças não entregues fora do bolo · prejuízo coberto pela reserva com saldo pendente para o mês seguinte · **retirada por sócia** com baixa · **reserva do ateliê** como conta com saldo e meta |
| **5** ✅ | **Retorno por peça e serviço** (valor por hora) · **aging** de recebíveis com cobrança pelo WhatsApp · anexo de comprovante em contas a pagar · extrato paginado e com busca · **permissões por papel** no módulo · DRE em folha para o contador.<br>Fora: taxa e prazo de cartão (5.6) — o ateliê não usa maquininha (§10) |

---

## 1. Resumo executivo

O módulo financeiro **não é pequeno nem incompleto**: são ~1.500 linhas de serviço
no backend, 27 endpoints e 13 telas. Quase tudo que se pede de um financeiro já
tem alguma implementação — caixa com sangria, contas a receber e a pagar,
parcelamento, DRE, fluxo de caixa, divisão entre as sócias.

**O problema não é falta de funcionalidade. São três coisas:**

1. **Os números não são confiáveis.** Existem três formas diferentes de calcular
   "receita do mês" no sistema, e as três dão resultados diferentes — uma delas
   conta sangria como despesa. A receita nunca recebe categoria, então o DRE
   mostra 100% da entrada como *"Sem categoria"*.
2. **A tela mostra muito e informa pouco.** Sete abas de tabelas e percentuais, e
   nenhuma responde as perguntas que a dona do ateliê faz de verdade: *dá para
   pagar as contas deste mês? posso retirar dinheiro? estou cobrando barato?*
3. **Só a gaveta tem saldo.** PIX, cartão e banco entram como pagamento e não
   somam em lugar nenhum. "Quanto tem hoje" só é respondível para o dinheiro em
   espécie — e a sangria tira da gaveta sem o dinheiro chegar em conta alguma.

O plano deste documento inverte a prioridade: **primeiro os números certos e as
perguntas certas, depois estrutura nova.**

---

## 2. As perguntas que o financeiro precisa responder

Esta é a régua. Toda tela do módulo deveria existir para responder uma delas —
o que não responde nenhuma é ruído e deve sair da frente.

| # | Pergunta do dia a dia | Responde hoje? |
|---|---|---|
| 1 | **Quanto tenho agora, e onde está?** (gaveta, banco, PIX) | ⚠️ só a gaveta |
| 2 | **Quanto ainda tenho a receber, de quem, e o que está atrasado?** | ⚠️ tem a lista, falta o "atrasado há quanto tempo" e o total por cliente |
| 3 | **O que tenho que pagar até o fim do mês — e vai sobrar ou faltar?** | ❌ os dados existem, ninguém faz a conta |
| 4 | **Sobrou quanto este mês, de verdade?** | ⚠️ existe, mas com números divergentes |
| 5 | **Posso retirar dinheiro? Quanto é meu e quanto é do ateliê?** | ⚠️ calcula a divisão, mas não vira saldo nem retirada |
| 6 | **Quanto custa manter o ateliê por mês e quanto preciso faturar para empatar?** | ❌ não existe |
| 7 | **Qual peça/serviço dá mais retorno pelo tempo gasto?** | ❌ não existe (os dados existem: valor da OS + horas estimadas) |
| 8 | **Estou cobrando o suficiente?** (quanto ganho por hora de costura) | ❌ não existe |
| 9 | **Quanto do dinheiro que está na mão ainda não é meu?** (sinais de peças não entregues) | ❌ não existe — e é o erro clássico de gastar sinal como se fosse lucro |
| 10 | **O caixa fechou certo? Quem abriu, quem fechou, deu diferença?** | ⚠️ confere no fechamento, mas o histórico não tem tela e ninguém assina |

**Nenhuma das quatro perguntas que mais mudam decisão (3, 6, 8, 9) é respondida
hoje** — e todas podem ser respondidas com dados que o sistema já tem.

---

## 3. O que é ruído hoje

Coisas que ocupam a tela e não mudam nenhuma decisão. A recomendação é **tirar da
frente** (não apagar o cálculo — mover para um relatório de segundo nível ou para
"ver detalhes"):

| Onde | O que é ruído | Por quê |
|---|---|---|
| DRE | Coluna de **percentual por categoria** | Saber que "Aluguel = 23,4% das despesas" não muda o que se faz. O valor absoluto e a comparação com o mês passado, sim. |
| Resultado do Mês | **"Rateio de cada real recebido"** com percentuais | Reapresenta o DRE de outro jeito, na mesma tela. Duas tabelas para a mesma informação. |
| Resultado do Mês | **Taxa de conversão de orçamentos, ticket médio, produção por costureira** | São indicadores comerciais/produtivos no meio do financeiro. Lugar deles é em Relatórios. |
| Fluxo de Caixa | **"Melhor mês / pior mês"** | Curiosidade histórica, não decisão. |
| Fluxo de Caixa | Extrato completo com 500 linhas de tudo misturado | Ninguém lê. O que se procura é "onde foi parar tal valor" — isso é busca/filtro, não listão. |
| Relatórios | Gráfico **"Receitas x Despesas"** | Além de duplicar o Fluxo de Caixa, está **errado** (conta sangria como despesa e ignora PIX/cartão). Deve sair. |
| Caixa | Cartões separados de "Entradas" e "Saídas" com contagem de lançamentos | O número de lançamentos não serve para nada; o que importa é o esperado na gaveta. |
| Geral | 7 abas no mesmo nível hierárquico | Operação do dia (caixa) e análise do mês (DRE) não são o mesmo tipo de tarefa e não deveriam competir na mesma barra. |

---

## 4. O que deveria estar na tela

Proposta de **painel de abertura** do financeiro — a tela que responde as perguntas
1 a 6 de uma olhada, antes de qualquer tabela:

```
┌─ DINHEIRO HOJE ──────────────────────────────────────────────┐
│  Gaveta  R$ 340,00     Banco  R$ 4.210,00    Total R$ 4.550  │
│  ⚠ R$ 1.200 desse total são sinais de peças não entregues     │
└──────────────────────────────────────────────────────────────┘

┌─ ESTE MÊS (agosto) ──────────────────────────────────────────┐
│  Entrou   R$ 6.400      Saiu  R$ 3.900     Sobrou  R$ 2.500  │
│  Mês passado: sobrou R$ 1.850  ▲ +35%                        │
└──────────────────────────────────────────────────────────────┘

┌─ ATÉ O FIM DO MÊS ───────────────────────────────────────────┐
│  A receber   R$ 2.100  (3 contas)                            │
│  A pagar     R$ 2.850  (aluguel 05/08, luz 12/08, …)         │
│  Projeção    R$ 3.800  ✔ dá para pagar tudo                  │
│  ⚠ dia 12/08 o saldo fica em R$ 180 — cuidado                │
└──────────────────────────────────────────────────────────────┘

┌─ SAÚDE DO ATELIÊ ────────────────────────────────────────────┐
│  Custo fixo mensal        R$ 3.200                           │
│  Preciso faturar          R$ 3.200  → já faturei R$ 6.400 ✔  │
│  Ganho por hora de costura R$ 42/h  (meta: R$ 50/h)          │
└──────────────────────────────────────────────────────────────┘

┌─ ATRASADOS ──────────────────────────────────────────────────┐
│  Maria Silva   R$ 380   há 22 dias   [cobrar no WhatsApp]    │
│  Ana Souza     R$ 150   há 6 dias    [cobrar no WhatsApp]    │
└──────────────────────────────────────────────────────────────┘
```

**Todos esses números saem de dados que já existem no banco.** O que falta é a
conta e a tela — não é coleta de dado novo:

| Indicador | De onde sai |
|---|---|
| Custo fixo mensal | média das despesas recorrentes + categorias fixas dos últimos 3 meses |
| Preciso faturar (ponto de equilíbrio) | custo fixo do mês ÷ (1 − % de custo variável) |
| Ganho por hora | receita realizada ÷ soma de `estimatedHours` das OS entregues |
| Sinais ainda não entregues | `AccountReceivable.isDownPayment` pago com OS não entregue |
| Projeção até o fim do mês | saldo atual + a receber − a pagar (já calculado no gráfico) |
| Retorno por tipo de peça | valor da OS ÷ horas estimadas, agrupado por `Garment` |

---

## 5. Diagnóstico técnico — problemas encontrados

Severidade: 🔴 erro de informação (o sistema mente) · 🟠 falta grave · 🟡 incômodo

### 🔴 P1 — A receita nunca tem categoria

`CreateReceivableDto` (`dto/accounts.dto.ts:10`) não tem campo `category`, e
`createReceivable` (`financial.service.ts:321`) não grava. Os outros dois lugares
que criam conta a receber — aprovação de orçamento (`quotes.service.ts:430,442`) e
entrega de OS (`work-orders.service.ts:337`) — também não. O campo existe no banco
e está **sempre nulo**. Resultado: o DRE mostra uma linha só, *"Sem categoria"*,
com 100% da receita.

### 🔴 P2 — Três fontes de verdade para "receita do mês"

| Tela | Como calcula | Problema |
|---|---|---|
| Financeiro | soma de `Payment.amount` por `paidAt` | ✅ correto |
| Dashboard (`reports.service.ts:32`) | `AccountReceivable.paidAmount` com status `PAID` | ignora conta parcialmente paga; joga tudo no mês da quitação final |
| Relatórios → Receita por mês (`reports.service.ts:72`) | idem | idem |

Uma venda em 3x recebida em jun/jul/ago aparece **inteira em agosto** no Dashboard
e **dividida nos três meses** no Financeiro.

### 🔴 P3 — O gráfico "Receitas x Despesas" conta sangria como despesa

`reports.service.ts:118` soma **apenas `CashTransaction`** (só a gaveta) e **não
exclui `WITHDRAWAL`/`SUPPLY`**. Um depósito no banco vira despesa, o troco vira
receita, e todo recebimento em PIX/cartão não existe no gráfico.

### 🟠 P4 — O histórico de caixas não tem tela

`GET /financial/cash-register` (`financial.controller.ts:36`) devolve todas as
aberturas e fechamentos com saldos e divergência. **Nenhuma tela consome esse
endpoint.** Fechou o caixa, sumiu.

### 🟠 P5 — Ninguém assina nada

`CashRegister` (`schema.prisma:486`) e `CashTransaction` (`schema.prisma:511`) não
têm usuário. Não há como saber quem abriu, quem fechou com falta de R$ 50, quem
fez a sangria ou quem deu baixa.

### 🟠 P6 — Só a gaveta tem saldo

O caixa é, por desenho, a gaveta física. PIX, cartão e transferência viram
`Payment` e **nenhum saldo**. A sangria diminui a gaveta e o dinheiro não aparece
em lugar nenhum (`CashTransferDto` só tem `kind`, `amount` e `reason`).

### 🟠 P7 — A divisão das sócias não vira dinheiro

`closeDistribution` (`financial.service.ts:1421`) congela o cálculo e grava as
partes. Não gera pagamento, não registra retirada, e a parte do ateliê é um número
num relatório — não um saldo. Não dá para responder "quanto o ateliê acumulou" nem
"a sócia X já retirou julho?".

### 🟠 P8 — Não dá para corrigir nada

Não existe `PATCH /receivables/:id` nem `/payables/:id`, nem estorno de baixa.
Recebeu R$ 200 no lugar de R$ 20? O livro-razão, o caixa e o `paidAmount` ficam
errados para sempre, e o caixa fecha com divergência inexplicável.

### 🟡 P9 — Categoria digitada à mão no caixa

O diálogo "Lançar Dinheiro" (`CashRegisterSection.tsx:103`) usa texto livre,
enquanto contas a pagar usam a lista de `FinancialCategory`. "Material",
"materiais" e "Materiais " viram três linhas no DRE.

### 🟡 P10 — Sem controle de acesso

`FinancialController` usa só `JwtAuthGuard` (`financial.controller.ts:24`).
Qualquer usuária logada — inclusive costureira — pode fazer sangria, dar baixa e
ver quanto cada sócia recebeu. O `RolesGuard` existe no projeto e não é usado.

### 🟡 P11 — Navegação

As 7 abas guardam estado só em `useState` (`FinancialPage.tsx:15`): a URL é sempre
`/financial`, então F5, botão voltar e compartilhar link não funcionam.

### 🟡 P12 — Detalhes técnicos

- `getCashFlow` corta o extrato em 500 linhas silenciosamente (`financial.service.ts:756,761`).
- `getMonthlyResult` monta o histórico com 12 chamadas sequenciais (~24 queries por request).
- Anexos não se ligam a contas a pagar — não dá para guardar o comprovante do aluguel.
- Sem taxa de maquininha nem prazo de recebimento (D+30): a venda no cartão entra
  100% na data da venda, então o "recebido" do mês é maior que o dinheiro real.

---

## 6. Ideias vindas de outros sistemas

### PDV / varejo — Bling, Tiny, Omie, PDVs de salão (Trinks, Avec, Belle)
- **Sessão de caixa por operador**: quem abriu, quem fechou. → resolve P5.
- **Conferência às cegas**: o sistema não mostra o esperado antes de a pessoa
  contar (hoje mostra, o que anula parte do controle).
- **Contagem por cédula** no fechamento: soma sozinha e reduz erro de digitação.
- **Motivo padronizado de sangria** (depósito, cofre, fornecedor, retirada de
  sócia) em vez de texto livre — vira relatório.

### ERPs — Odoo, ERPNext, Conta Azul
- **Contas/carteiras múltiplas** (Gaveta, Banco, PIX, Cofre) com saldo próprio e
  **transferência entre contas**. É o conceito que falta em P6.
- **Conciliação bancária** simples: marcar lançamento como conferido.

### Financeiro de PME — QuickBooks, Nibo, YNAB
- **Aging de recebíveis** (a vencer / 1-30 / 31-60 / 60+): mostra o tamanho do buraco.
- **Alerta de saldo projetado negativo**: "em 12/09 falta R$ 400".
- **Envelopes/reservas (YNAB)**: separar o que já tem dono — reserva do ateliê,
  sinais ainda não entregues. → responde as perguntas 5 e 9.
- **Anexo de comprovante** em cada despesa.

### Salões e ateliês com profissionais
- **Fechamento de comissão com extrato individual e pagamento registrado**: é
  praticamente a sua Divisão, com o passo que falta — gerar a retirada. → P7.

### Precificação de serviço artesanal
- **Preço-hora**: receita ÷ horas trabalhadas, comparado a uma meta. É o número
  que diz se o ateliê está cobrando barato — e o sistema já guarda as horas
  estimadas de cada serviço (`Service.estimatedHours`).

---

## 7. Plano de mudanças

### Fase 1 — Números confiáveis e um painel que informa ✅

O objetivo desta fase é que **abrir o financeiro já responda as perguntas 1 a 6**.

| # | Mudança | Onde | Esforço |
|---|---|---|---|
| 1.1 | `category` em `CreateReceivableDto` + gravar em `createReceivable` e `createInstallments`; seletor na tela | `dto/accounts.dto.ts`, `financial.service.ts:321`, `ReceivablesSection.tsx` | 2h |
| 1.2 | Categoria automática nas contas geradas por orçamento e por entrega de OS | `quotes.service.ts:430`, `work-orders.service.ts:337` | 2h |
| 1.3 | Migration classificando as contas existentes (`Costura` onde há `workOrderId`) | nova migration | 30min |
| 1.4 | Relatórios e Dashboard passam a ler do livro `Payment` — uma função compartilhada, não três cópias | `reports.service.ts:32,72,118` | 3h |
| 1.5 | Remover o gráfico "Receitas x Despesas" dos Relatórios (errado e duplicado) | `ReportsPage.tsx` | 30min |
| 1.6 | Categoria do caixa vira seletor da lista | `CashRegisterSection.tsx:103` | 1h |
| 1.7 | **Painel financeiro como tela inicial** do módulo: dinheiro hoje, mês atual, até o fim do mês com alerta de saldo, atrasados | novo endpoint `GET /financial/overview` + nova seção | 8h |
| 1.8 | **Indicadores de saúde**: custo fixo mensal, faturamento mínimo, ganho por hora | mesmo endpoint | 5h |
| 1.9 | **Sinais ainda não entregues** destacados como "dinheiro que ainda não é seu" | mesmo endpoint | 2h |
| 1.10 | Abas viram rotas (`/financial/caixa`, `/financial/a-receber`, …) e são reagrupadas em *Dia a dia* / *Análise* | `FinancialPage.tsx` | 3h |
| 1.11 | Limpeza do ruído: tirar percentuais do DRE, rateio duplicado, melhor/pior mês e indicadores comerciais do Resultado do Mês | `DreSection.tsx`, `MonthlyResultSection.tsx`, `CashFlowSection.tsx` | 3h |
| 1.12 | **Tela de Configurações do Financeiro** (§9.11): categorias de custo fixo, meta de ganho por hora, modo de cálculo do custo fixo | `FinancialCategory.isFixed`, `BusinessInfo`, nova aba em Configurações | 6h |

### Fase 2 — Caixa de verdade ✅

| # | Mudança | Esforço |
|---|---|---|
| 2.1 | `openedById`/`closedById` no caixa e `userId` nos lançamentos, exibidos em tudo | 4h |
| 2.2 | **Tela de histórico de caixas** (o endpoint já existe): data, operadora, esperado, contado, diferença | 4h |
| 2.3 | Sangria com destino e motivo padronizado | 2h |
| 2.4 | Estorno de baixa (`POST /payments/:id/reverse`) com motivo, mantendo o histórico | 5h |
| 2.5 | Edição de conta a receber/pagar em aberto | 4h |
| 2.6 | Contagem por cédula e conferência às cegas (opcional em Configurações) | 5h |

### Fase 3 — Onde o dinheiro está ✅

| # | Mudança | Esforço |
|---|---|---|
| 3.1 | `FinancialAccount` (Gaveta, Banco, PIX, Cofre) com saldo; todo `Payment` aponta para uma conta | 8h |
| 3.2 | Transferência entre contas (a sangria vira "Gaveta → Banco"), com extrato por conta | 5h |
| 3.3 | Conciliação simples: marcar lançamento como conferido, saldo conciliado | 5h ✅ |

### Fase 4 — Divisão, retiradas e reserva ✅

| # | Mudança | Esforço |
|---|---|---|
| 4.1 | Fechar a divisão gera a retirada de cada sócia, com baixa e recibo | 5h |
| 4.2 | Reserva do ateliê como saldo acumulado, com extrato | 5h |
| 4.3 | Extrato individual da sócia (ganhou, retirou, tem a receber) | 4h |
| 4.4 | Prejuízo acumulado abatido antes de dividir | 3h |
| 4.5 | Sinal de peça não entregue fora do resultado a dividir | 4h |
| 4.6 | **Regra de divisão configurável na tela**: percentual por sócia e do ateliê, com ajuste válido só para um mês | 5h ✅ |

#### Como funciona hoje

`getDistribution` (`financial.service.ts:1340`):

1. **Resultado do mês** = tudo que entrou − tudo que saiu no mês, em regime de caixa
   (dinheiro que efetivamente entrou, não o que foi vendido).
2. **Partes** = nº de sócias + 1. Com 3 sócias, 4 partes.
3. **Cada sócia** recebe uma parte, **igual para todas**, independente de quantas
   peças entregou. A tela mostra a produção de cada uma, mas só como acompanhamento.
4. **O ateliê** fica com uma parte + os centavos do arredondamento.
5. **Fechar** congela os valores em `MonthlyDistribution`; reabrir apaga o registro.
6. Só fecha com resultado positivo e com sócias marcadas (`User.isPartner`).

#### Os quatro problemas

**1. Nada acontece com o dinheiro — risco de dividir duas vezes.**
Fechar a divisão só grava números. Se a sócia A retirou e a B não, o sistema não
sabe. O dinheiro que a B não retirou continua no caixa e, no mês seguinte, entra
de novo no saldo — **e é dividido outra vez**. É o problema mais grave do módulo.

**2. A parte do ateliê é um número, não um saldo.**
Não acumula, não tem extrato, não é debitada quando o ateliê gasta. Em setembro
ninguém sabe quanto sobrou de agosto e julho, nem se aquele dinheiro ainda existe.
A tela diz *"fica para os gastos"*, mas as despesas do mês **já foram descontadas**
antes de dividir — então a parte do ateliê não é orçamento de despesa: é **reserva
/ capital de giro**. O texto atual induz ao erro.

**3. Divide sinal de peça que ainda não foi entregue.**
Como o regime é de caixa, um sinal de R$ 600 de um vestido de noiva a ser entregue
em novembro entra no resultado de agosto e é dividido. O tecido e o trabalho ainda
vão sair do bolso do ateliê. Na prática as sócias retiram dinheiro que é obrigação.

**4. Mês negativo desaparece.**
Se o mês fecha em prejuízo, o sistema recusa fechar a divisão e o prejuízo **não é
compensado no mês seguinte**. Julho −R$ 1.000 e agosto +R$ 3.000: dividem-se
R$ 3.000, quando o acumulado real é R$ 2.000.

#### A divisão passa a ser configurável na tela

Hoje a regra está **fixa no código**: partes iguais, uma por sócia mais uma do
ateliê. Isso tem dois efeitos ruins — não dá para acertar uma divisão diferente
do meio a meio, e **entrar uma sócia nova reduz sozinha a fatia do ateliê**
(de 1/4 para 1/5) sem ninguém decidir isso.

A regra passa a ser editada na própria tela de Divisão:

```
┌─ Como o resultado é dividido ──────────────── [Editar regra] ─┐
│                                                               │
│   Ateliê (reserva)                    20%      R$   500,00    │
│   Maria (sócia)                       30%      R$   750,00    │
│   Joana (sócia)                       30%      R$   750,00    │
│   Cláudia (sócia)                     20%      R$   500,00    │
│   ─────────────────────────────────────────────────────────   │
│   Total                              100%      R$ 2.500,00 ✔  │
│                                                               │
│   ⚠ A soma precisa fechar em 100%                             │
└───────────────────────────────────────────────────────────────┘
```

Regras da tela:

- Cada sócia tem seu **percentual próprio** — podem ser diferentes entre si.
- O ateliê é mais uma linha, com percentual próprio.
- A soma tem que fechar **exatamente 100%**; o botão de salvar fica travado
  enquanto não fechar, dizendo quanto falta ou sobra.
- Os centavos do arredondamento ficam com o ateliê (como hoje), para o total bater.
- **Ajuste pontual do mês**: antes de fechar, dá para alterar os percentuais só
  daquele mês (ex.: uma sócia afastada em julho) sem mexer na regra padrão.
- **Mudar a regra não altera mês já fechado** — `MonthlyDistribution` congela os
  valores, então o histórico continua fiel ao que foi acertado na época.
- Sócia sem percentual definido entra com 0% e a tela avisa, em vez de dividir
  errado silenciosamente.

**Opcional (segundo passo):** além do percentual, uma **parcela fixa por sócia**
(pró-labore) descontada antes do rateio — útil se alguém recebe um valor certo
todo mês e só o excedente é dividido em percentual.

#### Proposta

- **Retirada como registro**: fechar a divisão gera uma retirada por sócia, que
  fica pendente até o dinheiro sair de fato. O que não foi retirado aparece como
  "a pagar às sócias" e **não volta a ser dividido**.
- **Reserva do ateliê como conta** (`FinancialAccount` do tipo `SAFE`): a parte do
  ateliê entra como crédito, e toda compra bancada pela reserva sai de lá. Passa a
  existir a resposta "o ateliê tem R$ X guardados".
- **Prejuízo acumula**: mês negativo vira saldo a compensar, abatido do próximo
  resultado antes de dividir — ou coberto pela reserva do ateliê, se você preferir.
- **Sinal não entregue fora do bolo**: o resultado a dividir passa a descontar os
  sinais de peças ainda não entregues, que voltam ao resultado no mês da entrega.
- **A tela passa a mostrar**, além dos valores: a regra em uma frase, o que cada
  sócia já retirou, o saldo da reserva do ateliê e o quanto do resultado é sinal
  ainda comprometido.

### Fase 5 — Análise e o resto ✅

| # | Mudança | Esforço |
|---|---|---|
| 5.1 | Retorno por tipo de peça e por serviço (valor ÷ horas) | 5h |
| 5.2 | Aging de recebíveis + botão de cobrança no WhatsApp | 4h |
| 5.3 | Anexo de comprovante em contas a pagar | 4h |
| 5.4 | Paginação real no extrato do fluxo de caixa | 2h |
| 5.5 | Permissões por papel no financeiro | 3h |
| 5.6 | Taxa e prazo de cartão (D+30, taxa como despesa) | 6h ✅ — configurável por tipo de cartão |
| 5.7 | DRE em PDF para o contador | 3h |

---

## 8. Modelo de dados proposto (rascunho)

```prisma
// Fase 2
model CashRegister {
  openedById     String
  closedById     String?
  /// Contagem por cédula no fechamento: { "100": 3, "50": 2, ... }
  countBreakdown Json?
}

model CashTransaction {
  userId               String?
  /// Para onde foi a sangria / de onde veio o suprimento.
  counterpartAccountId String?
}

/// Estorno: mantém a baixa original e registra o contrário.
model PaymentReversal {
  id        String   @id @default(cuid())
  paymentId String   @unique
  reason    String
  userId    String
  createdAt DateTime @default(now())
}

// Fase 3
model FinancialAccount {
  id             String  @id @default(cuid())
  name           String            // "Gaveta", "Banco Inter", "PIX", "Cofre"
  kind           AccountKind       // CASH_DRAWER | BANK | WALLET | SAFE
  active         Boolean @default(true)
  openingBalance Decimal @default(0) @db.Decimal(10, 2)
}

model AccountTransfer {
  id            String   @id @default(cuid())
  fromAccountId String
  toAccountId   String
  amount        Decimal  @db.Decimal(10, 2)
  reason        String
  userId        String
  createdAt     DateTime @default(now())
}

// Fase 4
model PartnerPayout {
  id             String    @id @default(cuid())
  distributionId String
  userId         String
  amount         Decimal   @db.Decimal(10, 2)
  /// Nulo enquanto a sócia não retirou — é o que impede dividir duas vezes.
  paidAt         DateTime?
  accountId      String?
}

/// Regra de divisão vigente, editável na tela. A soma dos percentuais das
/// sócias mais o do ateliê tem que fechar 100%.
model User {
  /// Percentual do resultado que cabe a esta sócia.
  distributionPercent Decimal? @db.Decimal(5, 2)
}

model BusinessInfo {
  /// Percentual do resultado que fica na reserva do ateliê.
  atelierPercent      Decimal  @default(20) @db.Decimal(5, 2)
  /// Meta de ganho por hora de costura, para comparar com o realizado.
  targetHourlyRate    Decimal? @db.Decimal(10, 2)
  /// Como estimar o custo fixo do mês: REAL | AVERAGE_3M | MANUAL.
  fixedCostMode       String   @default("AVERAGE_3M")
  fixedCostManual     Decimal? @db.Decimal(10, 2)
  /// Meta de reserva, em meses de custo fixo.
  reserveTargetMonths Int      @default(3)
  reserveAccountId    String?
  /// Regras da divisão, decididas em 2026-08-02.
  excludeUndeliveredDownPayments Boolean @default(true)
  coverLossWithReserve           Boolean @default(true)
  carryLossToNextMonth           Boolean @default(true)
}

model FinancialCategory {
  /// Despesa fixa do mês — entra no custo fixo e no ponto de equilíbrio.
  isFixed Boolean @default(false)
}

/// Prejuízo que a reserva não cobriu e será abatido do próximo resultado.
model DistributionCarryOver {
  id        String   @id @default(cuid())
  /// Mês que gerou o prejuízo (AAAA-MM).
  month     String   @unique
  amount    Decimal  @db.Decimal(10, 2)
  /// Mês em que foi abatido; nulo enquanto ainda pesa.
  settledIn String?
  createdAt DateTime @default(now())
}

model MonthlyDistribution {
  /// Percentual aplicado ao ateliê naquele fechamento — o histórico não muda
  /// quando a regra é alterada depois.
  atelierPercent Decimal? @db.Decimal(5, 2)
}

model DistributionShare {
  /// Percentual aplicado a esta sócia naquele fechamento.
  percent Decimal? @db.Decimal(5, 2)
}

// Fase 1 — parâmetros do ateliê para os indicadores
model BusinessInfo {
  /// Meta de ganho por hora de costura, para comparar com o realizado.
  targetHourlyRate Decimal? @db.Decimal(10, 2)
}
```

---

## 9. Como fica cada tela

Estrutura geral — de 7 abas soltas para 2 grupos, com um painel na frente:

```
Financeiro
├── Painel (novo, tela inicial)     ← responde as perguntas 1 a 6
│
├── DIA A DIA
│   ├── Caixa
│   ├── Histórico de caixas (novo)
│   ├── A Receber
│   └── A Pagar
│
└── ANÁLISE
    ├── Contas e Saldos (novo — Fase 3)
    ├── Resultado do Mês
    ├── Divisão
    ├── Fluxo de Caixa
    └── DRE
```

Cada tela abaixo traz: a pergunta que ela responde, como fica, **o que entra** e
**o que sai**. Os desenhos são esquemáticos — servem para discutir o conteúdo, não
o visual final.

---

### 9.1 Painel *(novo — tela inicial do módulo)*

> **Responde:** tenho quanto e onde · sobrou quanto este mês · dá para pagar as
> contas · o ateliê está saudável · quem está me devendo

```
┌─ DINHEIRO HOJE ─────────────────────────────────────────────────┐
│  Gaveta          Banco           PIX             TOTAL          │
│  R$   340,00     R$ 4.210,00     R$ 0,00         R$ 4.550,00    │
│                                                                 │
│  ⚠ R$ 1.200,00 são sinais de peças ainda não entregues          │
│    → seu de verdade: R$ 3.350,00                    [detalhar]  │
└─────────────────────────────────────────────────────────────────┘

┌─ AGOSTO ────────────────────┐  ┌─ ATÉ 31/08 ────────────────────┐
│  Entrou      R$ 6.400,00    │  │  A receber   R$ 2.100  (3)     │
│  Saiu        R$ 3.900,00    │  │  A pagar     R$ 2.850  (5)     │
│  Sobrou      R$ 2.500,00    │  │  Fecha em    R$ 3.800,00 ✔     │
│  Julho: R$ 1.850  ▲ +35%    │  │  ⚠ dia 12/08 cai p/ R$ 180     │
└─────────────────────────────┘  └────────────────────────────────┘

┌─ SAÚDE DO ATELIÊ ───────────────────────────────────────────────┐
│  Custo fixo mensal      R$ 1.720,00   aluguel, luz, água, net   │
│  Preciso faturar        R$ 1.720,00  →  já faturei R$ 6.400 ✔   │
│  Ganho por hora         R$ 42,00/h   (meta R$ 50,00/h)  ▼ -16%  │
└─────────────────────────────────────────────────────────────────┘
        ↑ custo fixo e meta vêm de Configurações → Financeiro (§9.11)

┌─ ATRASADOS ─────────────────────────────────┐ ┌─ CAIXA ─────────┐
│  Maria Silva   R$ 380   22 dias  [cobrar]   │ │ Aberto às 08:12 │
│  Ana Souza     R$ 150    6 dias  [cobrar]   │ │ por Joana       │
│  ─────────────────────────────────────────  │ │ R$ 340,00       │
│  Total atrasado          R$ 530,00          │ │ [fechar caixa]  │
└─────────────────────────────────────────────┘ └─────────────────┘
```

**Entra:** saldo por conta · sinais comprometidos · projeção do mês com alerta de
data crítica · custo fixo · ponto de equilíbrio · ganho por hora · lista de
atrasados com atalho de cobrança · estado do caixa.
**Sai:** nada — é tela nova. Substitui a "aba Caixa" como primeira coisa que se vê.

---

### 9.2 Caixa

> **Responde:** quanto tem na gaveta agora · o que passou por ela hoje · fechou certo

```
┌─────────────────────────────────────────────────────────────────┐
│  CAIXA ABERTO                          Joana · hoje às 08:12    │
│  Abertura R$ 200,00                                             │
│                                                                 │
│           ESPERADO NA GAVETA AGORA:  R$ 340,00                  │
│           entradas R$ 260  ·  saídas R$ 120                     │
│                                                                 │
│  [Lançar dinheiro]  [Sangria]  [Suprimento]      [Fechar caixa] │
└─────────────────────────────────────────────────────────────────┘

Movimentações de hoje
Hora   Descrição                     Categoria    Quem     Valor
09:40  Recebimento: OS-0142 sinal    Costura      Joana   + 150,00
11:02  Linha e zíper                 Materiais    Joana   -  40,00
14:15  Sangria → Banco Inter         Transferência Maria  -  80,00
                                                    (motivo: depósito)
```

**Entra:** quem abriu · quem lançou cada movimento · destino da sangria · categoria
da lista (não mais texto livre).
**Sai:** os cartões separados de "Entradas" e "Saídas" com contagem de lançamentos
— viram uma linha de apoio embaixo do valor esperado.

---

### 9.3 Histórico de caixas *(novo — o endpoint já existe)*

> **Responde:** quando o caixa foi aberto e fechado, por quem, e se deu diferença

```
Data        Abriu    Fechou   Abertura  Esperado  Contado   Diferença
02/08 ▸     Joana    Joana      200,00    340,00   340,00      —       ✔
01/08 ▸     Maria    Joana      150,00    620,00   570,00    -50,00    ⚠
            "faltou — provável troco a mais"                  [relatório]
31/07 ▸     Joana    Maria      200,00    410,00   415,00     +5,00
                                                              [relatório]

Últimos 30 dias:  22 caixas · 3 com diferença · saldo das diferenças -R$ 45,00
```

**Entra:** a tela inteira (hoje não existe) · resumo de divergências do período ·
link para o relatório de fechamento de qualquer dia.

---

### 9.4 A Receber

> **Responde:** quem me deve, quanto, há quanto tempo — e quanto disso é de verdade

```
┌ Em aberto R$ 4.320 ┐┌ Vence em 7d R$ 900 ┐┌ Atrasado R$ 530 (2) ┐

Idade da dívida:  ▓▓▓▓▓▓▓ a vencer 3.790 │ 1-30d 380 │ 31-60d 150 │ 60d+ 0

Filtros: [status ▾] [cliente ▾] [categoria ▾] [período ▾]

Cliente        Descrição              Categoria  Vence    Valor    Situação
Maria Silva    OS-0138 — saldo        Costura    11/07    380,00   ⚠ 22 dias
Ana Souza      OS-0140 — parcela 2/3  Costura    27/07    150,00   ⚠ 6 dias
Júlia Reis     OS-0142 — sinal        Costura    05/08    600,00   a vencer
                                                          [receber] [editar] ⋮
```

**Entra:** categoria de receita (hoje nunca preenchida) · faixa de atraso (aging) ·
editar conta em aberto · estornar baixa errada · atalho de cobrança por WhatsApp.
**Sai:** nada.

---

### 9.5 A Pagar

> **Responde:** o que tenho que pagar, quando, e se tem dinheiro para isso

```
┌ Em aberto R$ 2.850 ┐┌ Vence em 7d R$ 1.200 ┐┌ Vencido R$ 0 ┐

Fornecedor    Descrição        Categoria  Vence   Valor    Recorrente
Imobiliária   Aluguel agosto   Aluguel    05/08  1.200,00  mensal 🔁
CPFL          Luz julho        Utilidades 12/08    280,00  mensal 🔁
Tecidos SP    Nota 4471        Materiais  20/08    870,00  —       📎
                                                   [pagar] [editar] ⋮

Despesas fixas do mês: R$ 1.480,00  ·  variáveis: R$ 1.370,00
```

**Entra:** anexo do comprovante/nota · editar · estornar · separação fixo × variável
(é o que alimenta o custo fixo do painel).
**Sai:** nada.

---

### 9.6 Contas e Saldos *(novo — Fase 3)*

> **Responde:** onde o dinheiro está e se bate com o extrato do banco

```
Conta            Tipo      Saldo         Conciliado até
Gaveta           Espécie   R$   340,00   —              [extrato]
Banco Inter      Banco     R$ 4.210,00   31/07 ✔        [extrato] [conciliar]
Reserva ateliê   Reserva   R$ 3.150,00   —              [extrato]
─────────────────────────────────────────
TOTAL                      R$ 7.700,00

[Transferir entre contas]
```

**Entra:** a tela inteira · a reserva do ateliê aparece como conta de verdade ·
sangria vira transferência "Gaveta → Banco".

---

### 9.7 Resultado do Mês

> **Responde:** sobrou quanto, comparado com o mês passado, e por quê

```
◀  Agosto de 2026  ▶

     Entrou            Saiu             Sobrou
     R$ 6.400,00       R$ 3.900,00      R$ 2.500,00
     ▲ +12% vs julho   ▲ +5% vs julho   ▲ +35% vs julho

De onde veio                        Para onde foi
Costura        R$ 4.900,00          Materiais    R$ 1.560,00
Ajuste         R$ 1.100,00          Aluguel      R$ 1.200,00
Bordado        R$   400,00          Luz/água     R$   380,00
                                    Marketing    R$   760,00

Últimos 12 meses  ▁▂▃▅▃▆▅▇▆█▇▆   (sobra por mês)
```

**Entra:** receita por categoria funcionando de verdade (depende da correção P1).
**Sai:** o "rateio de cada real recebido" (repete a tabela de despesas) · taxa de
conversão de orçamentos · ticket médio · produção por costureira — tudo isso é
comercial/produtivo e vai para Relatórios.

---

### 9.8 Divisão

> **Responde:** quanto é de cada sócia, quanto fica no ateliê, e o que já foi retirado

```
◀  Agosto de 2026  ▶                          [Imprimir]  [Configurações]

┌─ QUANTO SOBROU PARA DIVIDIR ────────────────────────────────────┐
│                                                                 │
│    Entrou no mês                                  R$ 6.400,00   │
│  − Saiu no mês                                    R$ 3.900,00   │
│  ─────────────────────────────────────────────────────────────  │
│  = Resultado do mês                               R$ 2.500,00   │
│                                                                 │
│  − Sinais de peças ainda não entregues            R$   600,00   │
│      2 peças · entra na divisão quando for entregue  [ver quais]│
│                                                                 │
│  = A DIVIDIR                                      R$ 1.900,00   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ COMO É DIVIDIDO ──────────────────────────────── [Editar regra] ┐
│                                                                  │
│  Quem              %          Valor        Retirada              │
│  ──────────────────────────────────────────────────────────────  │
│  🏠 Ateliê        20%     R$   380,00      → vai para a reserva  │
│  👤 Maria         30%     R$   570,00      ● retirado 03/09      │
│  👤 Joana         30%     R$   570,00      ○ a retirar  [baixar] │
│  👤 Cláudia       20%     R$   380,00      ○ a retirar  [baixar] │
│  ──────────────────────────────────────────────────────────────  │
│     Total        100% ✔   R$ 1.900,00      falta retirar: 950,00 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ RESERVA DO ATELIÊ ─────────────────────────────────────────────┐
│  Saldo acumulado                              R$ 3.150,00       │
│  Este mês entra                               R$   380,00  ▲    │
│  Cobre 1,8 mês de custo fixo (meta: 3)    [ver extrato]         │
└─────────────────────────────────────────────────────────────────┘

Produção do mês (acompanhamento — não muda a divisão)
Maria     6 peças   R$ 2.400   ▸
Joana     4 peças   R$ 1.900   ▸
Cláudia   3 peças   R$ 1.100   ▸
⚠ 2 peças entregues sem costureira atribuída (R$ 700)

                                          [Fechar divisão de agosto]
```

**Quando o mês fecha negativo** (regra definida: cobre com a reserva; o que a
reserva não cobrir, abate do mês seguinte):

```
┌─ QUANTO SOBROU PARA DIVIDIR ────────────────────────────────────┐
│    Resultado do mês                             − R$ 1.200,00   │
│                                                                 │
│  ⚠ O mês fechou negativo. Não há o que dividir.                 │
│                                                                 │
│    Coberto pela reserva do ateliê                 R$ 1.200,00   │
│    Reserva depois de cobrir:  R$ 3.150 → R$ 1.950,00            │
│                                                                 │
│                                        [Cobrir com a reserva]   │
└─────────────────────────────────────────────────────────────────┘
```

E quando a reserva não dá conta:

```
│    Resultado do mês                             − R$ 4.000,00   │
│    Coberto pela reserva (todo o saldo)            R$ 3.150,00   │
│    Fica pendente para o mês que vem               R$   850,00   │
│      → setembro só divide o que passar de R$ 850,00             │
```

**Editar regra** (abre da própria tela):

```
┌─ Como dividir o resultado ──────────────────────────────────────┐
│                                                                 │
│  🏠 Ateliê (reserva)          [ 20 ] %                          │
│  👤 Maria                     [ 30 ] %                          │
│  👤 Joana                     [ 30 ] %                          │
│  👤 Cláudia                   [ 20 ] %                          │
│  ─────────────────────────────────────────────────────────────  │
│     Total                        100 %  ✔                       │
│                                                                 │
│  ☐ Usar estes percentuais só em agosto/2026                     │
│     (não altera a regra padrão nem os meses já fechados)        │
│                                                                 │
│                                    [Cancelar]  [Salvar regra]   │
└─────────────────────────────────────────────────────────────────┘
```

- Enquanto a soma não fechar 100%, o botão fica travado com a mensagem
  *"faltam 5%"* / *"passou 3%"*.
- Sócia sem percentual entra com 0% e a tela avisa antes de fechar o mês.
- Os centavos do arredondamento ficam com o ateliê, para o total bater exato.

**Entra:** percentual editável por sócia e do ateliê · desconto dos sinais não
entregues · cobertura do prejuízo pela reserva com saldo pendente para o mês
seguinte · retirada por sócia com baixa · saldo e extrato da reserva do ateliê.
**Sai:** a frase "fica para os gastos" no card do ateliê (é reserva — as despesas
já foram descontadas antes de dividir).

---

### 9.9 Fluxo de Caixa

> **Responde:** como o dinheiro entra e sai ao longo do tempo e quando vai apertar

```
Período: [este mês ▾] [01/08] até [31/08]        agrupar por [semana ▾]

  R$
  6k │      ▇                    ▁ previsto
  4k │  ▇   ▇   ▇                ▇ realizado
  2k │  ▇   ▇   ▇   ▁
     └──────────────────────────
      sem1 sem2 sem3 sem4

Saldo projetado: ─────╲────╱──── ⚠ mínimo R$ 180 em 12/08

Entrou R$ 6.400 · Saiu R$ 3.900 · Sobra R$ 2.500 · Projetado no mês R$ 1.750

Extrato do período                            [buscar] [exportar CSV]
(paginado, 20 por página)
```

**Entra:** alerta do dia em que o saldo fica mais baixo · busca no extrato ·
paginação de verdade.
**Sai:** "melhor mês / pior mês" · o listão de 500 linhas cortado em silêncio.

---

### 9.10 DRE

> **Responde:** onde ganhei e onde gastei no período, comparado com o período anterior

```
Período: [este mês ▾] [01/08] a [31/08]                 [PDF p/ contador]

RECEITAS                        Agosto        Julho      Variação
  Costura                     4.900,00     4.100,00      ▲ +19%
  Ajuste                      1.100,00     1.250,00      ▼ -12%
  Bordado                       400,00       300,00      ▲ +33%
  Total                       6.400,00     5.650,00      ▲ +13%

DESPESAS
  Materiais                   1.560,00     1.480,00      ▲  +5%
  Aluguel                     1.200,00     1.200,00        —
  Luz/água                      380,00       420,00      ▼ -10%
  Marketing                     760,00       700,00      ▲  +9%
  Total                       3.900,00     3.800,00      ▲  +3%

RESULTADO                     2.500,00     1.850,00      ▲ +35%
Margem                            39%          33%
```

**Entra:** coluna do período anterior com variação (é o que mostra tendência) ·
exportação em PDF.
**Sai:** a coluna de percentual de participação de cada categoria.

---

### 9.11 Configurações do Financeiro *(nova)*

> **Responde:** de onde saem os números do painel — custo fixo, meta por hora,
> divisão e reserva. Sem esta tela, metade dos indicadores fica sem parâmetro.

Fica como uma aba dentro de **Configurações** (junto de Usuários, Papéis,
Categorias), com atalho a partir do painel e da tela de Divisão.

```
Configurações › Financeiro

┌─ 1. CUSTO FIXO DO ATELIÊ ───────────────────────────────────────┐
│                                                                 │
│  Marque as categorias de despesa que são fixas todo mês.        │
│  É a soma delas que diz quanto você precisa faturar para        │
│  empatar.                                                       │
│                                                                 │
│   ☑ Aluguel            média 3 meses    R$ 1.200,00             │
│   ☑ Luz                média 3 meses    R$   310,00             │
│   ☑ Água               média 3 meses    R$    90,00             │
│   ☑ Internet           média 3 meses    R$   120,00             │
│   ☐ Materiais          média 3 meses    R$ 1.480,00  (variável) │
│   ☐ Marketing          média 3 meses    R$   700,00  (variável) │
│   ☐ Outros             média 3 meses    R$   180,00  (variável) │
│                                                    [+ categoria]│
│  ─────────────────────────────────────────────────────────────  │
│   Custo fixo mensal estimado             R$ 1.720,00            │
│                                                                 │
│   Como calcular o valor de cada mês:            (padrão)        │
│    ( ) valor real lançado no mês                                │
│    (•) média dos últimos 3 meses      ← evita mês sem a conta   │
│    ( ) valor fixo que eu informo:  [ R$ ______ ]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ 2. META DE GANHO POR HORA ─────────────────────────────────────┐
│                                                                 │
│  Quanto você quer ganhar por hora de costura.                   │
│  O painel compara com o realizado (receita ÷ horas entregues).  │
│                                                                 │
│   Meta          [ R$ 50,00 ] por hora                           │
│                                                                 │
│   Realizado nos últimos 3 meses:                                │
│     junho R$ 38/h   julho R$ 45/h   agosto R$ 42/h              │
│                                                                 │
│   As horas vêm do tempo estimado de cada serviço (Catálogo →    │
│   Serviços). ⚠ 4 serviços estão sem tempo estimado e ficam de   │
│   fora da conta.                                  [ver quais]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ 3. DIVISÃO DO RESULTADO ───────────────────────────────────────┐
│                                                                 │
│   🏠 Ateliê (reserva)         [ 20 ] %                          │
│   👤 Maria                    [ 30 ] %                          │
│   👤 Joana                    [ 30 ] %                          │
│   👤 Cláudia                  [ 20 ] %                          │
│   ────────────────────────────────────────                      │
│      Total                       100 % ✔                        │
│                                                                 │
│   Quem aparece aqui são as usuárias marcadas como sócia em      │
│   Configurações → Usuários.                    [gerenciar]      │
│                                                                 │
│   ☑ Tirar da divisão os sinais de peças ainda não entregues     │
│   ☑ Cobrir mês negativo com a reserva do ateliê   ← 1º          │
│      ☑ e o que a reserva não cobrir, abater do mês seguinte     │
│        (desmarcando o de cima, o prejuízo vai direto para o     │
│         mês seguinte sem tocar na reserva)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ 4. RESERVA DO ATELIÊ ──────────────────────────────────────────┐
│                                                                 │
│   Saldo hoje                              R$ 3.150,00           │
│   Meta de reserva     [ 3 ] meses de custo fixo = R$ 5.160,00   │
│   Situação            61% da meta  ▓▓▓▓▓▓░░░░                   │
│                                                                 │
│   Conta onde a reserva fica guardada:  [ Banco Inter ▾ ]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─ 5. CAIXA ──────────────────────────────────────────────────────┐
│   ☐ Conferência às cegas (não mostrar o esperado no fechamento) │
│   ☑ Exigir motivo na sangria                                    │
│   Motivos de sangria: Depósito · Cofre · Fornecedor · Retirada  │
│                                                    [+ motivo]   │
└─────────────────────────────────────────────────────────────────┘

                                        [Cancelar]  [Salvar]
```

**Onde cada parâmetro é usado:**

| Parâmetro | Alimenta |
|---|---|
| Categorias fixas | "Custo fixo mensal" e "Preciso faturar" no painel (§9.1); separação fixo × variável em A Pagar (§9.5) |
| Meta de ganho por hora | Indicador "Ganho por hora" do painel |
| Percentuais da divisão | Tela de Divisão (§9.8) |
| Sinais fora do bolo | Resultado a dividir (§9.8) e o alerta "não é seu de verdade" no painel |
| Cobrir negativo com a reserva | Fechamento de mês negativo (§9.8) |
| Meta de reserva | Barra de progresso da reserva; alerta quando a retirada derruba a reserva abaixo da meta |
| Conta da reserva | Para onde vai o dinheiro do ateliê (§9.6) |

---

## 10. Ordem sugerida e decisões que preciso de você

**Ordem:** Fase 1 → 2 → 3 → 4 → 5.
A Fase 1 é pré-requisito de tudo: enquanto os números não baterem, qualquer tela
nova herda a divergência — e é ela que transforma o módulo de "muita informação"
em "informação útil".

**Decidido (2026-08-02):**

| # | Decisão | Como fica |
|---|---|---|
| 1 | Divisão | **Configurável na tela** — percentual por sócia e do ateliê, soma travada em 100% (§9.8) |
| 2 | Sinal de peça não entregue | **Sai do bolo** — só entra na divisão no mês da entrega |
| 3 | Mês negativo | **Primeiro a reserva do ateliê**; o que ela não cobrir **abate do mês seguinte** |
| 4 | Custo fixo | **Configurável** — já marcados Aluguel, Luz, Água e Internet (§9.11) |
| 5 | Valor do custo fixo no mês | **Média dos últimos 3 meses** como padrão — não deixa o mês em que a conta de luz não chegou baixar o ponto de equilíbrio. Os modos "valor real" e "valor fixo" ficam disponíveis na tela |
| 6 | Meta de ganho por hora | **Configurável**, sem valor imposto pelo sistema (§9.11) |
| 7 | Meta de reserva do ateliê | **3 meses de custo fixo** como padrão, editável |

**Assumido até você dizer o contrário** (não trava o trabalho, mas vale confirmar
quando chegarmos nas fases 3 e 4):

| Ponto | Assumido |
|---|---|
| Retirada das sócias | pode ser mensal ou acumulada — o sistema registra "a retirar" e só baixa quando o dinheiro sai; sai da conta escolhida na hora da baixa |
| Contas | começa com **Gaveta** e **Banco**; PIX cai no Banco (dá para separar depois sem migration nova) |
| Acesso ao financeiro | **só sócias/admin**; atendente sem acesso ao módulo (o mais restrito; afrouxar depois é simples) |
| Cartão | **com maquininha** — taxa e prazo por tipo de cartão são configurados em Configurações → Financeiro (2026-08-03) |

---

## 11. Riscos

- **A Fase 1.4 muda números que já foram vistos.** O "Receita do Mês" do Dashboard
  vai mudar de valor depois da correção. É o valor certo, mas precisa ser avisado.
- **A Fase 1.11 remove informação da tela.** Nada é apagado do banco — os cálculos
  continuam disponíveis em relatórios de segundo nível.
- **A Fase 3 é a maior mudança estrutural**: todo `Payment` passa a ter conta. A
  migration precisa atribuir conta aos lançamentos antigos (espécie → Gaveta;
  PIX/cartão/transferência → Banco).
- **A Fase 4 não deve recalcular divisões já fechadas** — só as novas geram retiradas.
