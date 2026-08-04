# Backlog — Ateliê de Costura SaaS

> Gerado em 2026-07-31. **Revisado em 2026-08-02**: as histórias já implementadas
> foram retiradas e as parcialmente implementadas foram reduzidas ao que ainda falta.
> Prioridade: **P0** (bloqueador), **P1** (essencial MVP), **P2** (diferencial), **P3** (futuro).
>
> Nas histórias parciais, a linha **Já existe** descreve o que está pronto no código;
> os critérios listados são apenas os que continuam pendentes.

---

## Já concluído (retirado do backlog em 2026-08-02)

| # | História | Onde está |
|---|---|---|
| US-04 | Gestão de usuários e perfis | `settings/UsersTab.tsx`, `UserDialog.tsx`, `RolesTab.tsx` |
| US-13 | Criação de orçamento | `quotes/`, `QuoteFormPage.tsx` |
| US-14 | Aprovação de orçamento e conversão para OS | `ConvertDialog.tsx`, `quotes.service.ts` |
| US-16 | Histórico e duplicação de orçamentos | `POST /quotes/:id/duplicate`, reabertura de recusado/expirado |
| US-17 | Criação de Ordem de Serviço | `WorkOrderFormPage.tsx`, `PieceMeasurements.tsx`, anexos |
| US-18 | Kanban de produção | `KanbanBoard.tsx` (drag-and-drop) |
| US-19 | Fila de produção por costureira | `QueuesTab.tsx`, `dailyCapacityHours` |
| US-20 | Andamento e atualizações da OS | `ProgressCard.tsx`, `WorkOrderUpdate` |
| US-21 | Registro de entrega da peça | `DeliverDialog.tsx`, `deliveredById`, `WorkOrderReceiptPage.tsx` |
| US-22 | Agendamento de atendimento | `Schedule/` (mês, semana, dia, conflitos, vínculos) |
| US-24 | Visão de prazo das OS no calendário | `SchedulePage.tsx` (switch "Prazos das OS") |
| US-25 | Controle de entrada de materiais | `EntryDialog.tsx`, `InventoryMovement` (NF, fornecedor, custo) |
| US-27 | Inventário e ajuste de estoque | `CountTab.tsx`, `InventoryCount` |
| US-29 | Registro de pagamento | `Payment`, parcelamento, sinal, troco, comprovante |
| US-30 | Contas a receber | `ReceivablesSection.tsx` |
| US-31 | Contas a pagar | `PayablesSection.tsx`, recorrência mensal/anual |
| US-32 | Caixa diário | `CashRegisterSection.tsx`, sangria, suprimento, fechamento |
| US-33 | Fluxo de caixa | `CashFlowSection.tsx`, projeção, CSV |
| US-34 | Categorização de lançamentos | `FinancialCategory`, `DreSection.tsx` ¹ |
| US-47 | Impressão de orçamento | `QuotePrintPage.tsx`, `generateQuotePdf.ts` |
| US-49 | Recibo de pagamento | `PaymentReceiptPage.tsx` |

¹ Implementado, porém a **receita nunca recebe categoria** — está registrado como
problema P1 em [`FINANCEIRO_AVALIACAO.md`](FINANCEIRO_AVALIACAO.md), junto com o
plano de melhoria do módulo financeiro.

---

## Índice de Épicos (pendentes)

| # | Épico | Pendentes | Prioridade |
|---|-------|-----------|------------|
| E1 | Autenticação e Controle de Acesso | 4 | P0 |
| E2 | Gestão de Clientes e Medidas | 5 | P1 |
| E3 | Catálogo de Serviços e Produtos | 2 | P1 |
| E4 | Orçamentos | 1 | P2 |
| E6 | Agenda | 1 | P2 |
| E7 | Estoque | 2 | P2 |
| E8 | Financeiro | — (ver `FINANCEIRO_AVALIACAO.md`) | P1 |
| E9 | Relatórios e Dashboard | 5 | P1 |
| E10 | Notificações | 4 | P2 |
| E11 | PWA e Mobile | 3 | P2 |
| E12 | Impressão e PDF | 3 | P1 |
| E13 | Multi-tenant e Planos SaaS | 3 | P2 |
| E14 | Integrações de Pagamento | 2 | P2 |
| E15 | Onboarding e UX | 4 | P1 |
| E16 | Segurança e Conformidade | 4 | P1 |
| E17 | Infraestrutura e DevOps | 3 | P1 |
| E18 | Testes Automatizados | 3 | P1 |

