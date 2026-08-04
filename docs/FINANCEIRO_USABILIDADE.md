# Financeiro — Usabilidade e disposição da informação

> Avaliação feita em 2026-08-03 sobre o código em `main`, depois das fases 1 a 5
> de [FINANCEIRO_AVALIACAO.md](FINANCEIRO_AVALIACAO.md).
>
> Aquele documento tratava do que **faltava** e do que estava **errado**. Este
> trata de outra coisa: o que existe está certo, mas está espalhado, repetido e
> sem hierarquia — e, principalmente, **fora do momento em que é usado**.
>
> **Permissões e papéis ficam de fora desta rodada.** Ver o [anexo](#anexo--permissões-fora-do-escopo-desta-rodada).

---

## 1. Resumo

**O módulo tem 11 abas para 5 perguntas.** Os mesmos três números — quanto
entrou, quanto saiu, quanto sobrou — aparecem em quatro telas com três
vocabulários diferentes, e nenhuma é claramente *a* tela do mês.

Mas o problema maior não é o excesso de tela: é que **o financeiro exige ser
visitado justamente quando a pessoa não pode sair de onde está**. O caso mais
caro está documentado no próprio código (§3.1): na hora de entregar a peça e
receber o dinheiro, o sistema manda a usuária sair da OS e ir para outro módulo.

Três frentes, nesta ordem de importância:

1. **Trazer o dinheiro para o momento em que ele acontece** (§3)
2. **Fazer o sistema puxar a atenção, em vez de esperar ser aberto** (§4)
3. **Reduzir, renomear e reorganizar as telas** (§5 a §9)

O **§7 valida tela por tela** o que cada uma precisa — as onze foram lidas por
inteiro — e o §7.12 registra as quatro afirmações deste documento que a leitura
derrubou.

---

## 2. Quem usa — e por que isso define tudo

O `seed.ts` define três papéis, mas **hoje só um existe de verdade**: uma das
sócias, com acesso total, fazendo tudo. Atende no balcão, monta o orçamento, abre
a OS, acompanha a costura, recebe, fecha o caixa e no fim do mês decide quanto
retirar. Isso pode mudar quando houver contratação, mas é o quadro atual.

Uma pessoa só acumulando todos os papéis **não simplifica** o problema de
usabilidade — inverte-o:

**a) Não existe divisão de trabalho, existe divisão de momento.**
A mesma pessoa está no balcão às 10h e fazendo conta às 20h. As telas devem ser
organizadas por **quando se usa**, não por quem usa.

**b) Toda a carga cognitiva é de uma cabeça só.**
Onze abas não estão divididas entre três pessoas — estão na mesma pessoa, que
ainda tem outros seis módulos para lembrar. Cada tela a menos vale mais do que
valeria num time.

**c) Ela trabalha interrompida.**
Lança meia coisa, chega cliente, volta vinte minutos depois. Todo fluxo de mais
de um passo precisa sobreviver à interrupção.

**d) Não existe conferência cruzada.**
Quem erra é quem confere. O sistema é a única segunda opinião que existe — o que
torna *desfazer* e prevenção de erro mais importantes, não menos.

**e) O tempo dela é o recurso mais escasso do ateliê.**
Cada minuto no financeiro é um minuto fora da costura, que é o que fatura. Tela
que precisa ser procurada não será procurada.

### 2.1 Sem fechar a porta para o futuro

Contratar é o caminho esperado. Três regras mantêm as duas portas abertas, sem
custo nenhum hoje:

1. **Não remover as verificações de permissão.** Já estão no lugar certo
   (`@Permissions` por endpoint) e não atrapalham quem pode tudo.
2. **Organizar por momento já é organizar por papel**, com um ano de
   antecedência: "dia a dia" e "análise" continuam valendo quando forem duas
   pessoas.
3. **O modo balcão (§9) é a costura entre os dois mundos** — hoje é o atalho da
   sócia para atender rápido; no dia da contratação, é exatamente a tela que a
   atendente recebe.

O que **não** vale fazer agora: telas por papel, gestão de permissões, ou um
segundo painel "para a atendente". É construir para um usuário que ainda não
existe.

---

## 3. O dinheiro está fora do momento em que acontece

### 3.1 O sistema manda a usuária sair da tela

`pages/WorkOrders/DeliverDialog.tsx:102` diz, literalmente:

> A cliente ainda deve **R$ 480,00**. Receba o valor em
> **Financeiro → Contas a Receber**, ou confirme abaixo que a peça sai com saldo
> em aberto.

Este é *o* momento em que o dinheiro troca de mão: a cliente está no balcão, com
a peça na mão, pagando. O caminho pedido é: fechar o diálogo → sair da OS → abrir
Financeiro → achar a aba → achar a conta na tabela → clicar Receber → escolher o
método → voltar para a OS → entregar.

**Oito passos e duas trocas de módulo, com a cliente esperando** — para fazer
algo que a mesma pessoa tem permissão de fazer, no mesmo segundo, na tela em que
já está. Na prática só há dois desfechos: marca-se "entregar com saldo em aberto"
e registra-se depois (e às vezes não se registra), ou a fila para.

**Proposta:** o `DeliverDialog` recebe o pagamento, com o `PaymentDialog` que já
existe embutido:

