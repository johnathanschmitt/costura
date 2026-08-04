import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustStockDto, CloseCountDto, CreateEntryDto, CreateExitDto, ListInventoryDto,
  ListMovementsDto, SetMinQuantityDto,
} from './dto/inventory.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

/** Quantidades são Decimal(10,3); exibimos sem zeros à direita. */
const qty = (v: Prisma.Decimal.Value) => D(v).toFixed(3).replace(/\.?0+$/, '');

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ── Consultas ─────────────────────────────────────────────────────────────

  async getAll(query: ListInventoryDto = {}) {
    const { search, lowOnly } = query;
    const where: Prisma.InventoryWhereInput = {
      product: {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      },
      ...(lowOnly === 'true' && { id: { in: await this.lowStockIds() } }),
    };

    return this.prisma.inventory.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  /**
   * Comparar duas colunas (quantity <= minQuantity) não é expressável no `where`
   * do Prisma; a alternativa seria carregar o estoque inteiro e filtrar em
   * memória. Resolvemos os ids no banco e mantemos o findMany tipado.
   */
  private async lowStockIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT i.id
        FROM inventory i
        JOIN products p ON p.id = i."productId"
       WHERE p."deletedAt" IS NULL
         AND p.active = true
         AND i.quantity <= i."minQuantity"
    `;
    return rows.map(r => r.id);
  }

  async getLowStock() {
    const ids = await this.lowStockIds();
    if (ids.length === 0) return [];
    return this.prisma.inventory.findMany({
      where: { id: { in: ids } },
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async listMovements(query: ListMovementsDto) {
    const { page = 1, limit = 20, productId, type, startDate, endDate } = query;
    const where: Prisma.InventoryMovementWhereInput = {
      ...(productId && { productId }),
      ...(type && { type }),
      ...((startDate || endDate) && {
        occurredAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [data, total, purchases] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true } },
          workOrder: { select: { id: true, number: true } },
          attachments: { select: { id: true, url: true, originalName: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.aggregate({
        where: { ...where, type: MovementType.IN },
        _sum: { totalCost: true },
      }),
    ]);

    return { data, total, page, limit, summary: { totalCost: purchases._sum.totalCost ?? ZERO } };
  }

  // ── Movimentações ─────────────────────────────────────────────────────────

  /**
   * Ponto único por onde o saldo muda. Grava o saldo resultante na própria
   * movimentação, para que o histórico continue legível mesmo depois de novas
   * entradas e baixas.
   */
  private async move(input: {
    productId: string;
    type: MovementType;
    /** Variação com sinal aplicada ao saldo. */
    delta: Prisma.Decimal;
    userId?: string;
    data: Omit<
      Prisma.InventoryMovementUncheckedCreateInput,
      'productId' | 'type' | 'quantity' | 'delta' | 'balanceAfter' | 'userId'
    >;
  }) {
    return this.prisma.$transaction(async tx => {
      const product = await tx.product.findFirst({
        where: { id: input.productId, deletedAt: null },
        include: { inventory: true },
      });
      if (!product) throw new NotFoundException('Produto não encontrado');

      const current = D(product.inventory?.quantity ?? 0);
      const balanceAfter = current.plus(input.delta);
      if (balanceAfter.isNegative()) {
        throw new BadRequestException(
          `Estoque insuficiente: há ${qty(current)} ${product.unit} de "${product.name}", ` +
            `mas a baixa é de ${qty(input.delta.abs())} ${product.unit}`,
        );
      }

      await tx.inventory.upsert({
        where: { productId: input.productId },
        create: { productId: input.productId, quantity: balanceAfter },
        update: { quantity: balanceAfter },
      });

      return tx.inventoryMovement.create({
        data: {
          ...input.data,
          productId: input.productId,
          type: input.type,
          quantity: input.delta.abs(),
          delta: input.delta,
          balanceAfter,
          userId: input.userId ?? null,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true } },
        },
      });
    });
  }

  /** Entrada de material comprado. */
  registerEntry(dto: CreateEntryDto, userId?: string) {
    const quantity = D(dto.quantity);
    const unitCost = dto.unitCost !== undefined ? D(dto.unitCost) : null;

    return this.move({
      productId: dto.productId,
      type: MovementType.IN,
      delta: quantity,
      userId,
      data: {
        unitCost,
        totalCost: unitCost ? unitCost.times(quantity) : null,
        supplier: dto.supplier ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
        notes: dto.notes ?? null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });
  }

  /** Baixa por consumo. */
  async registerExit(dto: CreateExitDto, userId?: string) {
    if (dto.workOrderId) {
      const wo = await this.prisma.workOrder.findFirst({
        where: { id: dto.workOrderId, deletedAt: null },
        select: { id: true },
      });
      if (!wo) throw new NotFoundException('Ordem de serviço não encontrada');
    }

    return this.move({
      productId: dto.productId,
      type: MovementType.OUT,
      delta: D(dto.quantity).negated(),
      userId,
      data: {
        reason: dto.reason,
        workOrderId: dto.workOrderId ?? null,
        notes: dto.notes ?? null,
        occurredAt: new Date(),
      },
    });
  }

  /**
   * Devolve ao estoque o material que tinha sido baixado para uma OS.
   *
   * Usado quando a cliente desiste antes de o material ser cortado ou usado:
   * o tecido volta para a prateleira e precisa voltar para o saldo, senão o
   * estoque do sistema fica menor do que a realidade para sempre.
   */
  async returnFromWorkOrder(workOrderId: string, userId?: string) {
    const consumed = await this.prisma.inventoryMovement.findMany({
      where: { workOrderId, type: MovementType.OUT },
      select: { productId: true, quantity: true, product: { select: { name: true } } },
    });
    if (consumed.length === 0) return { returned: 0, items: [] as { name: string; quantity: string }[] };

    // Junta o mesmo produto baixado em vezes diferentes numa devolução só.
    const byProduct = new Map<string, { quantity: Prisma.Decimal; name: string }>();
    for (const m of consumed) {
      const entry = byProduct.get(m.productId) ?? { quantity: D(0), name: m.product.name };
      entry.quantity = entry.quantity.plus(m.quantity);
      byProduct.set(m.productId, entry);
    }

    const items: { name: string; quantity: string }[] = [];
    for (const [productId, { quantity, name }] of byProduct) {
      await this.move({
        productId,
        type: MovementType.IN,
        delta: quantity,
        userId,
        data: {
          reason: 'Devolução por cancelamento de OS',
          workOrderId,
          occurredAt: new Date(),
        },
      });
      items.push({ name, quantity: quantity.toString() });
    }

    return { returned: items.length, items };
  }

  /** Ajuste de inventário: informa-se a contagem física e o sistema apura a diferença. */
  async adjust(dto: AdjustStockDto, userId?: string) {
    const inventory = await this.prisma.inventory.findUnique({ where: { productId: dto.productId } });
    const current = D(inventory?.quantity ?? 0);
    const counted = D(dto.countedQuantity);
    const delta = counted.minus(current);

    if (delta.isZero()) {
      throw new BadRequestException('A contagem informada é igual ao saldo atual — nada a ajustar');
    }

    return this.move({
      productId: dto.productId,
      type: MovementType.ADJUSTMENT,
      delta,
      userId,
      data: {
        reason: dto.reason,
        notes: `Saldo anterior: ${qty(current)} · contado: ${qty(counted)}`,
        occurredAt: new Date(),
      },
    });
  }

  // ── Inventário (US-27) ────────────────────────────────────────────────────

  /** Folha de contagem: todos os produtos com o saldo que o sistema acredita ter. */
  async getCountSheet() {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, active: true },
      select: {
        id: true, name: true, sku: true, unit: true,
        inventory: { select: { quantity: true, location: true } },
      },
      orderBy: { name: 'asc' },
    });
    return products.map(p => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      location: p.inventory?.location ?? null,
      systemQuantity: p.inventory?.quantity ?? ZERO,
    }));
  }

  /**
   * Fecha uma contagem: grava um ajuste por produto divergente, todos amarrados
   * à mesma sessão. Produtos que bateram não geram movimentação — só as
   * diferenças viram histórico.
   */
  async closeCount(dto: CloseCountDto, userId?: string) {
    const ids = dto.items.map(i => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('O mesmo produto foi informado mais de uma vez');
    }

    const inventories = await this.prisma.inventory.findMany({
      where: { productId: { in: ids } },
      select: { productId: true, quantity: true },
    });
    const current = new Map(inventories.map(i => [i.productId, D(i.quantity)]));

    const divergent = dto.items
      .map(i => ({ ...i, delta: D(i.countedQuantity).minus(current.get(i.productId) ?? ZERO) }))
      .filter(i => !i.delta.isZero());

    const count = await this.prisma.inventoryCount.create({
      data: { userId: userId ?? null, notes: dto.notes ?? null, closedAt: new Date() },
    });

    for (const item of divergent) {
      await this.move({
        productId: item.productId,
        type: MovementType.ADJUSTMENT,
        delta: item.delta,
        userId,
        data: {
          reason: 'Inventário',
          inventoryCountId: count.id,
          notes: `Sistema: ${qty(current.get(item.productId) ?? 0)} · contado: ${qty(item.countedQuantity)}`,
          occurredAt: new Date(),
        },
      });
    }

    return this.getCountReport(count.id);
  }

  /** Relatório de divergências de uma contagem. */
  async getCountReport(id?: string) {
    const count = id
      ? await this.prisma.inventoryCount.findUnique({ where: { id } })
      : await this.prisma.inventoryCount.findFirst({ orderBy: { startedAt: 'desc' } });
    if (!count) throw new NotFoundException('Nenhum inventário encontrado');

    const movements = await this.prisma.inventoryMovement.findMany({
      where: { inventoryCountId: count.id },
      include: { product: { select: { id: true, name: true, sku: true, unit: true, costPrice: true } } },
      orderBy: { product: { name: 'asc' } },
    });

    const valueImpact = movements.reduce((s, m) => {
      const cost = m.product.costPrice ? D(m.product.costPrice) : ZERO;
      return s.plus(cost.times(m.delta));
    }, ZERO);

    return {
      count,
      divergences: movements.map(m => ({
        productId: m.product.id,
        name: m.product.name,
        sku: m.product.sku,
        unit: m.product.unit,
        difference: m.delta,
        kind: m.delta.isNegative() ? 'FALTA' : 'SOBRA',
        balanceAfter: m.balanceAfter,
        detail: m.notes,
      })),
      summary: {
        divergentProducts: movements.length,
        shortages: movements.filter(m => m.delta.isNegative()).length,
        surpluses: movements.filter(m => m.delta.isPositive()).length,
        valueImpact,
        countedAt: count.closedAt ?? count.startedAt,
      },
    };
  }

  listCounts() {
    return this.prisma.inventoryCount.findMany({
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { movements: true } },
      },
    });
  }

  async setMinQuantity(productId: string, dto: SetMinQuantityDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    return this.prisma.inventory.upsert({
      where: { productId },
      create: {
        productId,
        quantity: ZERO,
        minQuantity: D(dto.minQuantity),
        location: dto.location ?? null,
      },
      update: {
        minQuantity: D(dto.minQuantity),
        ...(dto.location !== undefined && { location: dto.location }),
      },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });
  }
}
