import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private service: CustomersService) {}

  @ApiOperation({ summary: 'Listar clientes' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  findAll(@Query('search') search?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.service.findAll(search, page, limit);
  }

  @ApiOperation({ summary: 'Buscar cliente por ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar cliente' })
  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Atualizar cliente' })
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Remover cliente' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @ApiOperation({ summary: 'Medidas do cliente' })
  @Get(':id/measurements')
  getMeasurements(@Param('id') id: string) {
    return this.service.getMeasurements(id);
  }

  @ApiOperation({ summary: 'Salvar medidas do cliente' })
  @Post(':id/measurements')
  saveMeasurement(@Param('id') id: string, @Body() body: any) {
    return this.service.saveMeasurement(id, body);
  }
}
