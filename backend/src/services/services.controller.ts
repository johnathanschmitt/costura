import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('services')
export class ServicesController {
  constructor(private service: ServicesService) {}

  @ApiOperation({ summary: 'Listar serviços' })
  @Get()
  findAll(@Query('search') search?: string, @Query('active') active?: string) {
    return this.service.findAll(search, active);
  }

  @ApiOperation({ summary: 'Buscar serviço' })
  @Permissions('read:services')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar serviço' })
  @Permissions('create:services')
  @Post()
  create(@Body() data: any) {
    return this.service.create(data);
  }

  @ApiOperation({ summary: 'Editar serviço' })
  @Permissions('update:services')
  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @ApiOperation({ summary: 'Remover serviço' })
  @Permissions('delete:services')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
