import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getLowStock() {
    const all = await this.prisma.inventory.findMany({
      include: { product: true },
    });
    return all.filter(
      i => i.product && i.product.deletedAt === null && i.product.active && Number(i.quantity) <= Number(i.minQuantity),
    );
  }

  adjust(productId: string, quantity: number, location?: string) {
    return this.prisma.inventory.upsert({
      where: { productId },
      create: { productId, quantity, location },
      update: { quantity: { increment: quantity }, ...(location && { location }) },
    });
  }

  getAll() {
    return this.prisma.inventory.findMany({
      where: { product: { deletedAt: null } },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });
  }
}
