import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @ApiOperation({ summary: 'Listar estoque' })
  @Get()
  getAll() {
    return this.service.getAll();
  }

  @ApiOperation({ summary: 'Itens com estoque baixo' })
  @Get('low-stock')
  getLowStock() {
    return this.service.getLowStock();
  }

  @ApiOperation({ summary: 'Ajustar estoque' })
  @Post(':productId/adjust')
  adjust(@Param('productId') productId: string, @Body() body: { quantity: number; location?: string }) {
    return this.service.adjust(productId, body.quantity, body.location);
  }
}