```
┌─ Entregar OS-00142 ───────────────────────────┐
│  Maria Silva · Vestido de festa               │
│                                               │
│  Saldo em aberto            R$ 480,00         │
│                                               │
│  ● Receber agora    ○ Entregar fiado          │
│    Forma  [ Pix ▾ ]   Valor [ 480,00 ]        │
│    Conta  [ Banco ▾ ]                         │
│                                               │
│  Recebido por [ ............ ]                │
│                     [Cancelar]  [Entregar]    │
└───────────────────────────────────────────────┘
```

Um diálogo, um clique, e a baixa, o caixa e a entrega acontecem juntos. Não exige
endpoint novo: `payReceivable` e `deliver` já existem, nunca foram costurados na
mesma tela.

Aprovar orçamento já pergunta do sinal e cancelar OS já oferece a devolução — os
dois funcionam. **A entrega é o buraco.**

### 3.2 O financeiro não conhece a cliente

`CustomerFormPage.tsx` não tem uma linha de financeiro. Não existe resposta para:

> *A Maria já me deve alguma coisa? Ela costuma pagar em dia? Quanto já gastou
> aqui?*

É o que decide **se pode fazer fiado** — a decisão mais arriscada que o ateliê
toma, e a única para a qual o sistema não ajuda em nada. Os dados existem todos
(`customerId` está em `AccountReceivable` e em `RealizedEntry`).

**Proposta:** um bloco na ficha da cliente:

```
  FINANCEIRO
  Já gastou aqui        R$ 4.320   em 9 peças
  Em aberto agora       R$ 480     1 conta, vencida há 12 dias
  Costuma pagar         3 dias depois do combinado (média de 8 contas)
```

Três linhas. A terceira é a que muda a decisão.

---

## 4. Tudo é "puxado", nada é "empurrado"

As onze telas esperam ser abertas. Nenhuma diz *"olha isso hoje"*. Quem esquece
de abrir "A Receber" na terça não cobra ninguém naquela semana — e não há
ninguém para lembrar (§2e).

**Proposta:** no topo do Painel, uma fila de trabalho — não um resumo, uma
**lista de coisas para fazer**, cada uma com o botão que a resolve:

```
  PRECISA DE VOCÊ HOJE                                   4 itens

  ⚠  3 contas vencidas somando R$ 1.240              [cobrar]
  ⚠  O caixa de ontem não foi fechado                [fechar]
  ●  Aluguel vence amanhã — R$ 1.800                 [pagar]
  ●  2 peças entregues sem pagamento registrado      [ver]
```

Cada linha só aparece quando é verdade. Zero itens = o bloco some e o Painel abre
direto no dinheiro. O último item é a rede de segurança do §3.1: enquanto a
entrega não receber pagamento, a fila pelo menos não deixa esquecer.

### 4.1 A pergunta mais importante não está em tela nenhuma

> *Posso tirar dinheiro este mês?*

O Painel tem **as peças** dessa conta espalhadas em blocos diferentes (disponível,
sinais comprometidos, a pagar até o fim do mês, reserva) e **não faz a conta**. A
tela "Divisão" faz uma conta parecida, mas sobre o **mês fechado**, não sobre o
dinheiro de hoje.

**Proposta:** uma linha no Painel, abaixo do dinheiro disponível:

```
  Dá para retirar com segurança          R$ 1.850
  12.480 disponível − 2.300 de sinais − 7.330 de contas até 31/08 − 1.000 de reserva
```

A conta inteira visível embaixo, em letra pequena. Sem ela à mostra ninguém
confia no número; com ela à mostra, o número vira decisão.

---

## 5. O que está confuso nas telas de hoje

### 5.1 Quatro telas respondem à mesma pergunta

| | Painel | Resultado do Mês | DRE | Fluxo de Caixa |
|---|---|---|---|---|
| Quanto entrou | "Entrou" | "Entrou" | "Receita" | "Total Recebido" |
| Quanto saiu | "Saiu" | "Saiu" | "Despesa" | "Total Pago" |
| O que sobrou | "Sobrou" | "Sobrou no mês" | "Resultado" | "Resultado" |
| Por categoria | — | "De onde veio" / "Para onde foi" | "Receitas / Despesas por categoria" | — |
| vs. anterior | ✔ | ✔ | ✔ | — |

As quatro leem a **mesma fonte** (`realized.ts`), então os números batem — o
problema não é divergência, é repetição. **Resultado do Mês e DRE são a mesma
tela com nomes diferentes**; a única diferença real é que o DRE aceita período
livre e imprime. Três nomes para a mesma coisa fazem a usuária desconfiar que são
números diferentes: ela confere, e não são.

### 5.2 Três seletores de período, sem memória entre telas

| Tela | Como se escolhe o período | Onde |
|---|---|---|
| A Receber, A Pagar | `MonthNavigator` (◀ agosto ▶) | `MonthNavigator.tsx` |
| Resultado do Mês | setas próprias, formato `YYYY-MM` | `MonthlyResultSection.tsx:71` |
| DRE, Fluxo, Retorno | `De` / `Até` + presets | `DreSection.tsx:105` |

Cada um guarda o próprio estado. Mudar para julho em "A Receber" e ir ao
"Resultado" leva de volta a agosto.

### 5.3 As tabelas de contas têm coluna demais

**A Receber** tem 8 colunas; **A Pagar**, 9.

```
Descrição | Cliente | Valor | Recebido | Saldo | Vencimento | Status | Ações
```

Numa conta normal (a maioria), `Recebido` é `R$ 0,00` e `Saldo` é igual a
`Valor`: **duas colunas repetindo a terceira**. E `Status` diz o que `Vencimento`
+ `Saldo` já dizem — "Vencida" ao lado de uma data em vermelho com "há 12 dias".

