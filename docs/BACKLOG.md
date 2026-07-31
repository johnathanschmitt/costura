# Backlog — Ateliê de Costura SaaS

> Gerado em 2026-07-31. Organizado por épico → história → critérios de aceite.
> Prioridade: **P0** (bloqueador), **P1** (essencial MVP), **P2** (diferencial), **P3** (futuro).

---

## Índice de Épicos

| # | Épico | Prioridade |
|---|-------|------------|
| E1 | Autenticação e Controle de Acesso | P0 |
| E2 | Gestão de Clientes e Medidas | P1 |
| E3 | Catálogo de Serviços e Produtos | P1 |
| E4 | Orçamentos | P1 |
| E5 | Ordens de Serviço | P1 |
| E6 | Agenda | P1 |
| E7 | Estoque | P1 |
| E8 | Financeiro | P1 |
| E9 | Relatórios e Dashboard | P1 |
| E10 | Notificações | P2 |
| E11 | PWA e Mobile | P2 |
| E12 | Impressão e PDF | P1 |
| E13 | Multi-tenant e Planos SaaS | P2 |
| E14 | Integrações de Pagamento | P2 |
| E15 | Onboarding e UX | P1 |
| E16 | Segurança e Conformidade | P1 |
| E17 | Infraestrutura e DevOps | P1 |
| E18 | Testes Automatizados | P1 |

---

## E1 — Autenticação e Controle de Acesso

### US-01 Login com email e senha
**Como** usuária do ateliê, **quero** entrar no sistema com e-mail e senha, **para** acessar minhas informações com segurança.

**Critérios de aceite:**
- [ ] Formulário de login com validação de campos obrigatórios
- [ ] Retorna erro claro para credenciais inválidas (sem revelar qual campo está errado)
- [ ] Token JWT com expiração de 8h (acesso) e 7d (refresh)
- [ ] Refresh token automático — usuária não é deslogada durante o uso
- [ ] Bloqueio após 5 tentativas incorretas por 15 minutos

**Estimativa:** 3 pts | **Prioridade:** P0

---

### US-02 Logout e sessão
**Como** usuária, **quero** sair do sistema, **para** que ninguém use minha conta em dispositivos compartilhados.

**Critérios de aceite:**
- [ ] Botão de logout no menu principal
- [ ] Refresh token é invalidado no servidor ao fazer logout
- [ ] Sessão inativa por 2h exibe aviso e redireciona para login

**Estimativa:** 1 pt | **Prioridade:** P0

---

### US-03 Recuperação de senha
**Como** usuária, **quero** recuperar minha senha por e-mail, **para** não perder acesso à conta.

**Critérios de aceite:**
- [ ] Campo "Esqueci minha senha" na tela de login
- [ ] E-mail com link de redefinição válido por 1h
- [ ] Senha redefinida invalida link e sessões anteriores
- [ ] Força de senha mínima: 8 caracteres, letras e números

**Estimativa:** 2 pts | **Prioridade:** P0

---

### US-04 Gestão de usuários e perfis
**Como** proprietária, **quero** criar usuárias com diferentes permissões, **para** que cada costureira acesse apenas o que precisa.

**Critérios de aceite:**
- [ ] Perfis predefinidos: Administrador, Costureira, Atendente, Financeiro, Somente Leitura
- [ ] Administrador pode criar, editar e desativar usuárias
- [ ] Usuária desativada perde acesso imediatamente
- [ ] Log de auditoria registra quem criou/editou cada usuária
- [ ] Máximo de usuárias por plano é validado no backend

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-05 Permissões granulares por módulo
**Como** administradora, **quero** controlar quais módulos cada perfil acessa, **para** proteger dados sensíveis como financeiro.

**Critérios de aceite:**
- [ ] Permissões: Visualizar, Criar, Editar, Excluir por módulo
- [ ] Frontend oculta menus e botões sem permissão (UX) e backend rejeita chamadas (segurança)
- [ ] Perfil Costureira: acessa OS, Agenda, Clientes; não acessa Financeiro
- [ ] Perfil Financeiro: acessa tudo financeiro; não acessa configurações de sistema

**Estimativa:** 5 pts | **Prioridade:** P1

---

## E2 — Gestão de Clientes e Medidas

### US-06 Cadastro de cliente
**Como** atendente, **quero** cadastrar uma nova cliente com dados completos, **para** ter histórico centralizado de cada pessoa.