**E5 (Ordens de Serviço) foi concluído por inteiro.**

---

## E1 — Autenticação e Controle de Acesso

### US-01 Login com email e senha *(parcial)*
**Já existe:** login com JWT, validação de campos, erro genérico de credenciais.

**Critérios pendentes:**
- [ ] Refresh token automático — usuária não é deslogada durante o uso (não há endpoint de refresh)
- [ ] Bloqueio após 5 tentativas incorretas por 15 minutos

**Estimativa restante:** 3 pts | **Prioridade:** P0

---

### US-02 Logout e sessão *(parcial)*
**Já existe:** botão de logout e limpeza do token no cliente.

**Critérios pendentes:**
- [ ] Refresh token invalidado no servidor ao fazer logout
- [ ] Sessão inativa por 2h exibe aviso e redireciona para login

**Estimativa restante:** 2 pts | **Prioridade:** P0

---

### US-03 Recuperação de senha
**Como** usuária, **quero** recuperar minha senha por e-mail, **para** não perder acesso à conta.

> Hoje só existe troca de senha autenticada (`PATCH /auth/change-password`).

**Critérios de aceite:**
- [ ] Campo "Esqueci minha senha" na tela de login
- [ ] E-mail com link de redefinição válido por 1h
- [ ] Senha redefinida invalida link e sessões anteriores
- [ ] Força de senha mínima: 8 caracteres, letras e números

**Estimativa:** 2 pts | **Prioridade:** P0

---

### US-05 Permissões granulares por módulo *(parcial)*
**Já existe:** modelos `Role`/`Permission`/`RolePermission`, tela de papéis com
marcação de permissões, e `roles.guard.ts` escrito.

**Critérios pendentes:**
- [ ] **O guard não é usado em nenhum controller** — hoje qualquer usuária logada
      acessa qualquer endpoint, inclusive o financeiro (sangria, divisão das sócias)
- [ ] Frontend oculta menus e botões sem permissão (o menu lateral é igual para todos)
- [ ] Perfil Costureira: acessa OS, Agenda, Clientes; não acessa Financeiro
- [ ] Perfil Financeiro: acessa tudo financeiro; não acessa configurações de sistema

**Estimativa restante:** 5 pts | **Prioridade:** P1

---

## E2 — Gestão de Clientes e Medidas

### US-06 Cadastro de cliente *(parcial)*
**Já existe:** campos principais (nome, CPF com máscara, telefones, e-mail,
nascimento, observações), validação e criação/edição.

**Critérios pendentes:**
- [ ] Busca por CPF: se já cadastrada, abre o perfil existente (evita duplicatas)
- [ ] Endereço completo com busca por CEP via ViaCEP
- [ ] Foto de perfil opcional (upload)
- [ ] AutoSave no formulário (o hook `useAutosave` já existe e é usado em orçamentos e agenda)

**Estimativa restante:** 3 pts | **Prioridade:** P1

---

### US-07 Edição e histórico da cliente *(parcial)*
**Já existe:** edição de todos os campos e exclusão lógica (`deletedAt`).

**Critérios pendentes:**
- [ ] Histórico de alterações da cliente (campo, valor anterior, novo, quem, quando) —
      o `AuditLog` existe, mas não há visão por cliente
- [ ] Campo "Ativa/Inativa" para arquivar clientes sem movimento

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

### US-08 Ficha de medidas do corpo *(parcial)*
**Já existe:** ficha com 11 medidas padrão, **tipos de medida personalizados por
cliente**, histórico versionado por data e medidas específicas por peça na OS.

**Critérios pendentes:**
- [ ] Alerta visual quando as medidas têm mais de 6 meses
- [ ] Impressão da ficha de medidas em formato A5 (ver US-50)

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

