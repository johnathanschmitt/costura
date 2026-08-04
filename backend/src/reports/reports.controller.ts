import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:reports')
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  /**
   * A tela inicial e o sino são de todo mundo: sem permissão explícita aqui, a
   * costureira abriria o sistema numa página de erro.
   */
  @ApiOperation({ summary: 'Dashboard' })
  @Permissions()
  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

  @ApiOperation({ summary: 'OS por status' })
  @Get('work-orders-by-status')
  getWorkOrdersByStatus() {
    return this.service.getWorkOrdersByStatus();
  }

  @ApiOperation({ summary: 'Receita mensal por ano' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @Get('revenue-by-month')
  getRevenueByMonth(@Query('year') year?: string) {
    return this.service.getRevenueByMonth(year ? parseInt(year) : new Date().getFullYear());
  }

  @ApiOperation({ summary: 'Top clientes por receita' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('top-customers')
  getTopCustomers(@Query('limit') limit?: string) {
    return this.service.getTopCustomers(limit ? parseInt(limit) : 10);
  }

  @ApiOperation({ summary: 'Resumo de notificações/alertas' })
  @Permissions()
  @Get('notifications')
  getNotifications() {
    return this.service.getNotifications();
  }
}