**Critérios de aceite:**
- [ ] Campos: nome completo (obrigatório), CPF (opcional, validado), telefone(s), e-mail, data de nascimento, endereço completo, observações
- [ ] Busca por CPF: se já cadastrada, abre o perfil existente (evita duplicatas)
- [ ] Máscara automática nos campos de telefone, CPF, CEP
- [ ] Busca de endereço por CEP via ViaCEP
- [ ] Foto de perfil opcional (upload)
- [ ] AutoSave: dados não perdidos se sair da página acidentalmente

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-07 Edição e histórico da cliente
**Como** atendente, **quero** editar o cadastro de uma cliente e ver o histórico de alterações, **para** manter os dados atualizados.

**Critérios de aceite:**
- [ ] Todos os campos do cadastro são editáveis
- [ ] Histórico de alterações: campo, valor anterior, novo valor, quem alterou, quando
- [ ] Exclusão lógica (soft delete) — dados não são apagados fisicamente
- [ ] Campo "Ativa/Inativa" para arquivar clientes sem movimento

**Estimativa:** 3 pts | **Prioridade:** P1

---

### US-08 Ficha de medidas do corpo
**Como** costureira, **quero** registrar as medidas corporais de cada cliente, **para** costurar com precisão sem precisar medir novamente.

**Critérios de aceite:**
- [ ] Campos: busto, cintura, quadril, comprimento do vestido, comprimento da saia, comprimento da calça, altura total, ombro, manga, punho, cava, costas, observações livres
- [ ] Histórico de medidas por data — mostra evolução ao longo do tempo
- [ ] Alerta visual quando medidas têm mais de 6 meses
- [ ] Impressão da ficha de medidas em formato A5
- [ ] Campo de observações por peça (ex: "prefere cintura mais folgada")

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-09 Listagem e busca de clientes
**Como** atendente, **quero** encontrar uma cliente rapidamente, **para** não fazer a pessoa esperar enquanto procuro no sistema.

**Critérios de aceite:**
- [ ] Busca em tempo real por nome, telefone, CPF (debounce 300ms)
- [ ] Filtros: ativas/inativas, clientes com OS em andamento, aniversariantes do mês
- [ ] Listagem ordenável por nome, última visita, total gasto
- [ ] Card da cliente mostra: foto, nome, telefone, última OS, total de peças
- [ ] Paginação ou scroll infinito (mínimo 20 por página)

**Estimativa:** 3 pts | **Prioridade:** P1

---

### US-10 Perfil unificado da cliente
**Como** atendente, **quero** ver em uma única tela todas as informações de uma cliente, **para** atendê-la sem navegar entre módulos.

**Critérios de aceite:**
- [ ] Abas: Dados, Medidas, Orçamentos, Ordens de Serviço, Financeiro, Histórico
- [ ] KPIs rápidos: total gasto, número de peças, última visita, OS em aberto
- [ ] Botões de ação rápida: Novo Orçamento, Nova OS, Agendar, Registrar Pagamento
- [ ] Timeline de todas as interações ordenada por data

**Estimativa:** 5 pts | **Prioridade:** P1

---

## E3 — Catálogo de Serviços e Produtos

### US-11 Cadastro de serviços
**Como** proprietária, **quero** cadastrar os serviços do ateliê com preço base, **para** gerar orçamentos padronizados.

**Critérios de aceite:**
- [ ] Campos: nome, descrição, categoria (costura, ajuste, bordado, etc.), preço base, tempo estimado (horas), ativo/inativo
- [ ] Categorias customizáveis pela proprietária
- [ ] Histórico de alteração de preço (quando mudou, de quanto para quanto)
- [ ] Serviço pode ter variações (ex: vestido simples, festivo, noiva — cada um com preço diferente)
- [ ] Importação de lista de serviços via CSV

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-12 Cadastro de produtos/materiais
**Como** proprietária, **quero** cadastrar os materiais usados nas peças, **para** controlar o custo e o estoque.

**Critérios de aceite:**
- [ ] Campos: nome, código/SKU, categoria, unidade de medida (metro, unidade, kg), preço de custo, preço de venda, fornecedor, estoque mínimo
- [ ] Código de barras (EAN) para leitura via câmera no celular
- [ ] Categorias: tecidos, aviamentos, linhas, zíperes, botões, rendas, outros
- [ ] Produto pode ser marcado como "somente para uso interno" (não aparece em orçamento)

**Estimativa:** 5 pts | **Prioridade:** P1

---

## E4 — Orçamentos

### US-13 Criação de orçamento
**Como** atendente, **quero** gerar um orçamento detalhado para a cliente, **para** formalizar o serviço antes de começar.

**Critérios de aceite:**
- [ ] Selecionar cliente (com autocomplete) ou criar nova cliente inline
- [ ] Adicionar itens: serviço ou produto com quantidade, preço unitário, desconto por item
- [ ] Cálculo automático: subtotal, desconto geral, total
- [ ] Campo de prazo de entrega estimado (data)
- [ ] Campo de observações/condições
- [ ] Número de orçamento gerado automaticamente (ORC-2026-0001)
- [ ] Status: Rascunho → Enviado → Aprovado → Recusado → Expirado

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-14 Aprovação de orçamento e conversão para OS
**Como** atendente, **quero** converter um orçamento aprovado em Ordem de Serviço com um clique, **para** não redigitar as informações.