### 5.4 A palavra "conta" significa três coisas na mesma barra

**A Receber / A Pagar** → conta = cobrança, um título.
**Contas e Saldos** → conta = onde o dinheiro fica (gaveta, banco).

Conceitos sem relação disputando a mesma palavra, lado a lado.

### 5.5 O que é único está escondido no fim

**Retorno por Peça** é a única tela que responde *"estou cobrando barato?"* — a
pergunta mais cara de errar num ateliê — e é a **última aba**. **Divisão** é a
penúltima. Enquanto isso o DRE (jargão contábil, uso mensal, público = contador)
ocupa posição nobre.

### 5.6 Alerta que nunca cala vira decoração

`OverviewSection.tsx:203` mostra, em faixa verde permanente:

> ✅ Dá para pagar tudo sem o saldo ficar negativo.

Ela está lá todo dia em que está tudo bem — quase sempre. O olho aprende a pular
aquela faixa, e no dia em que ela vira o alerta vermelho **no mesmo lugar**, ele
pula também.

### 5.7 O módulo foi desenhado para um volume que o ateliê não tem

Com 20 OS por mês, há ~15 contas a receber abertas. Sobre elas o sistema oferece
paginação de 20 a 200 linhas, busca no extrato, gráfico de projeção e **aging em
quatro faixas** com barra proporcional. Quatro faixas para oito contas não é
análise, é enfeite: cada faixa tem uma ou duas contas, já listadas logo abaixo.

**Regra:** desenhar para **n = 10**, não para n = 1.000.

### 5.8 Nenhuma tela do financeiro funciona no celular

O `Layout` é responsivo (`Layout.tsx:49`), mas nas telas financeiras `xs:`
aparece **só nas páginas de impressão**. As tabelas de 8 e 9 colunas viram
rolagem horizontal no telefone — e o telefone é onde ela está, no balcão.

---

## 6. Os princípios

### 6.1 Uma pergunta por tela

Toda tela deve ter **uma** pergunta no topo, respondida com **um** número grande.
Se responde duas, são duas telas — ou uma pergunta a menos.

| Pergunta | Frequência | Tela |
|---|---|---|
| Como está tudo agora? | todo dia | **Painel** |
| Quanto tem na gaveta e bate? | todo dia | **Caixa** |
| Quem me deve / a quem eu devo? | toda semana | **Contas do mês** |
| Como foi o mês e no quê? | todo mês | **Resultado** |
| Onde o dinheiro está e o banco confirma? | toda semana | **Onde está o dinheiro** |
| Estou cobrando barato? | todo trimestre | **Quanto rende cada peça** |
| Quanto cabe a cada uma? | todo mês | **Divisão do mês** |

### 6.2 O teste dos três segundos

Para cada tela: **1.** O que estou vendo? · **2.** Isso está bom ou ruim? ·
**3.** O que faço agora?

| Tela | 1. O quê | 2. Bom/ruim | 3. E agora |
|---|---|---|---|
| Painel | ✅ | ✅ | ⚠️ cinco blocos, nenhum próximo passo óbvio |
| Caixa | ✅ | ✅ | ✅ |
| A Receber / A Pagar | ✅ | ✅ vermelho + "há 12 dias" | ✅ botão Receber |
| Contas e Saldos | ⚠️ "conta" ambíguo | ✅ | ⚠️ conciliar não se explica |
| Resultado do Mês | ✅ | ✅ | ❌ nenhum |
| Divisão | ✅ | ⚠️ | ✅ retirada |
| Fluxo de Caixa | ⚠️ realizado ou previsto? | ⚠️ | ❌ nenhum |
| **DRE** | ❌ **a sigla não diz nada** | ✅ | ❌ nenhum |
| Retorno por Peça | ⚠️ "retorno" é vago | ✅ | ❌ nenhum |

**O padrão:** as telas de operação passam nas três; as de análise respondem "o
quê" e param. Uma tela que só informa faz a usuária sentir que precisa entender
sozinha o que fazer com aquilo — e essa sensação **é** a confusão que motivou
este documento.

**Regra:** toda tela de análise termina com uma frase que aponta o próximo passo.

| Tela | Frase de fecho |
|---|---|
| Resultado | *"O que mais subiu foi Tecidos, +40% (R$ 350). Ver as compras do mês →"* |
| Quanto rende cada peça | *"Ajuste de bainha rende R$ 18/h, menos da metade da meta. Rever preço →"* |
| Previsão | *"Falta dinheiro em 22/08. Antecipar um recebimento →"* (já existe) |
| Onde está o dinheiro | *"3 lançamentos ainda não conferidos com o banco. Conferir →"* |

### 6.3 As sete regras de tela intuitiva

**1. O nome da aba é a pergunta, não o artefato contábil.**

| Hoje | Intuitivo |
|---|---|
| DRE | **Resultado** (e "DRE" só no PDF do contador) |
| Retorno por Peça | **Quanto rende cada peça** |
| Fluxo de Caixa | **Previsão** |
| Contas e Saldos | **Onde está o dinheiro** |

**2. O botão diz o que vai acontecer.**

| Hoje | Intuitivo |
|---|---|
| `Confirmar` | `Receber R$ 480,00 no Pix` |
| `Salvar` (fechamento) | `Fechar o caixa com R$ 340,00` |
| `Conciliar` | `Confere com o banco` |
| `Gerar recorrências` | `Criar as contas dos próximos meses` |

