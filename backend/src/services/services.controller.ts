import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:services')
@Controller('services')
export class ServicesController {
  constructor(private service: ServicesService) {}

  @ApiOperation({ summary: 'Listar serviços' })
  @Get()
  findAll(@Query('search') search?: string, @Query('active') active?: string) {
    return this.service.findAll(search, active);
  }

  @ApiOperation({ summary: 'Buscar serviço' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar serviço' })
  @Permissions('update:services')
  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Atualizar serviço' })
  @Permissions('update:services')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Remover serviço' })
  @Permissions('delete:services')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
