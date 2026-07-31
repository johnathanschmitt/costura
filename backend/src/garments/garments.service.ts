import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GarmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, category?: string, active?: string, page: any = 1, limit: any = 24) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 24);
    const where = {
      deletedAt: null,
      ...(active === 'true' && { active: true }),
      ...(active === 'false' && { active: false }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.garment.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.garment.count({ where }),
    ]);
    return { data, total, page: p, limit: l };
  }

  async findOne(id: string) {
    const g = await this.prisma.garment.findFirst({ where: { id, deletedAt: null } });
    if (!g) throw new NotFoundException('Peça não encontrada');
    return g;
  }

  async create(data: { name: string; category?: string; description?: string; imageUrl?: string }) {
    return this.prisma.garment.create({ data });
  }

  async update(id: string, data: { name?: string; category?: string; description?: string; imageUrl?: string; active?: boolean }) {
    await this.findOne(id);
    return this.prisma.garment.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.garment.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  }

  async listCategories() {
    const rows = await this.prisma.garment.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map(r => r.category).filter(Boolean);
  }
}