O botão é a última coisa lida antes da ação irreversível — é ali que a frase
precisa estar inteira, não no título do diálogo.

**3. Números na unidade da vida real.** Se o número precisa ser interpretado, a
tela não terminou o trabalho.

| Hoje | Proposto |
|---|---|
| margem de 34,2% | de cada R$ 100 que entrou, **R$ 34 sobraram** |
| Ganho por hora R$ 42/h · meta R$ 38/h (+10%) | cada hora de costura rendeu **R$ 42** — R$ 4 acima da meta |
| aging: 61-90 dias · R$ 600 | **R$ 600** estão parados há mais de dois meses |
| coversPayables: true | dá para pagar as contas do mês |

**4. Desfazer no lugar de "tem certeza?".** O `reversePayment` já existe — a peça
difícil está pronta. Falta a fácil: depois de receber, uma faixa por alguns
segundos —

> ✅ Recebido R$ 480,00 de Maria Silva. **Desfazer**

Sistema com desfazer visível é sistema em que a pessoa clica sem medo, e gente
sem medo aprende a tela sozinha. Confirmação fica **só** para o que não tem
volta: cancelar conta, fechar o mês. Vale dobrado aqui, porque quem erra é quem
confere (§2d).

**5. Uma tela, uma ação primária.** Em `A Receber` convivem hoje no mesmo peso:
`Nova Conta`, `Receber`, `Editar`, `Histórico`, `Estornar`, `Cobrar no WhatsApp`,
`Cancelar`. A ação primária é **receber**; todo o resto é `⋯`.

**6. Faixa colorida só quando há ação a tomar hoje.** Estado normal é texto
cinza. Bloco vazio não ocupa espaço: "Nenhuma conta vencida" não precisa de um
painel, precisa de não estar lá.

**7. Estado vazio que ensina.** Hoje: *"Nenhuma movimentação no período
selecionado"* — a tela parece quebrada.

```
   Nenhuma movimentação em agosto ainda.
   As entradas aparecem aqui quando você recebe uma conta
   ou lança uma venda no caixa.
                                        [Abrir o caixa]
```

É a **primeira** tela que todo usuário novo vê: o melhor lugar do sistema para
ensinar, e hoje o pior.

### 6.4 Duas regras de dado

**As duas datas.** Quase toda confusão do financeiro vem de misturar:

- **Vencimento** — quando o dinheiro *era pra* entrar/sair. É promessa.
- **Baixa** (`paidAt`) — quando entrou/saiu de verdade. É fato.

Telas de cobrança trabalham com vencimento; telas de resultado, com baixa. O bug
corrigido em 2026-08-03 (conta paga adiantada aparecendo no mês seguinte) foi
sintoma de essa regra ser invisível. A tela deve dizer, sob o navegador de mês:

> *em aberto pelo vencimento · quitada pelo dia em que o dinheiro entrou*

**Um vocabulário só.** `Entrou` / `Saiu` / `Sobrou` em todas as telas de
operação. `Receita` / `Despesa` / `Resultado` **apenas** no PDF do contador, onde
é o contador que pede assim.

---

## 7. Validação tela a tela

As onze telas foram lidas por inteiro. Cada uma recebe um veredito de quanto
precisa mudar — e o §7.12 registra o que a leitura **corrigiu** das afirmações
feitas antes dela.

| Tela | Precisa reestruturar? | O essencial |
|---|---|---|
| Painel | **média** | hierarquia + fila de trabalho; conteúdo já está certo |
| Caixa | **pequena** | 4 cartões viram 1 + 3; desfazer escondido |
| Histórico de Caixas | **grande** (e deixa de ser aba) | 10 colunas → 4 |
| A Receber | **média** | 8 colunas → 5; aging vira frase |
| A Pagar | **média** | idem, mais reconciliar com a gêmea |
| Contas e Saldos | **pequena** | renomear; conciliação está invisível |
| Resultado do Mês | **média** | absorve o DRE; ganha frase de fecho |
| DRE | **deixa de existir** | vira botão de impressão |
| Fluxo de Caixa | **grande** | perde o extrato e vira Previsão |
| Divisão | **pequena** | 4 alertas empilhados → 1 |
| Retorno por Peça | **pequena** | nome e frase de fecho |

### 7.1 Painel — média

O conteúdo está certo e a leitura confirmou: nada a remover, tudo a reordenar.

- Cinco `Panel` de mesmo peso visual; o olho não sabe onde pousar → §8.1.
- Quatro caixinhas de saldo por conta repetem a tela "Onde está o dinheiro" →
  vira uma linha de texto.
- Dois `Alert` embutidos no card "Dinheiro hoje" (cartão a caminho, sinais
  comprometidos) são informação, não aviso → viram linha `▸` clicável.
- `OverviewSection.tsx:203` — faixa verde permanente → texto discreto (§5.6).
- "Atrasados" ocupa uma faixa inteira para dizer "Nenhuma conta vencida 🎉" →
  some quando vazio e vira item da fila quando não.
- Falta a linha "dá para retirar com segurança" (§4.1).

### 7.2 Caixa — pequena

**É a melhor tela do módulo em fluxo.** Abrir → lançar → sangria → fechar com
contagem por cédula e conferência às cegas: funciona, e não deve ser mexido.

- Quatro cartões de mesmo tamanho, mas só **"Esperado na gaveta"** decide alguma
  coisa; abertura, entradas e saídas são detalhe → 1 grande + 3 pequenos.