### US-09 Listagem e busca de clientes *(parcial)*
**Já existe:** busca por nome, e-mail, telefone e CPF; paginação; contagem de OS.

**Critérios pendentes:**
- [ ] Filtros: ativas/inativas, clientes com OS em andamento, aniversariantes do mês
- [ ] Ordenação por última visita e total gasto
- [ ] Card da cliente com foto, última OS e total de peças

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

### US-10 Perfil unificado da cliente
**Como** atendente, **quero** ver em uma única tela todas as informações de uma cliente, **para** atendê-la sem navegar entre módulos.

> Hoje o formulário de edição mostra só os dados e a ficha de medidas. Orçamentos,
> OS e financeiro da cliente ficam em outros módulos.

**Critérios de aceite:**
- [ ] Abas: Dados, Medidas, Orçamentos, Ordens de Serviço, Financeiro, Histórico
- [ ] KPIs rápidos: total gasto, número de peças, última visita, OS em aberto
- [ ] Botões de ação rápida: Novo Orçamento, Nova OS, Agendar, Registrar Pagamento
- [ ] Timeline de todas as interações ordenada por data

**Estimativa:** 5 pts | **Prioridade:** P1

---

## E3 — Catálogo de Serviços e Produtos

### US-11 Cadastro de serviços *(parcial)*
**Já existe:** nome, descrição, preço base, unidade, horas estimadas, ativo/inativo.

**Critérios pendentes:**
- [ ] Categorias customizáveis pela proprietária
- [ ] Histórico de alteração de preço (quando mudou, de quanto para quanto)
- [ ] Variações do serviço (vestido simples / festivo / noiva, com preços diferentes)
- [ ] Importação de lista de serviços via CSV

**Estimativa restante:** 4 pts | **Prioridade:** P1

---

### US-12 Cadastro de produtos/materiais *(parcial)*
**Já existe:** nome, SKU, categoria, unidade, preço de custo e venda, fornecedor,
estoque mínimo.

**Critérios pendentes:**
- [ ] Código de barras (EAN) com leitura via câmera do celular
- [ ] Produto marcado como "somente para uso interno" (não aparece em orçamento)

**Estimativa restante:** 3 pts | **Prioridade:** P2

---

## E4 — Orçamentos

### US-15 Envio de orçamento por WhatsApp/e-mail *(parcial)*
**Já existe:** envio por WhatsApp (`wa.me`), link público do orçamento, mensagem
personalizável nas configurações, status "Enviado" e log de envios (`QuoteSend`).

**Critérios pendentes:**
- [ ] Botão "Enviar por e-mail" dispara e-mail com o PDF em anexo

**Estimativa restante:** 3 pts | **Prioridade:** P2

---

## E6 — Agenda

### US-23 Lembrete de compromisso
**Como** atendente, **quero** que o sistema lembre as clientes dos compromissos agendados, **para** reduzir faltas.

**Critérios de aceite:**
- [ ] Lembrete automático por WhatsApp 24h antes do horário
- [ ] Lembrete por e-mail 24h antes (fallback)
- [ ] Mensagem personalizável nas configurações
- [ ] Log de lembretes enviados no evento

**Estimativa:** 5 pts | **Prioridade:** P2

---

## E7 — Estoque

### US-26 Baixa de materiais por OS *(parcial)*
**Já existe:** materiais consumidos dentro da OS, baixa automática do saldo,
validação de saldo insuficiente e rastreabilidade do movimento até a OS.

**Critérios pendentes:**
- [ ] Relatório de consumo por OS e por material

**Estimativa restante:** 2 pts | **Prioridade:** P2

---

### US-28 Alertas de estoque mínimo *(parcial)*
**Já existe:** card de materiais em alerta no Dashboard, aviso no sino e estoque
mínimo configurável por produto.

**Critérios pendentes:**
- [ ] Notificação push/WhatsApp ao atingir o estoque mínimo
- [ ] E-mail semanal com a lista de materiais abaixo do mínimo

**Estimativa restante:** 2 pts | **Prioridade:** P2

---

## E8 — Financeiro

