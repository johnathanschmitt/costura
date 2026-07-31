import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FinancialService } from './financial.service';

@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financial')
export class FinancialController {
  constructor(private service: FinancialService) {}

  @ApiOperation({ summary: 'Histórico de caixas' })
  @Get('cash-register')
  getCashRegisters(@Query('page') page?: number) {
    return this.service.getCashRegisters(page);
  }

  @ApiOperation({ summary: 'Caixa atual' })
  @Get('cash-register/current')
  getCurrent() {
    return this.service.getCurrentCashRegister();
  }

  @ApiOperation({ summary: 'Abrir caixa' })
  @Post('cash-register/open')
  open(@Body() body: { openingBalance: number; notes?: string }) {
    return this.service.openCashRegister(body.openingBalance, body.notes);
  }

  @ApiOperation({ summary: 'Fechar caixa' })
  @Patch('cash-register/:id/close')
  close(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.service.closeCashRegister(id, body.notes);
  }

  @ApiOperation({ summary: 'Lançar transação' })
  @Post('cash-register/:id/transaction')
  addTransaction(@Param('id') id: string, @Body() body: any) {
    return this.service.addTransaction(id, body);
  }

  @ApiOperation({ summary: 'Transações do caixa' })
  @Get('cash-register/:id/transactions')
  getTransactions(@Param('id') id: string) {
    return this.service.getTransactions(id);
  }

  @ApiOperation({ summary: 'Contas a receber' })
  @Get('receivables')
  getReceivables(@Query('status') status?: string, @Query('page') page?: number) {
    return this.service.getReceivables(status, page);
  }

  @ApiOperation({ summary: 'Criar conta a receber' })
  @Post('receivables')
  createReceivable(@Body() body: any) {
    return this.service.createReceivable(body);
  }

  @ApiOperation({ summary: 'Receber conta' })
  @Patch('receivables/:id/pay')
  payReceivable(@Param('id') id: string, @Body() body: { amount: number; method: string }) {
    return this.service.payReceivable(id, body.amount, body.method);
  }

  @ApiOperation({ summary: 'Cancelar conta a receber' })
  @Delete('receivables/:id')
  cancelReceivable(@Param('id') id: string) {
    return this.service.cancelReceivable(id);
  }

  @ApiOperation({ summary: 'Contas a pagar' })
  @Get('payables')
  getPayables(@Query('status') status?: string, @Query('page') page?: number) {
    return this.service.getPayables(status, page);
  }

  @ApiOperation({ summary: 'Criar conta a pagar' })
  @Post('payables')
  createPayable(@Body() body: any) {
    return this.service.createPayable(body);
  }

  @ApiOperation({ summary: 'Pagar conta' })
  @Patch('payables/:id/pay')
  payPayable(@Param('id') id: string, @Body() body: { amount: number; method: string }) {
    return this.service.payPayable(id, body.amount, body.method);
  }

  @ApiOperation({ summary: 'Cancelar conta a pagar' })
  @Delete('payables/:id')
  cancelPayable(@Param('id') id: string) {
    return this.service.cancelPayable(id);
  }

  @ApiOperation({ summary: 'Fluxo de caixa' })
  @Get('cash-flow')
  getCashFlow(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getCashFlow(new Date(startDate), new Date(endDate));
  }
}