**Critérios de aceite:**
- [ ] Botão "Aprovar e Criar OS" no orçamento
- [ ] OS criada com todos os itens, prazo e observações do orçamento
- [ ] Orçamento recebe status "Aprovado" e link para a OS gerada
- [ ] Possível registrar entrada (sinal) no momento da aprovação
- [ ] Orçamentos sem resposta após X dias (configurável) vão para "Expirado" automaticamente

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-15 Envio de orçamento por WhatsApp/e-mail
**Como** atendente, **quero** enviar o orçamento para a cliente por WhatsApp ou e-mail, **para** ela receber e aprovar sem precisar vir ao ateliê.

**Critérios de aceite:**
- [ ] Botão "Enviar por WhatsApp" abre link `wa.me` com mensagem e PDF em anexo
- [ ] Botão "Enviar por e-mail" dispara e-mail com PDF em anexo
- [ ] Mensagem de WhatsApp é personalizável nas configurações
- [ ] Status muda para "Enviado" ao clicar em qualquer botão de envio
- [ ] Log de quando e como foi enviado

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-16 Histórico e duplicação de orçamentos
**Como** atendente, **quero** duplicar um orçamento anterior, **para** criar rapidamente um semelhante para a mesma cliente.

**Critérios de aceite:**
- [ ] Botão "Duplicar" cria cópia com status Rascunho e nova numeração
- [ ] Listagem de orçamentos com filtros: status, período, cliente
- [ ] Orçamento recusado pode ser reaberto e editado

**Estimativa:** 2 pts | **Prioridade:** P2

---

## E5 — Ordens de Serviço

### US-17 Criação de Ordem de Serviço
**Como** costureira, **quero** registrar uma OS com todos os detalhes da peça, **para** ter instruções claras do que fazer.

**Critérios de aceite:**
- [ ] Campos: cliente, tipo de peça, descrição detalhada, prazo de entrega, costureira responsável, prioridade (normal/urgente/urgentíssimo), valor total, entrada paga, saldo devedor
- [ ] Número de OS gerado automaticamente (OS-2026-0001)
- [ ] Status: Aguardando → Em Produção → Aguardando Retirada → Entregue → Cancelada
- [ ] Upload de fotos de referência (até 10 imagens)
- [ ] Upload de fotos do tecido/material recebido
- [ ] Campo de observações internas (visível só para equipe)
- [ ] Campo de medidas específicas da peça (diferente da ficha da cliente)

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-18 Kanban de produção
**Como** costureira, **quero** ver todas as OS em um quadro visual por status, **para** saber o que está na fila e o que está atrasado.

**Critérios de aceite:**
- [ ] Colunas: Aguardando → Em Produção → Aguardando Retirada → Entregue
- [ ] Cards arrastáveis entre colunas (drag-and-drop)
- [ ] Card mostra: cliente, tipo de peça, prazo, costureira, prioridade (cor)
- [ ] Prazo atrasado destaca card em vermelho
- [ ] Filtro por costureira, prioridade, tipo de peça
- [ ] Contador de peças por coluna

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-19 Fila de produção por costureira
**Como** proprietária, **quero** ver e organizar a fila de trabalho de cada costureira, **para** distribuir a carga de forma equilibrada.

**Critérios de aceite:**
- [ ] Visão por costureira: lista de OS ordenada por prioridade e prazo
- [ ] Reatribuição de OS de uma costureira para outra com log de motivo
- [ ] Indicador de carga: horas estimadas total vs. capacidade diária
- [ ] Alerta quando costureira tem mais de X dias de fila (configurável)

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-20 Andamento e atualizações da OS
**Como** costureira, **quero** registrar o progresso da OS, **para** que a atendente informe a cliente sem precisar interromper a produção.

**Critérios de aceite:**
- [ ] Campo de atualizações com texto livre e data/hora
- [ ] Foto do andamento com legenda
- [ ] Percentual de conclusão (0, 25, 50, 75, 100%)
- [ ] Última atualização visível no card do Kanban

**Estimativa:** 3 pts | **Prioridade:** P2

---

### US-21 Registro de entrega da peça
**Como** atendente, **quero** registrar a entrega da peça à cliente, **para** fechar o ciclo da OS.

