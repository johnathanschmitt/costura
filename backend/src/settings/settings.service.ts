import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_TEMPLATE, TEMPLATE_VARS } from '../quotes/quote-share';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // ── Users ──────────────────────────────────────────────────────────────────

  async listUsers() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, email: true, phone: true,
        active: true, avatarUrl: true, createdAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, name: true, email: true, phone: true,
        active: true, avatarUrl: true, createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async createUser(data: { name: string; email: string; password: string; phone?: string; roleId: string }) {
    const existing = await this.prisma.user.findFirst({ where: { email: data.email, deletedAt: null } });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash, phone: data.phone, roleId: data.roleId },
      select: { id: true, name: true, email: true, phone: true, active: true, role: { select: { id: true, name: true } } },
    });
  }

  async updateUser(id: string, data: { name?: string; email?: string; phone?: string; roleId?: string; active?: boolean }) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (data.email && data.email !== user.email) {
      const conflict = await this.prisma.user.findFirst({ where: { email: data.email, deletedAt: null } });
      if (conflict) throw new ConflictException('E-mail já cadastrado');
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, phone: true, active: true, role: { select: { id: true, name: true } } },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { message: 'Senha redefinida com sucesso' };
  }

  async removeUser(id: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('Não é possível excluir o próprio usuário');
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return { message: 'Usuário removido' };
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  async listRoles() {
    return this.prisma.role.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, description: true,
        _count: { select: { users: true } },
        permissions: {
          select: { permission: { select: { action: true, resource: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ── Audit Logs ─────────────────────────────────────────────────────────────

  async listAuditLogs(page: any = 1, limit: any = 30) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, parseInt(limit) || 30);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data, total, page: p, limit: l };
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
  }

  // ── BusinessInfo ───────────────────────────────────────────────────────────

  async getBusinessInfo() {
    let info = await this.prisma.businessInfo.findFirst();
    if (!info) {
      info = await this.prisma.businessInfo.create({ data: {} });
    }
    // O modelo padrão vem junto para a tela de configuração poder mostrá-lo e
    // oferecer "restaurar" sem duplicar o texto no frontend.
    return {
      ...info,
      whatsappTemplateDefault: DEFAULT_TEMPLATE,
      whatsappTemplateVars: TEMPLATE_VARS,
    };
  }

  async updateBusinessInfo(data: {
    name?: string; logoBase64?: string | null; tagline?: string | null;
    address?: string | null; city?: string | null; phone?: string | null;
    email?: string | null; website?: string | null; taxId?: string | null;
    footerText?: string | null; quoteValidityDays?: number; queueAlertDays?: number;
    whatsappTemplate?: string | null;
    whatsapp?: string | null; instagram?: string | null;
    facebook?: string | null; tiktok?: string | null;
  }) {
    let info = await this.prisma.businessInfo.findFirst();
    if (!info) {
      return this.prisma.businessInfo.create({ data: { ...data } });
    }
    return this.prisma.businessInfo.update({ where: { id: info.id }, data });
  }
}
