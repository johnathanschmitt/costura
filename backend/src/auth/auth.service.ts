import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, active: true },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return user;
  }

  async login(user: any) {
    const permissions = user.role.permissions.map(
      (rp: any) => `${rp.permission.action}:${rp.permission.resource}`,
    );
    return {
      access_token: this.jwt.sign({ sub: user.id, email: user.email, role: user.role.name, permissions }),
      // As permissões vão junto para a tela poder esconder o que a usuária não
      // pode acessar. Quem decide de verdade é o backend — isto é só UX.
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role.name, avatarUrl: user.avatarUrl, permissions,
      },
    };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: { select: { name: true } } },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Senha alterada com sucesso' };
  }
}
