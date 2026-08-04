import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { SchedulesService } from './schedules.service';
import {
  ConflictQueryDto, CreateScheduleDto, ListSchedulesDto, UpdateScheduleDto,
} from './dto/schedules.dto';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:schedule')
@Controller('schedules')
export class SchedulesController {
  constructor(private service: SchedulesService) {}

  @ApiOperation({ summary: 'Listar agendamentos, opcionalmente com prazos das OS' })
  @Get()
  findAll(@Query() query: ListSchedulesDto) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Compromissos que colidem com um horário' })
  @Get('conflicts')
  findConflicts(@Query() query: ConflictQueryDto) {
    return this.service.findConflicts(query);
  }

  @ApiOperation({ summary: 'Buscar agendamento' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar agendamento' })
  @Permissions('update:schedule')
  @Post()
  create(@Body() dto: CreateScheduleDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Atualizar agendamento' })
  @Permissions('update:schedule')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Remover agendamento' })
  @Permissions('delete:schedule')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