**Critérios de aceite:**
- [ ] Botão "Registrar Entrega" na OS
- [ ] Verifica se há saldo devedor — exige pagamento ou confirmação consciente
- [ ] Registra data/hora de entrega e quem entregou
- [ ] Gera recibo de entrega (PDF imprimível)
- [ ] OS vai para status "Entregue" e financeiro atualiza automaticamente

**Estimativa:** 3 pts | **Prioridade:** P1

---

## E6 — Agenda

### US-22 Agendamento de atendimento
**Como** atendente, **quero** agendar horários com as clientes, **para** organizar o fluxo do ateliê.

**Critérios de aceite:**
- [ ] Visualizações: mês, semana, dia
- [ ] Criar evento com: cliente, tipo (prova, entrega, medição, orçamento), data/hora início, duração, observações
- [ ] Conflito de horário: alerta se já há evento no mesmo período
- [ ] Vincular evento a uma OS ou Orçamento existente
- [ ] Cor por tipo de evento

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-23 Lembrete de compromisso
**Como** atendente, **quero** que o sistema lembre as clientes dos compromissos agendados, **para** reduzir faltas.

**Critérios de aceite:**
- [ ] Lembrete automático por WhatsApp 24h antes do horário
- [ ] Lembrete por e-mail 24h antes (fallback)
- [ ] Mensagem personalizável nas configurações
- [ ] Log de lembretes enviados no evento

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-24 Visão de prazo das OS no calendário
**Como** proprietária, **quero** ver os prazos das OS no calendário junto com os agendamentos, **para** não prometer entrega em dia cheio.

**Critérios de aceite:**
- [ ] OS aparecem no calendário na data de prazo com cor diferente
- [ ] Click em OS no calendário abre o card da OS
- [ ] Filtro para mostrar/ocultar OS no calendário

**Estimativa:** 3 pts | **Prioridade:** P2

---

## E7 — Estoque

### US-25 Controle de entrada de materiais
**Como** responsável pelo estoque, **quero** registrar a entrada de materiais comprados, **para** saber o que tenho disponível.

**Critérios de aceite:**
- [ ] Campos: produto, quantidade, unidade, preço de custo, fornecedor, nota fiscal (número e upload do arquivo), data
- [ ] Atualiza saldo do produto automaticamente
- [ ] Histórico de todas as entradas com rastreabilidade
- [ ] Alerta de produto abaixo do estoque mínimo

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-26 Baixa de materiais por OS
**Como** costureira, **quero** registrar quais materiais usei em cada OS, **para** o estoque ficar atualizado.

**Critérios de aceite:**
- [ ] Dentro da OS, campo "Materiais utilizados": produto + quantidade
- [ ] Baixa é subtraída do estoque ao salvar
- [ ] Alerta se quantidade usada excede estoque disponível
- [ ] Relatório de consumo por OS e por material

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-27 Inventário e ajuste de estoque
**Como** proprietária, **quero** fazer inventário e corrigir divergências no estoque, **para** ter contagem fiel da realidade.

**Critérios de aceite:**
- [ ] Modo inventário: lista todos os produtos com campo de quantidade física
- [ ] Diferença entre estoque sistema e contagem física é destacada
- [ ] Ajuste salvo com motivo e log de quem fez
- [ ] Relatório de divergências do último inventário

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-28 Alertas de estoque mínimo
**Como** proprietária, **quero** receber alertas quando algum material estiver acabando, **para** comprar antes de faltar.

**Critérios de aceite:**
- [ ] Dashboard mostra card de "Materiais em alerta" com lista
- [ ] Notificação push/WhatsApp ao atingir estoque mínimo
- [ ] E-mail semanal com lista de materiais abaixo do mínimo
- [ ] Estoque mínimo configurável por produto

**Estimativa:** 3 pts | **Prioridade:** P2

---

## E8 — Financeiro

### US-29 Registro de pagamento
**Como** atendente, **quero** registrar pagamentos das clientes, **para** saber o que foi recebido e o que ainda está em aberto.

**Critérios de aceite:**
- [ ] Formas de pagamento: dinheiro, PIX, cartão de débito, cartão de crédito, transferência
- [ ] Parcelamento: número de parcelas, data de cada parcela
- [ ] Registro de sinal (entrada) separado do pagamento final
- [ ] Comprovante de pagamento (PDF ou link)
- [ ] Valor recebido vs. troco calculado automaticamente para dinheiro

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-30 Contas a receber
**Como** proprietária, **quero** ver todas as cobranças em aberto, **para** saber o que tenho a receber.

**Critérios de aceite:**
- [ ] Lista de parcelas/valores pendentes com cliente, vencimento, valor
- [ ] Status: A Vencer, Vencido, Recebido
- [ ] Filtros: período, status, cliente
- [ ] Total a receber por período (hoje, esta semana, este mês)
- [ ] Botão de baixa manual ao receber
- [ ] Alerta visual para vencidos há mais de X dias

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-31 Contas a pagar
**Como** proprietária, **quero** registrar despesas e contas a pagar, **para** controlar os gastos do ateliê.

