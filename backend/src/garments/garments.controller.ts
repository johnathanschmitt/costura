import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GarmentsService } from './garments.service';

@ApiTags('garments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('garments')
export class GarmentsController {
  constructor(private service: GarmentsService) {}

  @ApiOperation({ summary: 'Listar peças/modelos' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'active', required: false })
  @ApiQuery({ name: 'page', required: false })
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
  ) {
    return this.service.findAll(search, category, active, page ? parseInt(page) : 1);
  }

  @ApiOperation({ summary: 'Listar categorias existentes' })
  @Get('categories')
  listCategories() {
    return this.service.listCategories();
  }

  @ApiOperation({ summary: 'Buscar peça' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar peça' })
  @Post()
  create(@Body() body: { name: string; category?: string; description?: string; imageUrl?: string }) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Atualizar peça' })
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; category?: string; description?: string; imageUrl?: string; active?: boolean },
  ) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Remover peça' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
