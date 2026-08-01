import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { PublicQuotesController } from './public-quotes.controller';
import { QuotesService } from './quotes.service';
import { FinancialModule } from '../financial/financial.module';

@Module({
  // A baixa do sinal na conversão reusa o financeiro, para gerar o registro de
  // pagamento e o lançamento no caixa pelas mesmas regras.
  imports: [FinancialModule],
  controllers: [QuotesController, PublicQuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