Todas as histórias originais (US-29 a US-34) estão implementadas. As melhorias e
correções do módulo estão detalhadas em **[`FINANCEIRO_AVALIACAO.md`](FINANCEIRO_AVALIACAO.md)**,
organizadas em 5 fases — de correções de números divergentes a contas bancárias,
retiradas das sócias e painel financeiro.

---

## E9 — Relatórios e Dashboard

### US-35 Dashboard principal *(parcial)*
**Já existe:** KPIs (clientes, OS abertas, receita do mês, a receber), agenda do dia,
OS prioritárias, materiais em alerta e atualização automática.

**Critérios pendentes:**
- [ ] Gráfico de faturamento dos últimos 6 meses na página inicial
- [ ] Lista de pagamentos recebidos hoje
- [ ] Atalhos rápidos: Nova OS, Novo Orçamento, Agendar
- [ ] Corrigir a origem do "faturamento do mês" (ver P2 em `FINANCEIRO_AVALIACAO.md`)

**Estimativa restante:** 4 pts | **Prioridade:** P1

---

### US-36 Relatório de faturamento *(parcial)*
**Já existe:** receita por mês do ano e ranking de clientes.

**Critérios pendentes:**
- [ ] Filtros: período livre, tipo de serviço, costureira, cliente
- [ ] Total bruto, descontos, total líquido
- [ ] Comparativo com o período anterior (variação percentual)
- [ ] Exportação PDF e Excel

**Estimativa restante:** 4 pts | **Prioridade:** P1

---

### US-37 Relatório de OS (desempenho de produção)
**Como** proprietária, **quero** analisar a produção do ateliê, **para** identificar gargalos e melhorar prazos.

> Hoje existe apenas o gráfico de OS por status.

**Critérios de aceite:**
- [ ] Tempo médio por tipo de peça
- [ ] OS entregues no prazo vs. atrasadas (%)
- [ ] Volume por costureira
- [ ] OS canceladas com motivo
- [ ] Filtros por período e costureira

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-38 Relatório de clientes *(parcial)*
**Já existe:** ranking de clientes por valor gasto.

**Critérios pendentes:**
- [ ] Clientes novos vs. recorrentes por mês
- [ ] Taxa de retorno (% de clientes que voltaram em 90 dias)
- [ ] Aniversariantes do mês com opção de exportar lista
- [ ] Clientes sem OS nos últimos 6 meses (oportunidade de recontato)

**Estimativa restante:** 4 pts | **Prioridade:** P2

---

### US-39 Relatório financeiro (DRE simplificado) *(parcial)*
**Já existe:** DRE por categoria com período livre, resultado, margem e comparativo
mensal no "Resultado do Mês".

**Critérios pendentes:**
- [ ] Exportação em PDF para o contador (ver US-51)
- [ ] Receita por categoria de verdade — depende da correção P1 do financeiro

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

## E10 — Notificações

### US-40 Notificação de OS pronta por WhatsApp
**Como** atendente, **quero** que o sistema notifique a cliente quando a peça estiver pronta, **para** não precisar ligar manualmente.

**Critérios de aceite:**
- [ ] Ao mover OS para "Aguardando Retirada", dispara mensagem WhatsApp automática
- [ ] Mensagem inclui: nome da cliente, descrição da peça, saldo devedor, endereço do ateliê
- [ ] Mensagem é personalizável nas configurações
- [ ] Log de notificações enviadas
- [ ] Possível reenviar notificação manualmente

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-41 Alerta de prazo vencendo *(parcial)*
**Já existe:** OS atrasada aparece no sino, em vermelho no Kanban e destacada na agenda.

**Critérios pendentes:**
- [ ] Aviso 2 dias **antes** do prazo (hoje só avisa depois de vencer)
- [ ] E-mail diário com as OS que vencem em 48h

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

### US-42 Lembrete de pagamento vencido
**Como** proprietária, **quero** que o sistema envie lembrete para clientes com pagamento vencido, **para** facilitar a cobrança.

