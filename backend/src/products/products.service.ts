import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
      include: { inventory: true },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null }, include: { inventory: true } });
    if (!p) throw new NotFoundException('Produto não encontrado');
    return p;
  }

  async create(data: any) {
    const { initialQuantity, ...productData } = data;
    return this.prisma.product.create({
      data: {
        ...productData,
        ...(initialQuantity !== undefined && {
          inventory: { create: { quantity: initialQuantity } },
        }),
      },
      include: { inventory: true },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data, include: { inventory: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
