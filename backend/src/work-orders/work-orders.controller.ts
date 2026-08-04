import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkOrdersService } from './work-orders.service';
import {
  AssignDto, BoardQueryDto, CancelWorkOrderDto, CreateUpdateDto, CreateWorkOrderDto, DeliverDto,
  ListWorkOrdersDto, SetEstimatedHoursDto, UpdateStatusDto, UpdateWorkOrderDto,
} from './dto/work-orders.dto';

@ApiTags('work-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:work-orders')
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private service: WorkOrdersService) {}

  @ApiOperation({ summary: 'Listar ordens de serviço' })
  @Get()
  findAll(@Query() query: ListWorkOrdersDto) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Quadro de produção agrupado por status' })
  @Get('board')
  getBoard(@Query() query: BoardQueryDto) {
    return this.service.getBoard(query);
  }

  @ApiOperation({ summary: 'Fila de produção por costureira, com carga estimada' })
  @Get('queues')
  getQueues() {
    return this.service.getQueues();
  }

  @ApiOperation({ summary: 'Buscar OS' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Dados do recibo de entrega' })
  @Get(':id/receipt')
  getReceipt(@Param('id') id: string) {
    return this.service.getReceipt(id);
  }

  @ApiOperation({ summary: 'Criar OS' })
  @Permissions('update:work-orders')
  @Post()
  create(@Body() dto: CreateWorkOrderDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Atualizar OS' })
  @Permissions('update:work-orders')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Mover a OS de status' })
  @Permissions('update:work-orders')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @ApiOperation({ summary: 'Atribuir costureira responsável' })
  @Permissions('update:work-orders')
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.service.assign(id, dto);
  }

  @ApiOperation({ summary: 'Registrar andamento da OS' })
  @Permissions('update:work-orders')
  @Post(':id/updates')
  addUpdate(@Param('id') id: string, @Body() dto: CreateUpdateDto, @CurrentUser() user: any) {
    return this.service.addUpdate(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Histórico de andamento da OS' })
  @Get(':id/updates')
  listUpdates(@Param('id') id: string) {
    return this.service.listUpdates(id);
  }

  @ApiOperation({ summary: 'Definir horas estimadas de produção' })
  @Permissions('update:work-orders')
  @Patch(':id/estimated-hours')
  setEstimatedHours(@Param('id') id: string, @Body() dto: SetEstimatedHoursDto) {
    return this.service.setEstimatedHours(id, dto);
  }

  @ApiOperation({ summary: 'Registrar entrega da peça' })
  @Permissions('update:work-orders')
  @Post(':id/deliver')
  deliver(@Param('id') id: string, @Body() dto: DeliverDto, @CurrentUser() user: any) {
    return this.service.deliver(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'O que o cancelamento vai mexer (cobranças e material)' })
  @Get(':id/cancel-preview')
  getCancelPreview(@Param('id') id: string) {
    return this.service.getCancelPreview(id);
  }

  @ApiOperation({ summary: 'Cancelar a OS porque a cliente desistiu' })
  @Permissions('update:work-orders')
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelWorkOrderDto, @CurrentUser() user: any) {
    return this.service.cancel(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Remover OS' })
  @Permissions('delete:work-orders')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
