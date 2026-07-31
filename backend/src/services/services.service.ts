import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string, active?: string) {
    return this.prisma.service.findMany({
      where: {
        deletedAt: null,
        ...(active === 'true' && { active: true }),
        ...(active === 'false' && { active: false }),
        ...(active === undefined && { active: true }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const s = await this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!s) throw new NotFoundException('Serviço não encontrado');
    return s;
  }

  create(data: any) {
    return this.prisma.service.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