- A coluna **"Quem"** (`:560`) mostra sempre o mesmo nome hoje (§2) → esconder
  enquanto houver um usuário só. **Não remover do banco** — a autoria é o que
  torna a tela útil no dia da contratação.
- O estorno está atrás de um ícone `Undo` na última coluna (`:610`) → é a ação de
  correção mais importante do módulo e merece o padrão de desfazer (§6.3).
- A nota de rodapé explicando que Pix e cartão não passam pela gaveta (`:628`) é
  ótima e deve ser mantida.

### 7.3 Histórico de Caixas — grande, e deixa de ser aba

**A tabela mais larga do módulo são 10 colunas** (`:85-94`), não as de contas.

- `Abriu` e `Fechou` são sempre o mesmo nome hoje → esconder (mesma regra do
  §7.2).
- `Abertura`, `Esperado`, `Contado` e `Diferença` são quatro colunas para
  responder uma pergunta: *bateu?* → uma coluna de resultado, com o resto no
  detalhe.
- Três cartões de resumo onde só **"Fechamentos com diferença"** importa.
- Fica: `Dia · Fechou às · Bateu? · Lançamentos · [relatório]`.
- Vira link *"ver caixas anteriores"* dentro de Caixa — é consulta esporádica.

### 7.4 A Receber — média

Confirmado o que estava no §5.3 e §5.7. Além disso:

- O painel de **idade da dívida** (`:307`) ocupa espaço fixo acima da tabela todo
  dia → vira uma frase condicional.
- O botão `Receber` divide peso com seis outras ações → §6.3, regra 5.
- Sem tratamento de celular (§5.8).

### 7.5 A Pagar — média, mais um problema que só ela tem

Mesmos ajustes da gêmea, **e uma divergência entre as duas que precisa ser
resolvida junto**: as telas nasceram simétricas e deixaram de ser.

| | A Receber | A Pagar |
|---|---|---|
| Filtro por categoria | não tem | tem |
| Fixas × variáveis | — | **tem** (`:228`) |
| Idade da dívida | tem | não tem |
| Cobrar no WhatsApp | tem | n/a |

O bloco **fixas × variáveis** é dos poucos do módulo que mudam decisão (é o que
diz o que dá para cortar) e deve ser preservado na fusão. O filtro por categoria
deve valer para os dois lados.

### 7.6 Contas e Saldos — pequena

Estruturalmente é a tela mais enxuta do módulo: 2 cartões e 4 colunas. Os
problemas são de descoberta, não de excesso:

- O nome colide com "contas a receber/pagar" (§5.4) → **Onde está o dinheiro**.
- **A conciliação não aparece na tela.** Ela vive dentro do `StatementDialog`, a
  dois cliques, e a única pista é um "conferido até 12/08" em letra pequena
  dentro da coluna **Tipo** (`:407`) — o lugar errado. Deve ser coluna própria,
  com a frase de fecho do §6.2.
- Recebe o extrato que hoje está no Fluxo de Caixa (§8.4).

### 7.7 Resultado do Mês — média

- Absorve o DRE (§8.3): ganha período livre e o botão de impressão.
- "De onde veio / Para onde foi" ganha a comparação com o período anterior, que
  hoje só o DRE tem.
- `margem de 34,2%` → frase (§6.3, regra 3).
- Ganha frase de fecho.
- O histórico de meses com barras (`:222`) é bom e fica.

### 7.8 DRE — deixa de existir como aba

Nada a reestruturar: o conteúdo migra inteiro para Resultado e a sigla sobrevive
só no PDF do contador, que é quem pede assim.

### 7.9 Fluxo de Caixa — grande

A tela responde a duas perguntas ao mesmo tempo — *o que já entrou* e *o que vai
entrar* — e é por isso que ninguém sabe dizer o que está olhando (§6.2).

- **Sai:** o extrato de movimentações com busca e paginação (`:254-327`) → migra
  para "Onde está o dinheiro".
- **Sai:** os cartões "Total Recebido / Total Pago / Resultado", que repetem
  Resultado com outro nome (§5.1).
- **Fica:** o gráfico de projeção, o alerta de saldo negativo (`:191`) — que é a
  melhor frase acionável do módulo — e os chips por forma de pagamento.
- Vira **Previsão**: uma tela, um gráfico, um aviso.

### 7.10 Divisão — pequena, e é a tela a copiar

**É a melhor tela do módulo em clareza de raciocínio.** O bloco "Quanto sobrou
para dividir" (`:288`) abre a conta linha a linha — entrou, saiu, resultado,
menos sinais de peças não entregues, menos prejuízo anterior, **A DIVIDIR** — e é
exatamente o padrão proposto no §4.1 para a linha de retirada. Não precisa ser
inventado: precisa ser copiado.

O que muda:

- **Quatro `Alert` empilhados** no topo (`:240-286`): prejuízo, nada a dividir,
  regra inválida, divisão fechada. Nunca aparecem os quatro juntos, mas dois
  aparecem — e aí o topo da tela vira um muro. Um só por vez, por prioridade.
- Renomear para **Divisão do mês** e subir na barra.

### 7.11 Retorno por Peça — pequena

Conteúdo específico e bem resolvido; a ordenação por valor/hora já é a leitura
certa.

- Nome → **Quanto rende cada peça** (§6.3, regra 1).
- Ganha frase de fecho apontando o serviço abaixo da meta.
- Sobe na barra.

### 7.12 O que a leitura corrigiu

