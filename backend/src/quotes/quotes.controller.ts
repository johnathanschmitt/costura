import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QuotesService } from './quotes.service';
import {
  ConvertDto, CreateQuoteDto, ListQuotesDto, ShareQuoteDto, UpdateQuoteDto,
} from './dto/quotes.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Atualizar orçamento' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Aprovar orçamento' })
  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @ApiOperation({ summary: 'Reabrir orçamento recusado ou expirado' })
  @Patch(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.service.reopen(id);
  }

  @ApiOperation({ summary: 'Duplicar orçamento' })
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.service.duplicate(id);
  }

  @ApiOperation({ summary: 'Aprovar e converter em OS, com sinal opcional' })
  @Post(':id/convert')
  convertToWorkOrder(@Param('id') id: string, @Body() dto: ConvertDto) {
    return this.service.convertToWorkOrder(id, dto);
  }

  @ApiOperation({ summary: 'Preparar envio à cliente (link wa.me pronto)' })
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
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