**Critérios de aceite:**
- [ ] Campos: descrição, categoria (aluguel, materiais, serviços, salários, etc.), valor, vencimento, recorrência (mensal, anual, única)
- [ ] Status: A Pagar, Pago, Vencido
- [ ] Despesas recorrentes são criadas automaticamente nos períodos futuros
- [ ] Filtros: período, categoria, status
- [ ] Total a pagar por período

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-32 Caixa diário
**Como** atendente, **quero** abrir e fechar o caixa do dia com conferência de valores, **para** controlar o dinheiro físico.

**Critérios de aceite:**
- [ ] Abertura de caixa: valor em caixa no início do dia
- [ ] Registro de todas as entradas (pagamentos) e saídas (despesas) do dia
- [ ] Sangria: retirada de valor com motivo
- [ ] Suprimento: adição de troco ao caixa
- [ ] Fechamento de caixa: conferência de valor esperado vs. real, campo de observações
- [ ] Relatório de fechamento em PDF

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-33 Fluxo de caixa
**Como** proprietária, **quero** ver entradas e saídas projetadas e realizadas, **para** planejar as finanças do mês.

**Critérios de aceite:**
- [ ] Gráfico de barras: entradas vs. saídas por semana/mês
- [ ] Linha de saldo projetado (incluindo contas a receber/pagar futuras)
- [ ] Saldo atual, projeção do mês, melhor e pior mês do ano
- [ ] Filtros por período e categoria
- [ ] Exportação para Excel

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-34 Categorização de lançamentos
**Como** proprietária, **quero** categorizar cada lançamento financeiro, **para** entender onde gasto e ganho mais.

**Critérios de aceite:**
- [ ] Categorias padrão para receita: Costura, Ajuste, Bordado, Venda de Material
- [ ] Categorias padrão para despesa: Aluguel, Salários, Materiais, Marketing, Outros
- [ ] Categorias customizáveis
- [ ] DRE (Demonstrativo de Resultado) mensal por categoria

**Estimativa:** 3 pts | **Prioridade:** P2

---

## E9 — Relatórios e Dashboard

### US-35 Dashboard principal
**Como** proprietária, **quero** ver os principais indicadores do ateliê na página inicial, **para** ter visão rápida do negócio ao abrir o sistema.

**Critérios de aceite:**
- [ ] KPIs: faturamento do mês, OS em andamento, OS atrasadas, clientes ativos, peças entregues no mês
- [ ] Gráfico de faturamento últimos 6 meses
- [ ] Lista de OS com prazo vencendo hoje e amanhã
- [ ] Lista de pagamentos recebidos hoje
- [ ] Atalhos rápidos: Nova OS, Novo Orçamento, Agendar
- [ ] Dados atualizam sem recarregar a página (polling a cada 30s)

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-36 Relatório de faturamento
**Como** proprietária, **quero** um relatório de faturamento por período, **para** acompanhar o crescimento do negócio.

**Critérios de aceite:**
- [ ] Filtros: período, tipo de serviço, costureira, cliente
- [ ] Total bruto, descontos, total líquido
- [ ] Comparativo com período anterior (variação percentual)
- [ ] Exportação PDF e Excel
- [ ] Gráfico de linha com evolução diária/semanal

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-37 Relatório de OS (desempenho de produção)
**Como** proprietária, **quero** analisar a produção do ateliê, **para** identificar gargalos e melhorar prazos.

**Critérios de aceite:**
- [ ] Tempo médio por tipo de peça
- [ ] OS entregues no prazo vs. atrasadas (%)
- [ ] Volume por costureira
- [ ] OS canceladas com motivo
- [ ] Filtros por período e costureira

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-38 Relatório de clientes
**Como** proprietária, **quero** entender minha base de clientes, **para** tomar decisões sobre marketing e capacidade.

**Critérios de aceite:**
- [ ] Ranking de clientes por valor gasto
- [ ] Clientes novos vs. recorrentes por mês
- [ ] Taxa de retorno (% de clientes que voltaram em 90 dias)
- [ ] Aniversariantes do mês com opção de exportar lista
- [ ] Clientes sem OS nos últimos 6 meses (oportunidade de recontato)

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-39 Relatório financeiro (DRE simplificado)
**Como** proprietária, **quero** um resumo de receitas e despesas por mês, **para** saber se o ateliê está dando lucro.

**Critérios de aceite:**
- [ ] Receita total por categoria
- [ ] Despesas totais por categoria
- [ ] Resultado (lucro/prejuízo) com margem percentual
- [ ] Comparativo entre meses
- [ ] Exportação PDF para contador

