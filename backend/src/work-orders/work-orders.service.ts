import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_INCOME_CATEGORY } from '../financial/financial.constants';
import { InventoryService } from '../inventory/inventory.service';
// A entrega recebe o pagamento no mesmo diálogo (§3.1) — a baixa é do financeiro.
import { FinancialService } from '../financial/financial.service';
import {
  AssignDto, BoardQueryDto, CancelWorkOrderDto, CreateUpdateDto, CreateWorkOrderDto, DeliverDto,
  DeliverPaymentDto, ListWorkOrdersDto, SetEstimatedHoursDto, UpdateStatusDto, UpdateWorkOrderDto,
  WorkOrderItemDto,
} from './dto/work-orders.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

const brl = (v: Prisma.Decimal.Value) => `R$ ${D(v).toFixed(2).replace('.', ',')}`;

/** Colunas do quadro de produção, na ordem do fluxo. Canceladas ficam fora. */
export const BOARD_COLUMNS: WorkOrderStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING_MATERIAL',
  'FITTING',
  'DONE',
  'DELIVERED',
];

@Injectable()
export class WorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private financial: FinancialService,
  ) {}

  private async nextNumber() {
    const last = await this.prisma.workOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('OS-', '')) + 1 : 1;
    return `OS-${String(num).padStart(5, '0')}`;
  }

  private itemsCreate(items: WorkOrderItemDto[]) {
    return items.map((i, idx) => ({
      type: i.type,
      description: i.description,
      quantity: D(i.quantity),
      unitPrice: D(i.unitPrice),
      total: D(i.unitPrice).times(i.quantity),
      serviceId: i.serviceId ?? null,
      productId: i.productId ?? null,
      done: i.done ?? false,
      order: idx,
    }));
  }

  private itemsTotal(items: WorkOrderItemDto[]) {
    return items.reduce((s, i) => s.plus(D(i.unitPrice).times(i.quantity)), ZERO);
  }

  /**
   * O que a OS já recebeu vem das contas a receber vinculadas — é lá que os
   * pagamentos são registrados. A coluna `paidAmount` da OS nunca é escrita por
   * ninguém, então somá-la daria sempre zero.
   */
  private financials(
    total: Prisma.Decimal.Value,
    discount: Prisma.Decimal.Value,
    receivables: { amount: Prisma.Decimal; paidAmount: Prisma.Decimal; status: string }[],
  ) {
    const active = receivables.filter(r => r.status !== 'CANCELLED');
    const paid = active.reduce((s, r) => s.plus(r.paidAmount), ZERO);
    const net = D(total).minus(discount);
    return {
      total: net,
      paid,
      balance: net.minus(paid),
      hasReceivable: active.length > 0,
    };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async findAll(query: ListWorkOrdersDto) {
    const {
      page = 1, limit = 20, search, status, priority, assignedToId, garmentId, customerId,
      startDate, endDate, dueStart, dueEnd,
    } = query;

    const where: Prisma.WorkOrderWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assignedToId && { assignedToId }),
      ...(garmentId && { garmentId }),
      ...(customerId && { customerId }),
      ...(startDate && endDate && { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }),
      ...((dueStart || dueEnd) && {
        dueDate: {
          ...(dueStart && { gte: new Date(dueStart) }),
          ...(dueEnd && { lte: new Date(dueEnd) }),
        },
      }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
          garment: { select: { id: true, name: true } },
          // O saldo da OS decide o que a tela oferece — receber ou só entregar.
          // Sem ele, a lista obriga a abrir uma OS por vez para descobrir.
          accountsReceivable: { select: { amount: true, paidAmount: true, status: true } },
        },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return {
      data: data.map(({ accountsReceivable, ...wo }) => ({
        ...wo,
        financials: this.financials(wo.total, wo.discount, accountsReceivable),
      })),
      total,
      page,
      limit,
    };
  }

  /** Quadro de produção agrupado por status, com contadores por coluna. */
  async getBoard(query: BoardQueryDto) {
    const { assignedToId, priority, garmentId, search } = query;
    const where: Prisma.WorkOrderWhereInput = {
      deletedAt: null,
      status: { in: BOARD_COLUMNS },
      ...(assignedToId && { assignedToId }),
      ...(priority && { priority }),
      ...(garmentId && { garmentId }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const orders = await this.prisma.workOrder.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        garment: { select: { id: true, name: true } },
        _count: { select: { items: true } },
        // Última atualização aparece no cartão do quadro (US-20).
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { note: true, createdAt: true, user: { select: { name: true } } },
        },
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const columns = BOARD_COLUMNS.map(status => {
      const items = orders
        .filter(o => o.status === status)
        .map(o => ({
          ...o,
          // "Atrasada" só faz sentido enquanto a peça não foi entregue.
          overdue:
            Boolean(o.dueDate) &&
            o.dueDate! < startOfToday &&
            o.status !== 'DELIVERED',
        }));
      return {
        status,
        count: items.length,
        overdueCount: items.filter(i => i.overdue).length,
        items,
      };
    });

    return { columns, total: orders.length };
  }

  async findOne(id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        quote: { select: { id: true, number: true, status: true } },
        garment: { select: { id: true, name: true, category: true } },
        assignedTo: { select: { id: true, name: true } },
        deliveredBy: { select: { id: true, name: true } },
        cancelledBy: { select: { id: true, name: true } },
        items: { include: { service: true, product: true }, orderBy: { order: 'asc' } },
        schedules: { orderBy: { startAt: 'asc' } },
        accountsReceivable: {
          select: { id: true, description: true, amount: true, paidAmount: true, status: true, dueDate: true },
          orderBy: { dueDate: 'asc' },
        },
        inventoryMovements: {
          where: { type: 'OUT' },
          include: { product: { select: { id: true, name: true, unit: true } } },
          orderBy: { occurredAt: 'desc' },
        },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    return { ...wo, financials: this.financials(wo.total, wo.discount, wo.accountsReceivable) };
  }

  // ── Escrita ───────────────────────────────────────────────────────────────

  async create(dto: CreateWorkOrderDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    const { items, measurements, ...data } = dto;
    const number = await this.nextNumber();
    const discount = D(dto.discount ?? 0);
    const total = items ? this.itemsTotal(items) : ZERO;

    return this.prisma.$transaction(async tx => {
      const wo = await tx.workOrder.create({
        data: {
          ...data,
          number,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          discount: discount,
          total: total,
          measurements: (measurements ?? undefined) as Prisma.InputJsonValue | undefined,
          ...(items && { items: { create: this.itemsCreate(items) } }),
        },
        include: { customer: true, items: true, assignedTo: { select: { id: true, name: true } } },
      });

      const netTotal = total.minus(discount);
      if (netTotal.gt(0)) {
        await this.createReceivableFor(tx, wo, netTotal);
      }

      return wo;
    });
  }

  async update(id: string, dto: UpdateWorkOrderDto) {
    const wo = await this.findOne(id);
    const { items, measurements, ...data } = dto;

    return this.prisma.$transaction(async tx => {
      let updatedWo = wo;
      if (items) {
        if (items.length === 0) {
          throw new BadRequestException('A ordem de serviço deve conter pelo menos um item.');
        }
        await tx.workOrderItem.deleteMany({ where: { workOrderId: id } });
      }

      updatedWo = await tx.workOrder.update({
        where: { id },
        data: {
          ...data,
          ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
          ...(dto.discount !== undefined && { discount: D(dto.discount) }),
          ...(measurements !== undefined && { measurements: measurements as Prisma.InputJsonValue }),
          ...(items && { total: this.itemsTotal(items), items: { create: this.itemsCreate(items) } }),
        },
        include: { accountsReceivable: { where: { deletedAt: null } } },
      }) as any;

      const newTotal = updatedWo.total;
      const newDiscount = updatedWo.discount;
      const netTotal = newTotal.minus(newDiscount);

      // Atualiza a conta a receber, se existir, para refletir o novo total.
      const receivable = updatedWo.accountsReceivable.find(r => r.status !== 'CANCELLED');
      if (receivable) {
        if (receivable.paidAmount.gt(netTotal)) {
          throw new BadRequestException('O novo valor da OS é menor do que o montante já pago.');
        }
        await tx.accountReceivable.update({
          where: { id: receivable.id },
          data: { amount: netTotal },
        });
      } else if (netTotal.gt(0)) {
        // Se não havia conta, cria uma nova.
        await this.createReceivableFor(tx, updatedWo, netTotal);
      }

      return tx.workOrder.findUnique({
        where: { id },
        include: { customer: true, items: { include: { service: true, product: true } }, assignedTo: { select: { id: true, name: true } } },
      });
    });
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    // A entrega tem regra própria (confere saldo devedor e registra quem
    // entregou), então não pode ser alcançada por uma troca simples de status.
    if (dto.status === 'DELIVERED') {
      throw new BadRequestException(
        'Use o registro de entrega para marcar a OS como entregue',
      );
    }
    // Cancelar tem regra própria: pede motivo, encerra as cobranças em aberto e
    // decide o que fazer com o sinal. Uma troca simples de status pularia tudo
    // isso e deixaria a cliente sendo cobrada por um serviço que não existe mais.
    if (dto.status === 'CANCELLED') {
      throw new BadRequestException(
        'Use o cancelamento da OS para registrar a desistência da cliente',
      );
    }
    // Temporary exemption: allowing revert from DELIVERED to fix erroneous entry.
    // if (wo.status === 'DELIVERED') {
    //   throw new BadRequestException('OS já entregue não pode mudar de status');
    // }
    if (wo.status === 'CANCELLED') {
      throw new BadRequestException('OS cancelada não pode mudar de status');
    }

    const timestamps: Prisma.WorkOrderUpdateInput = {};
    if (dto.status === 'IN_PROGRESS' && !wo.startedAt) timestamps.startedAt = new Date();
    if (dto.status === 'DONE') timestamps.completedAt = new Date();

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: dto.status, ...timestamps },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  async assign(id: string, dto: AssignDto) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    if (dto.assignedToId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, deletedAt: null, active: true },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('Costureira não encontrada ou inativa');
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId ?? null,
        ...(dto.reason && {
          internalNotes: [wo.internalNotes, `[Reatribuição] ${dto.reason}`].filter(Boolean).join('\n'),
        }),
      },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
  }

  /**
   * Cria a cobrança de uma OS que nasceu sem orçamento. Sem ela o valor não
   * existe no financeiro — e não há onde dar baixa quando a cliente paga.
   */
  private createReceivableFor(
    tx: Prisma.TransactionClient | PrismaService,
    wo: { id: string; number: string; customerId: string },
    total: Prisma.Decimal,
  ) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return tx.accountReceivable.create({
      data: {
        customerId: wo.customerId,
        workOrderId: wo.id,
        description: `${wo.number} — entrega`,
        amount: total,
        dueDate,
        category: DEFAULT_INCOME_CATEGORY,
      },
    });
  }

  async registerPayment(id: string, dto: DeliverPaymentDto) {
    return this.receiveOnDelivery(id, dto);
  }

  /**
   * Baixa o saldo da OS no ato da entrega, distribuindo o valor entre as contas
   * em aberto da mais antiga para a mais nova — que é a ordem em que a cliente
   * deve. Roda antes da entrega porque é o pagamento que zera o saldo que a
   * entrega valida logo em seguida.
   */
  private async receiveOnDelivery(id: string, payment: DeliverPaymentDto) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        accountsReceivable: {
          where: { deletedAt: null },
          select: { id: true, amount: true, paidAmount: true, status: true, dueDate: true },
        },
      },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    if (wo.status === 'DELIVERED') throw new BadRequestException('Esta OS já foi entregue');
    if (wo.status === 'CANCELLED') throw new BadRequestException('OS cancelada não pode ser entregue');

    const fin = this.financials(wo.total, wo.discount, wo.accountsReceivable);
    if (fin.balance.lte(0)) {
      throw new BadRequestException('Esta OS não tem saldo em aberto');
    }

    let left = D(payment.amount);
    if (left.gt(fin.balance)) {
      throw new BadRequestException(`Valor excede o saldo em aberto de ${brl(fin.balance)}`);
    }

    const open = fin.hasReceivable
      ? wo.accountsReceivable
        .filter(r => r.status !== 'CANCELLED' && r.status !== 'PAID')
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      : [await this.createReceivableFor(this.prisma, wo, fin.total)];

    // O troco só faz sentido quando a baixa é uma só; espalhado entre contas
    // ele viraria um valor entregue por parcela, que ninguém contou assim.
    const tendered = open.length === 1 ? payment.amountTendered : undefined;

    for (const rec of open) {
      if (left.lte(0)) break;
      const remaining = D(rec.amount).minus(rec.paidAmount);
      if (remaining.lte(0)) continue;
      const slice = Prisma.Decimal.min(left, remaining);
      await this.financial.payReceivable(rec.id, {
        amount: slice.toNumber(),
        method: payment.method,
        accountId: payment.accountId,
        amountTendered: tendered,
      });
      left = left.minus(slice);
    }
  }

  /**
   * Registro de entrega. Recusa quando há saldo devedor, a menos que a
   * atendente confirme conscientemente — é a decisão que o backlog pede que o
   * sistema force alguém a tomar, em vez de deixar passar silenciosamente.
   *
   * Quando vem `payment`, a cliente está pagando no balcão: o recebimento entra
   * primeiro e a entrega encontra o saldo já zerado.
   */
  async deliver(id: string, dto: DeliverDto, userId?: string) {
    if (dto.payment) await this.receiveOnDelivery(id, dto.payment);

    return this.prisma.$transaction(async tx => {
      const wo = await tx.workOrder.findFirst({
        where: { id, deletedAt: null },
        include: {
          accountsReceivable: { select: { id: true, amount: true, paidAmount: true, status: true } },
          customer: { select: { id: true, name: true } },
        },
      });
      if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
      if (wo.status === 'DELIVERED') throw new BadRequestException('Esta OS já foi entregue');
      if (wo.status === 'CANCELLED') throw new BadRequestException('OS cancelada não pode ser entregue');

      const fin = this.financials(wo.total, wo.discount, wo.accountsReceivable);

      if (fin.balance.gt(0) && !dto.acknowledgeDebt) {
        throw new BadRequestException(
          `A cliente ainda deve ${brl(fin.balance)}. Registre o pagamento ou confirme a ` +
            'entrega com saldo em aberto.',
        );
      }

      // OS criada direto (sem orçamento) não tem cobrança nenhuma; entregar sem
      // gerar a conta faria o valor sumir do financeiro.
      if (!fin.hasReceivable && fin.total.gt(0)) {
        await this.createReceivableFor(tx, wo, fin.total);
      }

      return tx.workOrder.update({
        where: { id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          deliveredById: userId ?? null,
          receivedBy: dto.receivedBy ?? null,
          ...(dto.notes && {
            internalNotes: [wo.internalNotes, `[Entrega] ${dto.notes}`].filter(Boolean).join('\n'),
          }),
        },
        include: {
          customer: true,
          deliveredBy: { select: { id: true, name: true } },
        cancelledBy: { select: { id: true, name: true } },
          items: { orderBy: { order: 'asc' } },
        },
      });
    });
  }

  // ── Andamento (US-20) ─────────────────────────────────────────────────────

  async addUpdate(id: string, dto: CreateUpdateDto, userId?: string) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, deletedAt: null } });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    if (wo.status === 'DELIVERED' || wo.status === 'CANCELLED') {
      throw new BadRequestException('OS encerrada não recebe mais atualizações');
    }

    return this.prisma.$transaction(async tx => {
      const update = await tx.workOrderUpdate.create({
        data: {
          workOrderId: id,
          note: dto.note,
          progressPct: dto.progressPct ?? null,
          userId: userId ?? null,
        },
        include: { user: { select: { id: true, name: true } } },
      });

      // O percentual da OS é o da última atualização que informou um.
      if (dto.progressPct !== undefined) {
        await tx.workOrder.update({ where: { id }, data: { progressPct: dto.progressPct } });
      }
      return update;
    });
  }

  listUpdates(id: string) {
    return this.prisma.workOrderUpdate.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        attachments: { select: { id: true, url: true, originalName: true, caption: true } },
      },
    });
  }

  setEstimatedHours(id: string, dto: SetEstimatedHoursDto) {
    return this.prisma.workOrder.update({
      where: { id },
      data: { estimatedHours: D(dto.estimatedHours) },
      select: { id: true, number: true, estimatedHours: true },
    });
  }

  // ── Fila de produção por costureira (US-19) ───────────────────────────────

  /**
   * Carga de cada costureira: as OS abertas atribuídas a ela, as horas
   * estimadas somadas e quantos dias de trabalho isso representa na capacidade
   * diária dela. Quem não tem estimativa entra com a média das que têm, para o
   * número não mentir por omissão.
   */
  async getQueues() {
    const [users, orders, business] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { deletedAt: null, active: true },
        select: { id: true, name: true, dailyCapacityHours: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workOrder.findMany({
        where: { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          customer: { select: { id: true, name: true } },
          garment: { select: { id: true, name: true } },
        },
      }),
      this.prisma.businessInfo.findFirst({ select: { queueAlertDays: true } }),
    ]);

    const alertDays = business?.queueAlertDays ?? 7;
    const withHours = orders.filter(o => o.estimatedHours !== null);
    const averageHours = withHours.length
      ? withHours.reduce((s, o) => s.plus(o.estimatedHours!), ZERO).dividedBy(withHours.length)
      : D(4);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const buildQueue = (
      id: string | null,
      name: string,
      capacity: Prisma.Decimal,
      items: typeof orders,
    ) => {
      const hours = items.reduce((s, o) => s.plus(o.estimatedHours ?? averageHours), ZERO);
      const days = capacity.gt(0) ? hours.dividedBy(capacity) : ZERO;
      return {
        userId: id,
        name,
        dailyCapacityHours: capacity,
        count: items.length,
        estimatedHours: hours,
        // Quantos dias de trabalho a fila representa.
        queueDays: days.toDecimalPlaces(1),
        overloaded: days.gt(alertDays),
        overdueCount: items.filter(o => o.dueDate && o.dueDate < startOfToday).length,
        items: items.map(o => ({
          ...o,
          overdue: Boolean(o.dueDate && o.dueDate < startOfToday),
          hoursUsed: o.estimatedHours ?? averageHours,
          estimated: o.estimatedHours !== null,
        })),
      };
    };

    const queues = users.map(u =>
      buildQueue(u.id, u.name, D(u.dailyCapacityHours), orders.filter(o => o.assignedToId === u.id)),
    );

    const unassigned = orders.filter(o => !o.assignedToId);
    if (unassigned.length) {
      queues.push(buildQueue(null, 'Sem costureira', ZERO, unassigned));
    }

    return { alertDays, averageHours, queues };
  }

  /**
   * O que o cancelamento vai mexer, para a tela avisar antes de confirmar.
   *
   * Cancelar uma OS não é só mudar o status: há cobrança em aberto que precisa
   * deixar de ser cobrada, sinal que a cliente já pagou e material que talvez
   * volte para a prateleira.
   */
  async getCancelPreview(id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, number: true, status: true, total: true, discount: true },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    const [receivables, consumed] = await Promise.all([
      this.prisma.accountReceivable.findMany({
        where: { workOrderId: id, deletedAt: null, status: { not: 'CANCELLED' } },
        select: { id: true, description: true, amount: true, paidAmount: true, status: true },
      }),
      this.prisma.inventoryMovement.findMany({
        where: { workOrderId: id, type: 'OUT' },
        select: { quantity: true, product: { select: { name: true, unit: true } } },
      }),
    ]);

    const open = receivables.reduce((s, r) => s.plus(D(r.amount).minus(r.paidAmount)), ZERO);
    const paid = receivables.reduce((s, r) => s.plus(r.paidAmount), ZERO);

    return {
      workOrder: { id: wo.id, number: wo.number, status: wo.status },
      canCancel: wo.status !== 'DELIVERED' && wo.status !== 'CANCELLED',
      openAmount: open,
      openCount: receivables.filter(r => D(r.amount).gt(r.paidAmount)).length,
      paidAmount: paid,
      materials: consumed.map(m => ({
        name: m.product.name,
        quantity: m.quantity,
        unit: m.product.unit,
      })),
    };
  }

  /**
   * Cancela a OS porque a cliente desistiu.
   *
   * A OS não é apagada: fica com status CANCELLED, o motivo e quem cancelou —
   * apagar esconderia que o trabalho existiu e que houve dinheiro no meio.
   *
   * O que acontece com o dinheiro:
   *  - o que ainda seria cobrado deixa de ser (as contas em aberto são canceladas);
   *  - o que a cliente já pagou é decisão do ateliê: fica como compensação pelo
   *    trabalho já feito, ou vira uma conta a pagar para ser devolvida.
   */
  async cancel(id: string, dto: CancelWorkOrderDto, userId?: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: { customer: { select: { id: true, name: true } } },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    if (wo.status === 'DELIVERED') {
      throw new BadRequestException(
        'A peça já foi entregue — uma OS entregue não pode ser cancelada.',
      );
    }
    if (wo.status === 'CANCELLED') throw new BadRequestException('Esta OS já está cancelada');

    const receivables = await this.prisma.accountReceivable.findMany({
      where: { workOrderId: id, deletedAt: null, status: { not: 'CANCELLED' } },
      select: { id: true, amount: true, paidAmount: true },
    });
    const paid = receivables.reduce((s, r) => s.plus(r.paidAmount), ZERO);

    const result = await this.prisma.$transaction(async tx => {
      // O que ainda não foi pago deixa de ser cobrado. O que já foi pago
      // continua registrado: o dinheiro entrou de verdade.
      const toCancel = receivables.filter(r => D(r.amount).gt(r.paidAmount));
      if (toCancel.length > 0) {
        await tx.accountReceivable.updateMany({
          where: { id: { in: toCancel.map(r => r.id) } },
          data: { status: 'CANCELLED' },
        });
      }

      // Devolver o sinal é uma saída de dinheiro como qualquer outra: vira conta
      // a pagar, e sai do caixa quando for efetivamente devolvido.
      let refund: { id: string } | null = null;
      if (dto.refundPaid && paid.gt(0)) {
        refund = await tx.accountPayable.create({
          data: {
            description: `Devolução à cliente — ${wo.number} cancelada`,
            supplier: wo.customer?.name ?? null,
            category: 'Devolução de sinal',
            amount: paid,
            dueDate: new Date(),
            notes: dto.reason,
          },
          select: { id: true },
        });
      }

      await tx.workOrderUpdate.create({
        data: {
          workOrderId: id,
          note: `OS cancelada — ${dto.reason}`,
          userId: userId ?? null,
        },
      });

      return tx.workOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          cancelledById: userId ?? null,
        },
        include: {
          customer: { select: { id: true, name: true } },
          cancelledBy: { select: { id: true, name: true } },
        },
      });
    });

    // Fora da transação: a devolução ao estoque tem transação própria e valida
    // saldo produto a produto.
    const materials = dto.returnMaterials
      ? await this.inventory.returnFromWorkOrder(id, userId)
      : { returned: 0, items: [] };

    return {
      workOrder: result,
      cancelledReceivables: receivables.filter(r => D(r.amount).gt(r.paidAmount)).length,
      paidAmount: paid,
      refunded: Boolean(dto.refundPaid && paid.gt(0)),
      materialsReturned: materials.returned,
    };
  }

  async remove(id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: { accountsReceivable: { where: { deletedAt: null } } },
    });
    if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');

    if (wo.status === 'DELIVERED') {
      throw new BadRequestException('OS já entregue não pode ser removida');
    }

    const hasPayments = wo.accountsReceivable.some(r => r.paidAmount.gt(0));
    if (hasPayments) {
      throw new BadRequestException('Esta OS possui pagamentos registrados e não pode ser removida. Cancele os pagamentos primeiro.');
    }

    return this.prisma.$transaction(async tx => {
      await tx.accountReceivable.updateMany({
        where: { workOrderId: id },
        data: { deletedAt: new Date() },
      });
      return tx.workOrder.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  /** Dados do recibo de entrega. */
  async getReceipt(id: string) {
    const wo = await this.findOne(id);
    if (wo.status !== 'DELIVERED') {
      throw new BadRequestException('O recibo só existe depois que a peça é entregue');
    }
    const business = await this.prisma.businessInfo.findFirst();
    return { workOrder: wo, business };
  }
}
