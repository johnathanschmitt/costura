import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { QuotesService } from './quotes.service';
import {
  ConvertDto, CreateQuoteDto, ListQuotesDto, ShareQuoteDto, UpdateQuoteDto,
} from './dto/quotes.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private service: QuotesService) {}

  @ApiOperation({ summary: 'Listar orçamentos' })
  @Get()
  findAll(@Query() query: ListQuotesDto) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Buscar orçamento' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Criar orçamento' })
  @Permissions('update:quotes')
  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Atualizar orçamento' })
  @Permissions('update:quotes')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Aprovar orçamento' })
  @Permissions('update:quotes')
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @ApiOperation({ summary: 'Recusar orçamento' })
  @Permissions('update:quotes')
  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }

  @ApiOperation({ summary: 'Reabrir orçamento recusado ou expirado' })
  @Permissions('update:quotes')
  @Patch(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.service.reopen(id);
  }

  @ApiOperation({ summary: 'Duplicar orçamento' })
  @Permissions('update:quotes')
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.service.duplicate(id);
  }

  @ApiOperation({ summary: 'Aprovar e converter em OS, com sinal opcional' })
  @Permissions('update:quotes')
  @Post(':id/convert')
  convertToWorkOrder(@Param('id') id: string, @Body() dto: ConvertDto) {
    return this.service.convertToWorkOrder(id, dto);
  }

  @ApiOperation({ summary: 'Preparar envio à cliente (link wa.me pronto)' })
  @Permissions('update:quotes')
  @Post(':id/share')
  share(@Param('id') id: string, @Body() dto: ShareQuoteDto, @CurrentUser() user: any) {
    return this.service.share(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Histórico de envios do orçamento' })
  @Get(':id/sends')
  listSends(@Param('id') id: string) {
    return this.service.listSends(id);
  }

  @ApiOperation({ summary: 'Remover orçamento' })
  @Permissions('delete:quotes')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