**Estimativa:** 5 pts | **Prioridade:** P1

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

### US-41 Alerta de prazo vencendo
**Como** proprietária, **quero** ser notificada internamente quando uma OS estiver próxima do prazo, **para** priorizar a produção.

**Critérios de aceite:**
- [ ] Notificação no sistema (sino) 2 dias antes do prazo
- [ ] E-mail diário com OS que vencem em 48h
- [ ] Card destacado no Dashboard
- [ ] OS atrasada aparece em vermelho no Kanban e na agenda

**Estimativa:** 3 pts | **Prioridade:** P1

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

### US-43 Notificações in-app (sino)
**Como** usuária, **quero** ver notificações dentro do sistema, **para** não perder eventos importantes.

**Critérios de aceite:**
- [ ] Sino no header com contador de não lidas
- [ ] Tipos: OS atrasada, pagamento vencido, estoque mínimo, novo agendamento
- [ ] Marcar como lida individualmente ou todas de uma vez
- [ ] Notificações persistem por 30 dias
- [ ] Click leva direto ao item relacionado

**Estimativa:** 5 pts | **Prioridade:** P1

---

## E11 — PWA e Mobile

### US-44 Instalação como app (PWA)
**Como** costureira, **quero** instalar o sistema no meu celular como um app, **para** acessar sem precisar abrir o navegador.

**Critérios de aceite:**
- [ ] Manifesto PWA configurado com ícones, nome e cores do ateliê
- [ ] Service Worker para cache de assets principais
- [ ] Prompt de instalação automático após 2 visitas
- [ ] Ícone aparece na tela inicial do Android e iOS
- [ ] Funciona offline para consulta de dados já carregados (clientes, OS)

**Estimativa:** 5 pts | **Prioridade:** P2

---

### US-45 Interface responsiva mobile
**Como** costureira, **quero** usar o sistema no celular com boa experiência, **para** consultar e atualizar OS sem precisar de computador.

**Critérios de aceite:**
- [ ] Layout responsivo em todos os módulos para telas a partir de 360px
- [ ] Menu hamburguer em mobile
- [ ] Listas com swipe para ações rápidas (ex: deslizar OS para mudar status)
- [ ] Formulários com teclado numérico nos campos de valor
- [ ] Botões de ação grandes o suficiente para toque (mínimo 44px)

**Estimativa:** 8 pts | **Prioridade:** P2

---

### US-46 Câmera para fotos de peças
**Como** costureira, **quero** tirar fotos das peças diretamente pelo sistema no celular, **para** não precisar transferir imagens manualmente.

**Critérios de aceite:**
- [ ] Botão "Tirar foto" abre câmera nativa do celular
- [ ] Compressão automática antes do upload (máx 1MB por foto)
- [ ] Upload em background — não bloqueia o formulário
- [ ] Visualização em galeria com opção de excluir

**Estimativa:** 3 pts | **Prioridade:** P2

---

## E12 — Impressão e PDF

### US-47 Impressão de orçamento
**Como** atendente, **quero** imprimir o orçamento para a cliente, **para** formalizar por escrito.

**Critérios de aceite:**
- [ ] Layout profissional com logo do ateliê, dados de contato, dados da cliente
- [ ] Itens, valores, prazo, condições e assinatura
- [ ] Versão PDF para envio por e-mail/WhatsApp
- [ ] Botão "Imprimir" e "Baixar PDF" no orçamento

**Estimativa:** 3 pts | **Prioridade:** P1

---

### US-48 Impressão de Ordem de Serviço
**Como** costureira, **quero** imprimir a OS para fixar na peça, **para** não confundir as roupas das clientes.

**Critérios de aceite:**
- [ ] Formato compacto (meia folha A5) com: número OS, cliente, descrição, prazo, medidas específicas
- [ ] Código QR com link para a OS no sistema
- [ ] Campos de checklist de etapas (personalizável)
- [ ] Versão para impressora térmica (80mm) — futura

**Estimativa:** 3 pts | **Prioridade:** P1

---

### US-49 Recibo de pagamento
**Como** atendente, **quero** emitir recibo de pagamento para a cliente, **para** formalizar o que foi pago.

**Critérios de aceite:**
- [ ] Recibo com: número, data, cliente, serviço, valor pago, forma de pagamento, assinatura
- [ ] PDF para envio por WhatsApp
- [ ] Impressão em folha A5 ou A4 com duas vias

**Estimativa:** 2 pts | **Prioridade:** P1

---

### US-50 Ficha de medidas para impressão
**Como** costureira, **quero** imprimir a ficha de medidas da cliente, **para** usar na bancada de costura.

