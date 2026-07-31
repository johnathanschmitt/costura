import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private service: SettingsService) {}

  // ── Users ────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Lista usuários' })
  @Get('users')
  listUsers() {
    return this.service.listUsers();
  }

  @ApiOperation({ summary: 'Busca usuário' })
  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.service.getUser(id);
  }

  @ApiOperation({ summary: 'Cria usuário' })
  @Post('users')
  createUser(@Body() body: { name: string; email: string; password: string; phone?: string; roleId: string }) {
    return this.service.createUser(body);
  }

  @ApiOperation({ summary: 'Atualiza usuário' })
  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; phone?: string; roleId?: string; active?: boolean },
  ) {
    return this.service.updateUser(id, body);
  }

  @ApiOperation({ summary: 'Redefine senha do usuário' })
  @Patch('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.service.resetPassword(id, body.newPassword);
  }

  @ApiOperation({ summary: 'Remove usuário' })
  @Delete('users/:id')
  @HttpCode(200)
  removeUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.removeUser(id, user.id);
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Lista perfis/roles' })
  @Get('roles')
  listRoles() {
    return this.service.listRoles();
  }

  // ── Profile ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Lista logs de auditoria' })
  @Get('audit-logs')
  listAuditLogs(@Query('page') page?: string) {
    return this.service.listAuditLogs(page ? parseInt(page) : 1);
  }

  @ApiOperation({ summary: 'Atualiza perfil do usuário logado' })
  @Patch('profile')
  updateProfile(@CurrentUser() user: any, @Body() body: { name?: string; phone?: string }) {
    return this.service.updateProfile(user.id, body);
  }

  // ── BusinessInfo ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Busca dados do negócio' })
  @Get('business')
  getBusinessInfo() {
    return this.service.getBusinessInfo();
  }

  @ApiOperation({ summary: 'Atualiza dados do negócio' })
  @Patch('business')
  updateBusinessInfo(@Body() body: any) {
    return this.service.updateBusinessInfo(body);
  }
}