**Critérios de aceite:**
- [ ] Mensagem WhatsApp automática após X dias de vencimento (configurável)
- [ ] Template de mensagem personalizável
- [ ] Registro de cobranças enviadas
- [ ] Opção de desativar por cliente (não perturbar)
- [ ] Relatório de inadimplência

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-43 Notificações in-app (sino) *(parcial)*
**Já existe:** sino no header listando OS atrasadas, contas vencidas, estoque baixo
e caixa aberto — calculados na hora a cada consulta.

**Critérios pendentes:**
- [ ] Notificações persistidas (hoje não existem como registro, só como consulta derivada)
- [ ] Marcar como lida individualmente ou todas de uma vez
- [ ] Notificações persistem por 30 dias
- [ ] Novo agendamento como tipo de notificação

**Estimativa restante:** 4 pts | **Prioridade:** P1

---

## E11 — PWA e Mobile

### US-44 Instalação como app (PWA)
**Como** costureira, **quero** instalar o sistema no meu celular como um app, **para** acessar sem precisar abrir o navegador.

> Não há `manifest.json`, service worker nem diretório `public/` no frontend.

**Critérios de aceite:**
- [ ] Manifesto PWA configurado com ícones, nome e cores do ateliê
- [ ] Service Worker para cache de assets principais
- [ ] Prompt de instalação automático após 2 visitas
- [ ] Ícone aparece na tela inicial do Android e iOS
- [ ] Funciona offline para consulta de dados já carregados (clientes, OS)

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-45 Interface responsiva mobile *(parcial)*
**Já existe:** layout MUI responsivo com grid adaptável e menu lateral retrátil.

**Critérios pendentes:**
- [ ] Revisão de todos os módulos a partir de 360px (tabelas largas ainda estouram)
- [ ] Listas com swipe para ações rápidas (ex.: deslizar OS para mudar status)
- [ ] Teclado numérico nos campos de valor em mobile
- [ ] Botões de ação com no mínimo 44px de área de toque

**Estimativa restante:** 5 pts | **Prioridade:** P2

---

### US-46 Câmera para fotos de peças
**Como** costureira, **quero** tirar fotos das peças diretamente pelo sistema no celular, **para** não precisar transferir imagens manualmente.

> O upload de anexos existe; o que falta é o caminho direto pela câmera.

**Critérios de aceite:**
- [ ] Botão "Tirar foto" abre a câmera nativa do celular
- [ ] Compressão automática antes do upload (máx 1MB por foto)
- [ ] Upload em background — não bloqueia o formulário
- [ ] Visualização em galeria com opção de excluir

**Estimativa:** 3 pts | **Prioridade:** P2

---

## E12 — Impressão e PDF

### US-48 Impressão de Ordem de Serviço
**Como** costureira, **quero** imprimir a OS para fixar na peça, **para** não confundir as roupas das clientes.

> Existe o recibo de entrega, mas não a etiqueta/ficha da OS para a bancada.

**Critérios de aceite:**
- [ ] Formato compacto (meia folha A5): número da OS, cliente, descrição, prazo, medidas da peça
- [ ] Código QR com link para a OS no sistema
- [ ] Campos de checklist de etapas (personalizável)
- [ ] Versão para impressora térmica (80mm) — futura

**Estimativa:** 3 pts | **Prioridade:** P1

---

### US-50 Ficha de medidas para impressão
**Como** costureira, **quero** imprimir a ficha de medidas da cliente, **para** usar na bancada de costura.

**Critérios de aceite:**
- [ ] Layout com todas as medidas (inclusive os tipos personalizados), data da última atualização e observações
- [ ] Formato A5
- [ ] QR Code com link para o perfil da cliente no sistema

**Estimativa:** 2 pts | **Prioridade:** P1

---

### US-51 Relatório financeiro em PDF *(parcial)*
**Já existe:** exportação do fluxo de caixa em CSV (abre no Excel) e páginas de
impressão de fechamento de caixa, fechamento mensal e divisão.

**Critérios pendentes:**
- [ ] PDF com o DRE do período selecionado
- [ ] Cabeçalho com nome do ateliê e CNPJ

**Estimativa restante:** 2 pts | **Prioridade:** P2

---

## E13 — Multi-tenant e Planos SaaS