**Critérios de aceite:**
- [ ] Layout com todas as medidas, data da última atualização, foto da cliente (opcional), observações
- [ ] Formato A5
- [ ] QR Code com link para o perfil da cliente no sistema

**Estimativa:** 2 pts | **Prioridade:** P1

---

### US-51 Relatório financeiro em PDF
**Como** proprietária, **quero** exportar o relatório financeiro em PDF, **para** enviar ao contador.

**Critérios de aceite:**
- [ ] PDF com DRE do período selecionado
- [ ] Cabeçalho com nome do ateliê e CNPJ
- [ ] Tabelas formatadas e legíveis
- [ ] Exportação de extrato de lançamentos em Excel

**Estimativa:** 3 pts | **Prioridade:** P2

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

**Plano Free:**
- Até 1 usuária
- Até 30 clientes ativos
- Até 10 OS por mês
- Sem notificações WhatsApp
- Sem relatórios avançados

**Plano Pro (R$ 89/mês):**
- Até 5 usuárias
- Clientes ilimitados
- OS ilimitadas
- Notificações WhatsApp (até 500/mês)
- Todos os relatórios
- Suporte por chat

**Plano Enterprise (R$ 189/mês):**
- Usuárias ilimitadas
- WhatsApp ilimitado
- Multi-unidade
- API access
- Suporte prioritário por WhatsApp

**Critérios técnicos:**
- [ ] Limites verificados no backend (não apenas frontend)
- [ ] Ao atingir limite, exibe modal de upgrade com comparativo de planos
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

### US-59 Pesquisa global
**Como** usuária, **quero** buscar qualquer coisa no sistema com uma barra de pesquisa, **para** não precisar navegar por menus.

**Critérios de aceite:**
- [ ] Atalho Ctrl+K abre a busca
- [ ] Busca em: clientes, OS, orçamentos, agendamentos
- [ ] Resultados aparecem em menos de 300ms
- [ ] Agrupados por categoria com ícone identificador
- [ ] Click no resultado navega direto para o item
- [ ] Histórico das últimas 5 buscas

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-60 Modo escuro
**Como** usuária, **quero** alternar entre tema claro e escuro, **para** usar o sistema confortavelmente à noite.

**Critérios de aceite:**
- [ ] Toggle de tema no perfil do usuário
- [ ] Preferência salva por usuária
- [ ] Respeita preferência do sistema operacional por padrão
- [ ] Todos os componentes adaptados (sem texto invisível)

**Estimativa:** 3 pts | **Prioridade:** P3

---

## E16 — Segurança e Conformidade

### US-61 Log de auditoria
**Como** proprietária, **quero** ver um log de todas as ações no sistema, **para** saber o que cada usuária fez.

**Critérios de aceite:**
- [ ] Log de: criação, edição, exclusão, login, logout, export
- [ ] Campos: usuária, ação, módulo, registro afetado, IP, data/hora
- [ ] Consulta com filtros por usuária, módulo, período
- [ ] Exportação CSV
- [ ] Retenção de 1 ano (P1), 3 anos (Enterprise)

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-62 Backup automático
**Como** proprietária, **quero** que meus dados sejam copiados automaticamente, **para** não perder nada em caso de falha.

**Critérios de aceite:**
- [ ] Backup diário automático do banco de dados
- [ ] Backup armazenado em bucket S3 separado
- [ ] Retenção: 30 dias para diários, 12 meses para mensais
- [ ] Relatório de backup na área de admin
- [ ] Restauração self-service via painel admin (Enterprise)
- [ ] Alerta por e-mail se backup falhar

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-63 LGPD — Termos e Consentimento
**Como** proprietária, **quero** estar em conformidade com a LGPD, **para** não ter problemas legais com dados das clientes.

**Critérios de aceite:**
- [ ] Política de privacidade e termos de uso acessíveis antes do cadastro
- [ ] Aceite registrado com data e IP
- [ ] Opção para exportar todos os dados de uma cliente (direito de portabilidade)
- [ ] Opção para excluir todos os dados de uma cliente (direito ao esquecimento)
- [ ] Dados de clientes nunca compartilhados entre tenants

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-64 Segurança da API
**Como** desenvolvedor, **quero** que a API seja segura por padrão, **para** evitar exploração por usuários mal-intencionados.

**Critérios de aceite:**
- [ ] Rate limiting: 100 req/min por IP, 1000 req/min por usuária autenticada
- [ ] Headers de segurança: HSTS, CSP, X-Frame-Options, X-Content-Type
- [ ] CORS restrito ao domínio do frontend
- [ ] Todos os inputs sanitizados (XSS, SQL injection via Prisma ORM)
- [ ] Tokens JWT com rotação automática
- [ ] Senhas hashadas com bcrypt (min cost 12)

