import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private service: QuotesService) {}

  @ApiOperation({ summary: 'Listar orçamentos' })
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll(search, status, page ? parseInt(page) : 1, 20, startDate, endDate);
  }

  @ApiOperation({ summary: 'Buscar orçamento' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar orçamento' })
  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Atualizar orçamento' })
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Aprovar orçamento' })
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @ApiOperation({ summary: 'Converter orçamento em OS' })
  @Post(':id/convert')
  convertToWorkOrder(@Param('id') id: string) {
    return this.service.convertToWorkOrder(id);
  }

  @ApiOperation({ summary: 'Remover orçamento' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