### US-52 Cadastro de ateliê (tenant)
**Como** proprietária de um novo ateliê, **quero** criar minha conta no sistema, **para** começar a usar sem depender de suporte.

**Critérios de aceite:**
- [ ] Formulário de cadastro: nome do ateliê, CNPJ (opcional), responsável, e-mail, telefone, cidade, plano escolhido
- [ ] Confirmação de e-mail obrigatória antes do primeiro acesso
- [ ] Trial de 14 dias ativado automaticamente
- [ ] Subdomínio automático: meuatelie.sistemacostura.com.br
- [ ] Dados completamente isolados por tenant (Row Level Security)

**Estimativa:** 13 pts | **Prioridade:** P2

---

### US-53 Planos de assinatura
**Como** proprietária, **quero** escolher um plano que caiba no meu bolso, **para** pagar apenas pelo que preciso.

**Critérios de aceite:**

**Plano Free:** até 1 usuária · 30 clientes ativos · 10 OS/mês · sem WhatsApp · sem relatórios avançados
**Plano Pro (R$ 89/mês):** até 5 usuárias · clientes e OS ilimitados · WhatsApp até 500/mês · todos os relatórios · suporte por chat
**Plano Enterprise (R$ 189/mês):** usuárias ilimitadas · WhatsApp ilimitado · multi-unidade · API · suporte prioritário

**Critérios técnicos:**
- [ ] Limites verificados no backend (não apenas frontend), incluindo o máximo de usuárias por plano
- [ ] Ao atingir o limite, exibe modal de upgrade com comparativo de planos
- [ ] Plano visível nas configurações com uso atual vs. limite

**Estimativa:** 13 pts | **Prioridade:** P2

---

### US-54 Cobrança e assinatura recorrente
**Como** proprietária, **quero** pagar minha assinatura com cartão ou PIX, **para** não precisar me lembrar todo mês.

**Critérios de aceite:**
- [ ] Integração com Stripe ou Asaas para cobrança recorrente
- [ ] Pagamento por cartão de crédito e boleto
- [ ] Fatura mensal por e-mail
- [ ] Cancelamento self-service com período de graça até o final do ciclo pago
- [ ] Reativação simples após cancelamento

**Estimativa:** 13 pts | **Prioridade:** P3

---

## E14 — Integrações de Pagamento

### US-55 Geração de QR Code PIX
**Como** atendente, **quero** gerar um QR Code PIX na hora do pagamento, **para** a cliente pagar sem errar a chave.

**Critérios de aceite:**
- [ ] QR Code gerado via API do banco ou gateway (Gerencianet/Asaas)
- [ ] Valor preenchido automaticamente do saldo devedor da OS
- [ ] Tela de aguardando pagamento com verificação automática (polling)
- [ ] Confirmação automática ao receber o PIX
- [ ] Timeout de 5 minutos para o QR Code

**Estimativa:** 8 pts | **Prioridade:** P2

---

### US-56 Link de pagamento
**Como** atendente, **quero** enviar um link de pagamento por WhatsApp, **para** a cliente pagar sem vir ao ateliê.

**Critérios de aceite:**
- [ ] Link gerado via gateway de pagamento
- [ ] Aceita cartão e PIX
- [ ] Status atualizado automaticamente ao pagar
- [ ] Link expira após 48h
- [ ] Registro do link no histórico de pagamentos da OS

**Estimativa:** 5 pts | **Prioridade:** P3

---

## E15 — Onboarding e UX

### US-57 Wizard de primeiro acesso
**Como** proprietária, **quero** um guia de configuração inicial, **para** configurar o sistema rápido sem precisar de treinamento.

**Critérios de aceite:**
- [ ] Passo 1: dados do ateliê (nome, logo, endereço, telefone, redes sociais)
- [ ] Passo 2: criar usuárias (com opção de pular)
- [ ] Passo 3: cadastrar primeiros serviços (com sugestões pré-definidas para costura)
- [ ] Passo 4: cadastrar primeira cliente (demo guiado)
- [ ] Passo 5: criar primeiro orçamento (demo guiado)
- [ ] Progress bar e opção de pular qualquer etapa
- [ ] Checklist de onboarding no Dashboard até completar todos os passos

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-58 Tour interativo
**Como** nova usuária, **quero** um tour pelas principais funcionalidades, **para** aprender o sistema sem ler manual.

