import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkOrdersService } from './work-orders.service';

@ApiTags('work-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private service: WorkOrdersService) {}

  @ApiOperation({ summary: 'Listar ordens de serviço' })
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dueStart') dueStart?: string,
    @Query('dueEnd') dueEnd?: string,
  ) {
    return this.service.findAll(search, status, page ? parseInt(page) : 1, 20, startDate, endDate, dueStart, dueEnd);
  }

  @ApiOperation({ summary: 'Buscar OS' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar OS' })
  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Atualizar OS' })
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Atualizar status da OS' })
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.service.updateStatus(id, status);
  }

  @ApiOperation({ summary: 'Remover OS' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
