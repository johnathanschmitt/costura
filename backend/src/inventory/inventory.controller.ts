import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';
import {
  AdjustStockDto, CloseCountDto, CreateEntryDto, CreateExitDto, ListInventoryDto,
  ListMovementsDto, SetMinQuantityDto,
} from './dto/inventory.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @ApiOperation({ summary: 'Listar estoque' })
  @Get()
  getAll(@Query() query: ListInventoryDto) {
    return this.service.getAll(query);
  }

  @ApiOperation({ summary: 'Itens no ou abaixo do estoque mínimo' })
  @Get('low-stock')
  getLowStock() {
    return this.service.getLowStock();
  }

  @ApiOperation({ summary: 'Histórico de movimentações' })
  @Get('movements')
  listMovements(@Query() query: ListMovementsDto) {
    return this.service.listMovements(query);
  }

  @ApiOperation({ summary: 'Registrar entrada de material comprado' })
  @Permissions('update:inventory')
  @Post('entries')
  registerEntry(@Body() dto: CreateEntryDto, @CurrentUser() user: any) {
    return this.service.registerEntry(dto, user?.id);
  }

  @ApiOperation({ summary: 'Registrar baixa de material' })
  @Permissions('update:inventory')
  @Post('exits')
  registerExit(@Body() dto: CreateExitDto, @CurrentUser() user: any) {
    return this.service.registerExit(dto, user?.id);
  }

  @ApiOperation({ summary: 'Ajustar saldo pela contagem física' })
  @Permissions('update:inventory')
  @Post('adjustments')
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
    return this.service.adjust(dto, user?.id);
  }

  @ApiOperation({ summary: 'Folha de contagem do inventário' })
  @Get('count-sheet')
  getCountSheet() {
    return this.service.getCountSheet();
  }

  @ApiOperation({ summary: 'Inventários realizados' })
  @Get('counts')
  listCounts() {
    return this.service.listCounts();
  }

  @ApiOperation({ summary: 'Relatório de divergências (último, se sem id)' })
  @Get('counts/report')
  getCountReport(@Query('id') id?: string) {
    return this.service.getCountReport(id);
  }

  @ApiOperation({ summary: 'Fechar inventário com a contagem física' })
  @Permissions('update:inventory')
  @Post('counts')
  closeCount(@Body() dto: CloseCountDto, @CurrentUser() user: any) {
    return this.service.closeCount(dto, user?.id);
  }

  @ApiOperation({ summary: 'Definir estoque mínimo e localização do produto' })
  @Permissions('update:inventory')
  @Patch(':productId/settings')
  setMinQuantity(@Param('productId') productId: string, @Body() dto: SetMinQuantityDto) {
    return this.service.setMinQuantity(productId, dto);
  }
}