**Critérios de aceite:**
- [ ] Tour ativado na primeira vez que acessa cada módulo
- [ ] Tooltips com highlight do elemento e texto explicativo
- [ ] Opção de "não mostrar novamente" por módulo
- [ ] Botão "Rever tour" nas configurações
- [ ] Tour funciona em mobile

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-59 Pesquisa global *(parcial)*
**Já existe:** barra de busca no header consultando clientes, OS, orçamentos e
agendamentos, com resultados agrupados e navegação direta.

**Critérios pendentes:**
- [ ] Atalho Ctrl+K abre a busca
- [ ] Histórico das últimas 5 buscas

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

### US-60 Modo escuro
**Como** usuária, **quero** alternar entre tema claro e escuro, **para** usar o sistema confortavelmente à noite.

> `buildTheme(mode)` já suporta os dois temas em `theme/theme.ts`, mas o app usa
> um tema fixo — falta o interruptor e a persistência.

**Critérios de aceite:**
- [ ] Toggle de tema no perfil do usuário
- [ ] Preferência salva por usuária
- [ ] Respeita a preferência do sistema operacional por padrão
- [ ] Todos os componentes adaptados (sem texto invisível)

**Estimativa:** 3 pts | **Prioridade:** P3

---

## E16 — Segurança e Conformidade

### US-61 Log de auditoria *(parcial)*
**Já existe:** `AuditLog` com usuária, ação, módulo, registro, antes/depois;
interceptor gravando automaticamente; aba de consulta em Configurações com filtros.

**Critérios pendentes:**
- [ ] Exportação CSV
- [ ] Política de retenção (1 ano) com expurgo automático
- [ ] Registrar também login, logout e exportações

**Estimativa restante:** 2 pts | **Prioridade:** P1

---

### US-62 Backup automático
**Como** proprietária, **quero** que meus dados sejam copiados automaticamente, **para** não perder nada em caso de falha.

> Não há nenhuma rotina de backup no projeto — o volume do Postgres é o único
> lugar onde os dados existem.

**Critérios de aceite:**
- [ ] Backup diário automático do banco de dados
- [ ] Backup armazenado fora do servidor (bucket S3 ou similar)
- [ ] Retenção: 30 dias para diários, 12 meses para mensais
- [ ] Relatório de backup na área de admin
- [ ] Alerta por e-mail se o backup falhar
- [ ] Procedimento de restauração testado e documentado

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-63 LGPD — Termos e Consentimento
**Como** proprietária, **quero** estar em conformidade com a LGPD, **para** não ter problemas legais com dados das clientes.

**Critérios de aceite:**
- [ ] Política de privacidade e termos de uso acessíveis antes do cadastro
- [ ] Aceite registrado com data e IP
- [ ] Opção para exportar todos os dados de uma cliente (portabilidade)
- [ ] Opção para excluir todos os dados de uma cliente (direito ao esquecimento)
- [ ] Dados de clientes nunca compartilhados entre tenants

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-64 Segurança da API *(parcial)*
**Já existe:** rate limiting global (100 req/min), senhas com bcrypt, Prisma
protegendo contra SQL injection, validação de entrada com class-validator.

**Critérios pendentes:**
- [ ] Headers de segurança: HSTS, CSP, X-Frame-Options, X-Content-Type (sem `helmet`)
- [ ] CORS restrito ao domínio do frontend
- [ ] Limite diferenciado por usuária autenticada (hoje é só por IP)
- [ ] Rotação automática de tokens JWT (depende do refresh, US-01)

**Estimativa restante:** 3 pts | **Prioridade:** P0

---

## E17 — Infraestrutura e DevOps

### US-65 CI/CD pipeline
**Como** desenvolvedor, **quero** que o deploy seja automático a cada merge, **para** entregar atualizações sem downtime manual.

> Não existe `.github/workflows`. O deploy é manual via `./start.sh --prod`.

