import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [FinancialController],
  providers: [FinancialService, AccountsService],
  exports: [FinancialService, AccountsService],
})
export class FinancialModule {}