Quatro afirmações feitas antes de ler tudo não sobreviveram — ficam registradas
porque mudam o trabalho:

**a) "Os estados vazios não ensinam" — parcialmente errado.** O do Caixa
(`CashRegisterSection.tsx:464`) é exemplar: explica o que é o caixa em duas
linhas e oferece um botão. **Correção:** não inventar um padrão — copiar esse.

**b) "Falta um lugar que abra a conta" — já existe.** É a Divisão (§7.10). A
linha de retirada do §4.1 é uma aplicação desse padrão, não uma novidade.

**c) "A tabela mais larga é A Pagar, com 9 colunas" — errado.** É o Histórico de
Caixas, com 10.

**d) "Nenhuma tela de análise sugere o próximo passo" — errado.** A Divisão
sugere ("cobrir com a reserva", "ajustar regra") e a Previsão também ("antecipe
um recebimento"). São as duas exceções, e as duas mostram que o padrão do §6.2 já
tem precedente no módulo.

**Achado novo:** com um usuário só, as colunas `Quem`, `Abriu` e `Fechou` mostram
sempre o mesmo nome — três colunas mortas hoje, em duas telas. Devem sumir **da
tela**, nunca do banco: são o registro que torna essas telas úteis quando houver
uma segunda pessoa.

---

## 8. A estrutura proposta: de 11 abas para 7

| Hoje | Proposto | O que acontece |
|---|---|---|
| Painel | **Painel** | fica, com menos alerta e uma fila de trabalho |
| Caixa | **Caixa** | fica |
| Histórico de Caixas | — | vira link *"ver caixas anteriores"* dentro de Caixa |
| A Receber | **Contas do mês** | uma tela, dois lados (A receber ⟷ A pagar) |
| A Pagar | ↑ | |
| Contas e Saldos | **Onde está o dinheiro** | renomeada; absorve o extrato do Fluxo |
| Resultado do Mês | **Resultado** | funde com o DRE |
| DRE | ↑ | vira o botão *"PDF para o contador"* |
| Fluxo de Caixa | **Previsão** | fica só a projeção |
| Divisão | **Divisão do mês** | sobe de posição |
| Retorno por Peça | **Quanto rende cada peça** | sobe de posição |

```
DIA A DIA   Painel · Caixa · Contas do mês
ANÁLISE     Resultado · Onde está o dinheiro · Previsão · Quanto rende cada peça · Divisão do mês
```

### 8.1 Painel

O conteúdo está certo; o problema é que **cinco blocos de mesmo peso visual** não
formam uma leitura.

```
  PRECISA DE VOCÊ HOJE                                   4 itens
  ⚠  3 contas vencidas somando R$ 1.240              [cobrar]
  ⚠  O caixa de ontem não foi fechado                [fechar]

┌──────────────────────────────────────────────────────────────┐
│  Você tem hoje                                               │
│  R$ 12.480,00                          ● caixa aberto 08:12  │
│  gaveta 340 · banco 11.140 · reserva 1.000                   │
│  ▸ R$ 2.300 são sinais de 4 peças ainda não entregues        │
│  Dá para retirar com segurança          R$ 1.850             │
└──────────────────────────────────────────────────────────────┘

  AGOSTO            ATÉ O FIM DO MÊS        SAÚDE
  Entrou   8.200    A receber   3.100       Custo fixo coberto ✓
  Saiu     5.400    A pagar     2.400       Cada hora rendeu R$ 42
  Sobrou  +2.800    Fecha em   13.180       (meta R$ 38)
  ▲ +18% vs julho   dá para pagar tudo
```

1. **Um número domina**: quanto tem hoje.
2. O detalhe por conta vira **uma linha de texto** — saldo por conta é assunto da
   tela "Onde está o dinheiro".
3. Os três blocos do meio ficam **sem alerta dentro**; "dá para pagar tudo" é
   texto discreto, e só quando **não** dá é que vira faixa vermelha.
4. Cartão a cair e sinais comprometidos entram como **linha `▸` clicável**. São
   informação, não aviso.
5. "Atrasados" sai do fim e vira item da fila, no topo.

### 8.2 Contas do mês

Uma tela, um seletor de mês, um botão que alterna o lado:

```
◀  agosto de 2026  ▶            [ A receber ] [ A pagar ]     [+ Nova]
   em aberto pelo vencimento · quitada pelo dia em que o dinheiro entrou

  A receber no mês          Vencido              Já recebido
  R$ 3.100,00               R$ 1.240 (3)         R$ 5.800,00
```

Tabela em **5 colunas** no lugar de 8:

| Cliente | Descrição | Vencimento | Valor | |
|---|---|---|---|---|
| Maria Silva | OS-00142 — saldo | **12/08** · há 12 dias | **R$ 480,00** | `Receber` `⋯` |
| Ana Costa | OS-00151 — saldo | 28/08 | R$ 1.200,00 <br><sub>recebido 300 de 1.500</sub> | `Receber` `⋯` |

- `Recebido` e `Saldo` viram **subtexto, só quando houver pagamento parcial**.
- `Status` sai; cancelada e quitada continuam como chip, porque aí o chip é a
  única pista.
- `Ações` vira **um botão primário** e um `⋯` com o resto.
- A "idade da dívida" vira **uma frase**, e só quando houver algo há mais de 60
  dias: *"R$ 600 estão parados há mais de dois meses."*
- Abaixo de `md`, cada linha vira cartão:

```
┌────────────────────────────────┐
│ Maria Silva                    │
│ OS-00142 — saldo               │
│ vence 12/08 · há 12 dias       │
│ R$ 480,00        [Receber] [⋯] │
└────────────────────────────────┘
```

### 8.3 Resultado (funde Resultado do Mês + DRE)

```
◀  agosto de 2026  ▶        [ mês ] [ trimestre ] [ ano ] [ período… ]
                                              [PDF para o contador]

  Entrou            Saiu              Sobrou
  R$ 8.200          R$ 5.400          + R$ 2.800
  ▲ +18%            ▲ +6%             de cada R$ 100, sobraram R$ 34

  DE ONDE VEIO                     PARA ONDE FOI
  Costura      6.900  ▲ +21%       Aluguel      1.800   =
  Ajustes      1.100  ▼ -8%        Tecidos      1.240  ▲ +40%
  Venda direta   200               Energia        410  ▲ +12%

  HISTÓRICO  ▔▔▔▔▔▔▔▔▔▔▔ (últimos 6 meses, clicável)

  O que mais subiu foi Tecidos, +40% (R$ 350).  Ver as compras do mês →
```

O DRE deixa de ser aba: vira o botão de impressão desta tela. O período livre —
única coisa que ele tinha a mais — entra como preset. A comparação com o período
anterior passa a valer para as duas tabelas.

### 8.4 Onde está o dinheiro (era Contas e Saldos)

Absorve o **extrato de movimentações** que hoje mora no fim do Fluxo de Caixa —
extrato é sobre "o que passou pela conta", que é esta tela. Fica: saldo por conta
→ extrato da conta selecionada → conciliação.

### 8.5 Previsão (era Fluxo de Caixa)

Sem o extrato, sobra o que só ela faz: **o gráfico do saldo projetado dia a dia e
o aviso de quando ele fura.** Uma tela, um gráfico, um alerta, uma frase.

### 8.6 Divisão do mês e Quanto rende cada peça

Só mudam de nome e de posição — sobem. O conteúdo já é bom e específico.

---

## 9. Ideias avaliadas

### ✅ Vale a pena

**Modo balcão** — uma tela só: busca a cliente, vê as peças dela, recebe,
entrega, imprime o recibo. Sem abas, sem menu. Consequência natural do §3.1. Os
endpoints já existem. Só vale se substituir o caminho longo, não se virar mais
uma tela ao lado das outras.

**Recibo no WhatsApp depois de receber** — `PaymentReceiptPage` já gera o recibo
e a tela de cobrança já monta link `wa.me`. Falta juntar: recebeu → *"mandar
recibo para a Maria"*. Custo quase zero, e resolve a pergunta "já paguei aquilo?"
antes de virar ligação.

**Fechamento do dia guiado** — o diálogo de contagem por cédula vira um passo a
passo de três telas: *conte o dinheiro → confira as diferenças → assine*. Ao fim,
a frase que interessa: *"Fechou certinho"* ou *"Faltam R$ 12,00 — quer registrar
uma justificativa?"*. Reorganização de algo que já funciona; baixo risco.

**Checklist de primeira semana** — enquanto faltar configuração (categorias
fixas, meta de ganho por hora, regra de divisão, conta bancária), o Painel mostra
*"faltam 3 ajustes para os números ficarem certos"* com link direto.
Justifica-se sozinho: hoje, sem custo fixo configurado, o Painel mostra **"custo
fixo coberto ✓" com R$ 0,00** — uma resposta errada com cara de certa.

**Busca global alcançando o financeiro** — o módulo `search` não indexa contas.
Procurar "Maria" deveria trazer as contas dela junto com as OS. É o caminho mais
curto para "quanto a Maria me deve" e reaproveita módulo existente.

### ⚠️ Vale, mas não agora

**Importar extrato bancário (OFX/CSV)** — conciliar lançamento por lançamento não
escala, mas com ~40 lançamentos/mês ainda escala. Guardar para quando doer.

**Cobrança em lote** — cobrança de ateliê é decisão pessoal, cliente por cliente.
Ganho pequeno e risco real de constranger uma cliente boa. Só depois que a fila
do §4 estiver rodando.

### ❌ Descartadas

| Ideia | Por quê não |
|---|---|
| Painel personalizável / arrastar blocos | configuração é a forma de adiar a decisão de qual informação importa; a decisão é o produto |
| Metas por categoria, orçado × realizado | pressupõe alguém orçando todo mês; ateliê de 20 peças planeja olhando o mês passado, que o Histórico já mostra |
| Gráfico de pizza de despesas | quatro categorias em pizza é pior que quatro linhas: perde o valor exato e não compara com o mês anterior |
| Notificação por push / e-mail | a fila do §4 entrega o mesmo sem o sistema falar em nome do ateliê |
| Atalhos de teclado | a operação é no balcão e no celular, não em teclado; §5.8 rende mais |

---

## 10. Ordem de execução

Critério: **uma sócia, sozinha, trabalhando interrompida, sem ninguém para
conferir o que ela faz**. Ordenado por minuto economizado e erro evitado.

| # | Mudança | § | Por quê nesta posição | Esforço |
|---|---|---|---|---|
| **1** | **Receber dentro da entrega da OS** | 3.1 | mesma pessoa, mesmo segundo, cliente na frente — oito passos sem razão de existir | médio |
| **2** | **Fila "precisa de você hoje"** | 4 | ela não tem quem lembre; tela que precisa ser procurada não é aberta | médio |
| **3** | Desfazer no lugar de "tem certeza?" | 6.3 | quem erra é quem confere; o estorno já existe | baixo |
| 4 | Botões que dizem o que fazem | 6.3 | mesma razão do #3 | baixo |
| 5 | Tabelas de contas em 5 colunas | 8.2 | menos leitura por cobrança feita | baixo |
| 6 | Linha "dá para retirar com segurança" | 4.1 | é a decisão dela, e ninguém faz a conta | baixo |
| 7 | Vocabulário único | 6.4 | uma cabeça só não deve traduzir três dialetos | baixo |
| 8 | Checklist de primeira semana | 9 | hoje o Painel diz "custo fixo coberto ✓" com R$ 0,00 | baixo |
| 9 | Renomear as abas para perguntas | 6.3 | trivial | trivial |
| 10 | Frase de fecho nas telas de análise | 6.2 | resolve o "e agora?" | baixo |
| 11 | Alertas só com ação · esconder bloco vazio | 5.6 | o vermelho volta a ser visto | baixo |
| 12 | Fundir DRE dentro de Resultado | 8.3 | uma aba a menos na cabeça dela | médio |
| 13 | Modo balcão | 9 | melhor tela para hoje, que já é a de amanhã (§2.1) | médio |
| 14 | Cartões no lugar de tabelas no celular | 5.8 | ela não fica sentada numa mesa | médio |
| 15 | Bloco financeiro na ficha da cliente | 3.2 | é o que decide o fiado | médio |
| 16 | Estados vazios que ensinam | 6.3 | — | baixo |
| 17 | Hierarquia do Painel | 8.1 | — | médio |
| 18 | Fundir A Receber + A Pagar | 8.2 | — | médio |
| 19 | Extrato migra para "Onde está o dinheiro" | 8.4 | — | médio |
| 20 | Aging vira frase · paginação condicional | 5.7 | — | baixo |
| 21 | Seletor de período compartilhado | 5.2 | — | médio |

### 10.1 Itens vindos da validação tela a tela

Todos de esforço baixo e independentes entre si — entram junto com o bloco de
"uma tarde":

| Mudança | § | Esforço |
|---|---|---|
| Histórico de Caixas: 10 colunas → 4 | 7.3 | baixo |
| Esconder colunas de autoria enquanto houver um usuário só | 7.12 | trivial |
| Caixa: 4 cartões iguais → 1 grande + 3 pequenos | 7.2 | baixo |
| Divisão: 4 alertas empilhados → 1 por vez | 7.10 | baixo |
| Conciliação com coluna própria, fora de "Tipo" | 7.6 | baixo |
| Reconciliar A Receber e A Pagar (categoria dos dois lados) | 7.5 | baixo |

**Se for para fazer uma coisa só:** a #1 — é o único item que tira trabalho de
alguém em vez de reorganizar pixels.

**Se for para fazer uma tarde:** #3, #4, #5, #7, #9 e a tabela do §10.1 — todas
independentes.

Os dois primeiros não são melhoria de tela: são a diferença entre um sistema que
ela usa e um que ela contorna. **Enquanto contornar, os números vão chegar
incompletos** — e nenhum layout conserta lançamento que não foi feito.

---

## 11. O que **não** fazer

- **Não apagar tela nenhuma sem fundir antes.** Todo dado aqui tem dono; sumir
  com ele é pior que repetir.
- **Não mexer no Caixa** além do fechamento guiado. É a tela mais usada e a mais
  bem resolvida.
- **Não trocar tabela por gráfico** em Contas do mês. Cobrança se faz lendo nome,
  valor e data.
- **Não unificar Caixa e Contas** por serem "as duas de dinheiro". Caixa é a
  gaveta física de um turno; Contas é o combinado com terceiros — juntar volta a
  misturar o que a Fase 3 separou.
- **Não criar tela por papel** enquanto houver um usuário só (§2.1).

---

## Anexo — Permissões: fora do escopo desta rodada

Registrado porque foi encontrado, **não para ser mexido agora**.

Como hoje existe um único usuário com acesso total, nada disto tem efeito
prático. Fica para o dia da primeira contratação.

`seed.ts:33` dá ao papel `atendente` **todas as permissões de leitura** do
sistema e nenhuma de escrita no financeiro. `financial.controller.ts:43` protege
o módulo inteiro com `read:financial`. O resultado, verificado endpoint por
endpoint:

| Não pode fazer (exige `update:financial`) | Onde |
|---|---|
| Abrir o caixa | `financial.controller.ts:67` |
| Lançar uma venda no caixa | `:81` |
| Fazer sangria | `:92` |
| Receber o pagamento de uma cliente | `:131` |

| Pode ver (basta `read:financial`) | Por que é estranho |
|---|---|
| **Divisão** (`:347`) | quanto cada sócia leva para casa, com nome e valor |
| Resultado, DRE | o lucro do ateliê |
| Quanto rende cada peça | a margem de cada serviço |
| Onde está o dinheiro | o saldo bancário |

Ou seja: a pessoa do balcão não poderia registrar o dinheiro que recebe, mas
poderia ver quanto cada sócia retirou no mês.

**Quando for tratar**, duas coisas juntas: dar `update:financial` restrito a
caixa/receber/lançar, tirar a leitura de divisão e resultado — e fazer o menu
**esconder** o que a pessoa não pode usar, em vez de mostrar e negar no clique.
Botão que dá erro de permissão ensina o usuário a não confiar na tela.
