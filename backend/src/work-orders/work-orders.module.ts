import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
// O cancelamento pode devolver ao estoque o material já baixado para a OS.
import { InventoryModule } from '../inventory/inventory.module';
// A entrega dá baixa na conta a receber sem sair da tela da OS.
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [InventoryModule, FinancialModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
