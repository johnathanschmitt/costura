import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkOrdersService } from './work-orders.service';
import {
  AssignDto, BoardQueryDto, CreateUpdateDto, CreateWorkOrderDto, DeliverDto,
  ListWorkOrdersDto, SetEstimatedHoursDto, UpdateStatusDto, UpdateWorkOrderDto,
} from './dto/work-orders.dto';

@ApiTags('work-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @Post()
  create(@Body() dto: CreateWorkOrderDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Atualizar OS' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Mover a OS de status' })
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @ApiOperation({ summary: 'Atribuir costureira responsável' })
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.service.assign(id, dto);
  }

  @ApiOperation({ summary: 'Registrar andamento da OS' })
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
  @Patch(':id/estimated-hours')
  setEstimatedHours(@Param('id') id: string, @Body() dto: SetEstimatedHoursDto) {
    return this.service.setEstimatedHours(id, dto);
  }

  @ApiOperation({ summary: 'Registrar entrega da peça' })
  @Post(':id/deliver')
  deliver(@Param('id') id: string, @Body() dto: DeliverDto, @CurrentUser() user: any) {
    return this.service.deliver(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Remover OS' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