**Critérios de aceite:**
- [ ] GitHub Actions: lint, typecheck, testes, build
- [ ] Deploy automático em staging a cada merge na main
- [ ] Deploy em produção com aprovação manual
- [ ] Rollback automático se o healthcheck falhar após o deploy
- [ ] Notificação com o resultado do deploy

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-66 Monitoramento e alertas
**Como** desenvolvedor, **quero** monitorar o sistema em produção, **para** saber sobre problemas antes dos usuários reclamarem.

**Critérios de aceite:**
- [ ] Sentry para captura de erros de frontend e backend
- [ ] Monitoramento de disponibilidade (Uptime Kuma ou similar)
- [ ] Alerta por e-mail e WhatsApp em caso de queda
- [ ] Dashboard com tempo de resposta da API (p50, p95, p99)
- [ ] Logs centralizados

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-67 Ambiente de staging
**Como** desenvolvedor, **quero** um ambiente de staging idêntico ao de produção, **para** testar antes de publicar.

**Critérios de aceite:**
- [ ] Staging com dados anonimizados de produção
- [ ] URL separada
- [ ] Proteção por senha (HTTP Basic Auth)
- [ ] Banco de dados isolado (nunca conecta em produção)

**Estimativa:** 3 pts | **Prioridade:** P1

---

## E18 — Testes Automatizados

> **Não existe nenhum teste no projeto hoje** — o Jest está configurado no backend,
> mas não há um único arquivo de teste. Este épico está inteiro em aberto e é o
> maior risco técnico do sistema, ainda mais com dinheiro envolvido.

### US-68 Testes unitários do backend
**Critérios de aceite:**
- [ ] Cobertura mínima de 80% nos módulos: Auth, Quotes, WorkOrders, Financial
- [ ] Prioridade absoluta para o financeiro: baixa parcial, parcelamento, sangria, fechamento de caixa, divisão entre sócias
- [ ] Testes de services com mock do Prisma
- [ ] CI falha se a cobertura cair abaixo do mínimo

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-69 Testes de integração dos fluxos críticos
**Critérios de aceite:**
- [ ] Fluxo: Login → Criar Cliente → Criar Orçamento → Aprovar → Criar OS → Registrar Pagamento → Entrega
- [ ] Fluxo: Fechamento de Caixa completo
- [ ] Banco de dados de teste dedicado (PostgreSQL em Docker)
- [ ] Testes rodam no CI antes de todo deploy

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-70 Testes de interface (E2E)
**Critérios de aceite:**
- [ ] Playwright para os fluxos: Login, Criar OS, Gerar PDF, Registrar Pagamento
- [ ] Screenshots de regressão visual nos componentes principais
- [ ] Testes rodando em headless no CI

**Estimativa:** 8 pts | **Prioridade:** P2

---

## Resumo do que falta

| Prioridade | Histórias | Pontos estimados |
|------------|-----------|-----------------|
| P0 | 4 | ~10 pts |
| P1 | 21 | ~85 pts |
| P2 | 20 | ~100 pts |
| P3 | 4 | ~24 pts |
| **Total** | **49** | **~219 pts** |

Concluídas e retiradas: **21 histórias** (~109 pts), incluindo o épico E5 inteiro
e todo o E8 original.

---

## Próximos passos sugeridos

1. **Financeiro — Fase 1** de [`FINANCEIRO_AVALIACAO.md`](FINANCEIRO_AVALIACAO.md):
   fazer os números baterem entre Financeiro, Relatórios e Dashboard. É barato e
   destrava US-35, US-36 e US-39.
2. **Segurança mínima (US-05, US-64, US-01)**: aplicar o `RolesGuard` que já existe,
   `helmet`/CORS e refresh token. Hoje qualquer usuária logada mexe no caixa.
3. **Backup (US-62)**: o sistema já está em produção sem nenhuma cópia de segurança.
4. **Testes do financeiro (US-68 parcial)**: cobrir baixa, parcelamento e fechamento
   antes de mexer na estrutura do módulo nas fases seguintes.
5. **Financeiro — Fases 2 a 5**, na ordem do documento de avaliação.
