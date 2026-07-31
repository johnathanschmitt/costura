# Especificação do Sistema - Ateliê de Costura

> **Documento Mestre (Estrutura Inicial)**

## Objetivo

Desenvolver um sistema web profissional para gestão completa de um
ateliê de costura, priorizando usabilidade para usuários com pouca
familiaridade com tecnologia.

## Stack

-   Frontend: React + Vite + TypeScript + Material UI
-   Backend: NestJS + TypeScript
-   Banco: PostgreSQL + Prisma
-   Cache: Redis
-   Storage: MinIO
-   Docker + Docker Compose
-   Nginx
-   Swagger

## Módulos

-   Dashboard
-   Clientes
-   Medidas
-   Orçamentos
-   Ordens de Serviço
-   Agenda
-   Estoque
-   Caixa
-   Contas a Receber
-   Contas a Pagar
-   Fluxo de Caixa
-   Relatórios
-   Configurações

## UX (Obrigatório)

-   Máximo de fluidez.
-   Menor quantidade possível de cliques.
-   Pesquisa global.
-   AutoSave.
-   Autocomplete.
-   Dashboard com ações rápidas.
-   Atendimento em tela única.

## Arquitetura

Monorepo:

    frontend/
    backend/
    database/
    docker/
    docs/

## Docker

Containers: - frontend - backend - postgres - redis - minio - pgadmin -
nginx

## Banco de Dados (Entidades)

-   users
-   roles
-   permissions
-   customers
-   body_measurements
-   garments
-   quotes
-   quote_items
-   work_orders
-   work_order_items
-   services
-   products
-   inventory
-   cash_register
-   cash_transactions
-   accounts_receivable
-   accounts_payable
-   schedules
-   attachments
-   audit_logs

## Fluxo Principal

Cliente → Orçamento → Aprovação → Ordem de Serviço → Produção →
Pagamento → Entrega → Fechamento de Caixa

## Regras

-   Clean Architecture
-   SOLID
-   DDD quando aplicável
-   Testes automatizados
-   Docker obrigatório
-   API REST documentada
-   JWT + RBAC
-   Soft Delete
-   Auditoria

## Roadmap

1.  Arquitetura
2.  Banco
3.  Backend
4.  Frontend
5.  Testes
6.  CI/CD
7.  Produção

> Este arquivo é a base. A documentação completa deverá expandir cada
> seção em detalhes (PRD, diagramas, APIs, regras de negócio, UX,
> wireframes e prompt mestre para Claude Code).
