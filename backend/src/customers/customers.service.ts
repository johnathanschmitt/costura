import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, page: any = 1, limit: any = 20) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 20);
    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { cpf: { contains: search } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { name: 'asc' },
        include: { _count: { select: { workOrders: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page: p, limit: l };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        measurements: { orderBy: { takenAt: 'desc' }, take: 1 },
        workOrders: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 },
        quotes: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return customer;
  }

  async create(data: any) {
    return this.prisma.customer.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getMeasurements(customerId: string) {
    return this.prisma.bodyMeasurement.findMany({
      where: { customerId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async saveMeasurement(customerId: string, data: any) {
    const last = await this.prisma.bodyMeasurement.findFirst({
      where: { customerId },
      orderBy: { version: 'desc' },
    });
    return this.prisma.bodyMeasurement.create({
      data: { ...data, customerId, version: (last?.version ?? 0) + 1 },
    });
  }
}