**Estimativa:** 5 pts | **Prioridade:** P0

---

## E17 — Infraestrutura e DevOps

### US-65 CI/CD pipeline
**Como** desenvolvedor, **quero** que o deploy seja automático a cada merge, **para** entregar atualizações sem downtime manual.

**Critérios de aceite:**
- [ ] GitHub Actions: lint, typecheck, testes, build
- [ ] Deploy automático em staging a cada merge na main
- [ ] Deploy em produção com aprovação manual
- [ ] Rollback automático se healthcheck falhar após deploy
- [ ] Notificação no Slack/Discord com resultado do deploy

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-66 Monitoramento e alertas
**Como** desenvolvedor, **quero** monitorar o sistema em produção, **para** saber sobre problemas antes dos usuários reclamarem.

**Critérios de aceite:**
- [ ] Sentry para captura de erros de frontend e backend
- [ ] Uptime Kuma ou Betterstack para monitoramento de disponibilidade
- [ ] Alerta por e-mail e WhatsApp em caso de queda
- [ ] Dashboard com tempo de resposta da API (p50, p95, p99)
- [ ] Logs centralizados (Papertrail ou similar)

**Estimativa:** 5 pts | **Prioridade:** P1

---

### US-67 Ambiente de staging
**Como** desenvolvedor, **quero** um ambiente de staging idêntico ao de produção, **para** testar antes de publicar.

**Critérios de aceite:**
- [ ] Staging com dados anonimizados de produção
- [ ] URL separada: staging.sistemacostura.com.br
- [ ] Proteção por senha (HTTP Basic Auth)
- [ ] Banco de dados isolado (nunca conecta em produção)

**Estimativa:** 3 pts | **Prioridade:** P1

---

## E18 — Testes Automatizados

### US-68 Testes unitários do backend
**Como** desenvolvedor, **quero** cobertura de testes nos serviços críticos, **para** detectar regressões antes do deploy.

**Critérios de aceite:**
- [ ] Cobertura mínima de 80% nos módulos: Auth, Quotes, WorkOrders, Financial
- [ ] Testes de services com mock do Prisma
- [ ] CI falha se cobertura cair abaixo do mínimo

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-69 Testes de integração dos fluxos críticos
**Como** desenvolvedor, **quero** testes end-to-end dos fluxos principais, **para** garantir que o ciclo completo funciona.

**Critérios de aceite:**
- [ ] Fluxo: Login → Criar Cliente → Criar Orçamento → Aprovar → Criar OS → Registrar Pagamento → Entrega
- [ ] Fluxo: Fechamento de Caixa completo
- [ ] Banco de dados de teste dedicado (PostgreSQL em memória ou Docker)
- [ ] Testes rodam no CI antes de todo deploy

**Estimativa:** 8 pts | **Prioridade:** P1

---

### US-70 Testes de interface (E2E)
**Como** desenvolvedor, **quero** testes automatizados de interface, **para** garantir que o frontend funciona após mudanças.

**Critérios de aceite:**
- [ ] Playwright para fluxos: Login, Criar OS, Gerar PDF, Registrar Pagamento
- [ ] Screenshots de regressão visual nos componentes principais
- [ ] Testes rodando em headless no CI

**Estimativa:** 8 pts | **Prioridade:** P2

---

## Resumo por Prioridade

| Prioridade | Histórias | Pontos estimados |
|------------|-----------|-----------------|
| P0 | 3 | 9 pts |
| P1 | 35 | ~175 pts |
| P2 | 25 | ~118 pts |
| P3 | 7 | ~26 pts |
| **Total** | **70** | **~328 pts** |

---

## Sugestão de Sprints (MVP)

### Sprint 1 — Fundação (2 semanas)
E1 completo (US-01 a 05) + US-64 (segurança API)

### Sprint 2 — Core do Negócio I (2 semanas)
E2 completo (US-06 a 10) + US-11/12 (catálogo)

### Sprint 3 — Core do Negócio II (2 semanas)
E4 completo (US-13 a 16) + E5 parcial (US-17, 18, 21)

### Sprint 4 — Operacional (2 semanas)
E6 (US-22) + E7 parcial (US-25) + E8 parcial (US-29, 30, 31, 32)

### Sprint 5 — Visibilidade (2 semanas)
E9 completo (US-35 a 39) + E10 parcial (US-41, 43) + E12 (US-47 a 50)

### Sprint 6 — Qualidade e Deploy (2 semanas)
E15 parcial (US-57, 59) + E16 (US-61, 62, 63) + E17 completo + E18 parcial (US-68, 69)

**MVP estimado: 12 semanas / 3 meses**
