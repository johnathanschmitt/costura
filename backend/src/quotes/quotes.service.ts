import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialService } from '../financial/financial.service';
import { DEFAULT_INCOME_CATEGORY } from '../financial/financial.constants';
import {
  ConvertDto, CreateQuoteDto, ListQuotesDto, QuoteItemDto, ShareQuoteDto, UpdateQuoteDto,
} from './dto/quotes.dto';
import { renderTemplate, toWhatsAppNumber } from './quote-share';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

const brl = (v: Prisma.Decimal.Value) => `R$ ${D(v).toFixed(2).replace('.', ',')}`;

/** Status que ainda aguardam resposta da cliente e, portanto, podem expirar. */
const AWAITING = ['DRAFT', 'SENT'] as const;

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private financial: FinancialService,
    private config: ConfigService,
  ) {}

  private async nextNumber() {
    const last = await this.prisma.quote.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('ORC-', '')) + 1 : 1;
    return `ORC-${String(num).padStart(5, '0')}`;
  }

  /** Total da linha: quantidade × preço, menos o desconto do item. */
  private lineTotal(i: QuoteItemDto) {
    const gross = D(i.unitPrice).times(i.quantity);
    const discount = D(i.discount ?? 0);
    if (discount.gt(gross)) {
      throw new BadRequestException(
        `O desconto de ${brl(discount)} em "${i.description}" passa do valor da linha (${brl(gross)})`,
      );
    }
    return gross.minus(discount);
  }

  private itemsCreate(items: QuoteItemDto[]) {
    return items.map((i, idx) => ({
      type: i.type,
      description: i.description,
      quantity: D(i.quantity),
      unitPrice: D(i.unitPrice),
      discount: D(i.discount ?? 0),
      total: this.lineTotal(i),
      serviceId: i.serviceId ?? null,
      productId: i.productId ?? null,
      order: idx,
    }));
  }

  /** Subtotal (itens já líquidos) menos o desconto geral. */
  private computeTotal(items: QuoteItemDto[], generalDiscount: Prisma.Decimal.Value) {
    const subtotal = items.reduce((s, i) => s.plus(this.lineTotal(i)), ZERO);
    const discount = D(generalDiscount);
    if (discount.gt(subtotal)) {
      throw new BadRequestException(
        `O desconto geral de ${brl(discount)} passa do subtotal de ${brl(subtotal)}`,
      );
    }
    return { subtotal, total: subtotal.minus(discount) };
  }

  /**
   * Orçamento sem resposta depois da validade vira EXPIRED. O prazo padrão é
   * configurável em Configurações → Dados do ateliê.
   */
  private async markExpired() {
    const now = new Date();
    await this.prisma.quote.updateMany({
      where: { status: { in: [...AWAITING] }, validUntil: { lt: now }, deletedAt: null },
      data: { status: 'EXPIRED' },
    });
  }

  private async defaultValidUntil() {
    const info = await this.prisma.businessInfo.findFirst({ select: { quoteValidityDays: true } });
    const days = info?.quoteValidityDays ?? 15;
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async findAll(query: ListQuotesDto) {
    await this.markExpired();
    const { page = 1, limit = 20, search, status, customerId, startDate, endDate } = query;

    const where: Prisma.QuoteWhereInput = {
      deletedAt: null,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total, sums] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          workOrder: { select: { id: true, number: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.quote.count({ where }),
      this.prisma.quote.aggregate({ where, _sum: { total: true } }),
    ]);
    return { data, total, page, limit, summary: { totalValue: sums._sum.total ?? ZERO } };
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        items: { include: { service: true, product: true }, orderBy: { order: 'asc' } },
        workOrder: { select: { id: true, number: true, status: true } },
      },
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');

    const subtotal = quote.items.reduce((s, i) => s.plus(i.total), ZERO);
    const itemDiscounts = quote.items.reduce((s, i) => s.plus(i.discount), ZERO);
    return { ...quote, subtotal, itemDiscounts };
  }

  // ── Escrita ───────────────────────────────────────────────────────────────

  async create(dto: CreateQuoteDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    const { items = [], validUntil, deliveryDate, ...data } = dto;
    const { total } = this.computeTotal(items, dto.discount ?? 0);

    return this.prisma.quote.create({
      data: {
        ...data,
        number: await this.nextNumber(),
        discount: D(dto.discount ?? 0),
        total,
        validUntil: validUntil ? new Date(validUntil) : await this.defaultValidUntil(),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        ...(items.length && { items: { create: this.itemsCreate(items) } }),
      },
      include: { customer: true, items: true },
    });
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const quote = await this.prisma.quote.findFirst({ where: { id, deletedAt: null } });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status === 'APPROVED') {
      throw new BadRequestException('Orçamento aprovado não pode mais ser editado');
    }

    const { items, validUntil, deliveryDate, ...data } = dto;
    if (items) await this.prisma.quoteItem.deleteMany({ where: { quoteId: id } });

    const discount = dto.discount ?? Number(quote.discount);
    const total = items ? this.computeTotal(items, discount).total : undefined;

    return this.prisma.quote.update({
      where: { id },
      data: {
        ...data,
        ...(dto.discount !== undefined && { discount: D(dto.discount) }),
        ...(validUntil !== undefined && { validUntil: new Date(validUntil) }),
        ...(deliveryDate !== undefined && {
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        }),
        ...(total !== undefined && { total }),
        ...(items && { items: { create: this.itemsCreate(items) } }),
      },
      include: { customer: true, items: true },
    });
  }

  async approve(id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, deletedAt: null } });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status === 'APPROVED') throw new BadRequestException('Orçamento já aprovado');
    return this.prisma.quote.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { customer: true, items: true },
    });
  }

  /** Recusado ou expirado volta a Rascunho para ser reeditado. */
  async reopen(id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, deletedAt: null } });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (!['REJECTED', 'EXPIRED'].includes(quote.status)) {
      throw new BadRequestException('Só orçamentos recusados ou expirados podem ser reabertos');
    }
    return this.prisma.quote.update({
      where: { id },
      data: { status: 'DRAFT', validUntil: await this.defaultValidUntil() },
      include: { customer: true, items: true },
    });
  }

  async duplicate(id: string) {
    const source = await this.findOne(id);
    return this.prisma.quote.create({
      data: {
        number: await this.nextNumber(),
        customerId: source.customerId,
        status: 'DRAFT',
        discount: source.discount,
        total: source.total,
        notes: source.notes,
        deliveryDate: source.deliveryDate,
        validUntil: await this.defaultValidUntil(),
        items: {
          create: source.items.map((i, idx) => ({
            type: i.type,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            total: i.total,
            serviceId: i.serviceId,
            productId: i.productId,
            order: idx,
          })),
        },
      },
      include: { customer: true, items: true },
    });
  }

  // ── Envio à cliente (US-15) ───────────────────────────────────────────────

  /** Cria o token público na primeira vez que o orçamento é compartilhado. */
  private async ensurePublicToken(id: string, current: string | null) {
    if (current) return current;
    const token = randomBytes(16).toString('base64url');
    await this.prisma.quote.update({ where: { id }, data: { publicToken: token } });
    return token;
  }

  /**
   * Prepara o envio por WhatsApp: devolve o link `wa.me` já apontando para o
   * telefone cadastrado da cliente, com a mensagem pronta. Registra o envio e
   * move o orçamento para "Enviado".
   */
  async share(id: string, dto: ShareQuoteDto, userId?: string) {
    const quote = await this.findOne(id);
    const business = await this.prisma.businessInfo.findFirst();

    const token = await this.ensurePublicToken(quote.id, quote.publicToken);
    const baseUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173')
      .replace(/\/$/, '');
    const link = `${baseUrl}/orcamento/${token}`;

    const message = renderTemplate(business?.whatsappTemplate, {
      cliente: quote.customer.name.split(' ')[0],
      numero: quote.number,
      total: brl(quote.total),
      link,
      atelie: business?.name ?? 'Ateliê',
      validade: quote.validUntil
        ? quote.validUntil.toLocaleDateString('pt-BR')
        : 'sem prazo definido',
    });

    const phone = toWhatsAppNumber(dto.phone ?? quote.customer.phone);
    if (dto.channel === 'WHATSAPP' && !phone) {
      throw new BadRequestException(
        quote.customer.phone
          ? `O telefone "${quote.customer.phone}" não parece um número válido para WhatsApp`
          : 'A cliente não tem telefone cadastrado — informe um número para enviar',
      );
    }

    await this.prisma.$transaction([
      this.prisma.quoteSend.create({
        data: {
          quoteId: quote.id,
          channel: dto.channel,
          recipient: dto.channel === 'WHATSAPP' ? phone : null,
          userId: userId ?? null,
        },
      }),
      // Enviar só faz sentido a partir de um rascunho; aprovado ou recusado
      // mantém o status que já tem.
      ...(quote.status === 'DRAFT'
        ? [this.prisma.quote.update({ where: { id }, data: { status: 'SENT' } })]
        : []),
    ]);

    return {
      link,
      message,
      phone,
      whatsappUrl: phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : null,
    };
  }

  listSends(id: string) {
    return this.prisma.quoteSend.findMany({
      where: { quoteId: id },
      orderBy: { sentAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  /** Orçamento pelo token público — sem autenticação, para a cliente abrir. */
  async findByPublicToken(token: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { publicToken: token, deletedAt: null },
      include: {
        // Só o que a cliente precisa ver: nada de telefone, CPF ou endereço.
        customer: { select: { name: true } },
        items: { orderBy: { order: 'asc' } },
      },
    });
    if (!quote) throw new NotFoundException('Orçamento não encontrado ou link expirado');

    const business = await this.prisma.businessInfo.findFirst();
    const subtotal = quote.items.reduce((s, i) => s.plus(i.total), ZERO);
    const { publicToken: _token, ...safe } = quote;

    return { quote: { ...safe, subtotal }, business };
  }

  async remove(id: string) {
    const quote = await this.prisma.quote.findFirst({ where: { id, deletedAt: null } });
    if (!quote) throw new NotFoundException('Orçamento não encontrado');
    if (quote.status === 'APPROVED') {
      throw new BadRequestException('Orçamento aprovado não pode ser removido');
    }
    return this.prisma.quote.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Aprova e converte em OS numa tacada. Opcionalmente registra o sinal já
   * recebido: ele vira uma conta a receber quitada na hora, e o restante uma
   * segunda conta com vencimento futuro.
   */
  async convertToWorkOrder(quoteId: string, dto: ConvertDto = {}) {
    const quote = await this.findOne(quoteId);

    if (quote.workOrder) {
      throw new BadRequestException('Este orçamento já possui uma OS vinculada');
    }
    if (!['APPROVED', 'SENT', 'DRAFT'].includes(quote.status)) {
      throw new BadRequestException(
        `Orçamento ${quote.status === 'EXPIRED' ? 'expirado' : 'recusado'} não vira OS — reabra antes`,
      );
    }

    const total = D(quote.total);
    const downPayment = dto.downPayment ? D(dto.downPayment.amount) : ZERO;
    if (downPayment.gt(total)) {
      throw new BadRequestException(`O sinal não pode passar do total de ${brl(total)}`);
    }

    const last = await this.prisma.workOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const num = last ? parseInt(last.number.replace('OS-', '')) + 1 : 1;

    const { workOrder, signalId } = await this.prisma.$transaction(async tx => {
      const created = await tx.workOrder.create({
        data: {
          number: `OS-${String(num).padStart(5, '0')}`,
          customerId: quote.customerId,
          quoteId: quote.id,
          // A OS guarda o subtotal em `total` e aplica `discount` por cima —
          // `quote.total` já vem líquido, então copiá-lo descontaria duas vezes.
          total: quote.subtotal,
          discount: quote.discount,
          notes: quote.notes,
          dueDate: quote.deliveryDate,
          items: {
            create: quote.items.map((i, idx) => ({
              type: i.type,
              serviceId: i.serviceId,
              productId: i.productId,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              total: i.total,
              order: idx,
            })),
          },
        },
        include: { customer: true, items: true },
      });

      await tx.quote.update({ where: { id: quote.id }, data: { status: 'APPROVED' } });

      const balance = total.minus(downPayment);
      const balanceDue = new Date();
      balanceDue.setDate(balanceDue.getDate() + (dto.balanceDueInDays ?? 30));

      let signal: { id: string } | null = null;
      if (downPayment.gt(0)) {
        signal = await tx.accountReceivable.create({
          data: {
            customerId: quote.customerId,
            workOrderId: created.id,
            description: `${created.number} — sinal`,
            amount: downPayment,
            dueDate: new Date(),
            category: DEFAULT_INCOME_CATEGORY,
            // Marcar como sinal é o que permite o painel avisar que esse
            // dinheiro ainda é de uma peça não entregue.
            isDownPayment: true,
          },
          select: { id: true },
        });
      }
      if (balance.gt(0)) {
        await tx.accountReceivable.create({
          data: {
            customerId: quote.customerId,
            workOrderId: created.id,
            description: `${created.number} — saldo`,
            amount: balance,
            dueDate: balanceDue,
            category: DEFAULT_INCOME_CATEGORY,
          },
        });
      }

      return { workOrder: created, signalId: signal?.id ?? null };
    });

    // A baixa do sinal passa pelo financeiro para gerar o registro de pagamento
    // e, se for em dinheiro, o lançamento no caixa.
    if (signalId && dto.downPayment) {
      await this.financial.payReceivable(signalId, {
        amount: dto.downPayment.amount,
        method: dto.downPayment.method,
      });
    }

    return workOrder;
  }
}
