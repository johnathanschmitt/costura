import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FinancialService } from './financial.service';
import {
  CloseCashRegisterDto, CreateCashTransactionDto, OpenCashRegisterDto,
} from './dto/cash-register.dto';
import {
  CashFlowQueryDto, CreatePayableDto, CreateReceivableDto, ListCashRegistersDto,
  ListPayablesDto, ListReceivablesDto, PayDto,
} from './dto/accounts.dto';
import {
  CashFlowChartQueryDto, CashTransferDto, CreateInstallmentsDto,
} from './dto/phase2.dto';
import {
  CreateCategoryDto, DreQueryDto, ListCategoriesDto, UpdateCategoryDto,
} from './dto/categories.dto';
import { MonthlyResultQueryDto } from './dto/monthly.dto';
import { CloseDistributionDto, DistributionQueryDto } from './dto/distribution.dto';

@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financial')
export class FinancialController {
  constructor(private service: FinancialService) {}

  @ApiOperation({ summary: 'Resumo financeiro (vencidos e situação do caixa)' })
  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }

  @ApiOperation({ summary: 'Histórico de caixas' })
  @Get('cash-register')
  getCashRegisters(@Query() query: ListCashRegistersDto) {
    return this.service.getCashRegisters(query);
  }

  @ApiOperation({ summary: 'Caixa atual com saldo esperado' })
  @Get('cash-register/current')
  getCurrent() {
    return this.service.getCurrentCashRegister();
  }

  @ApiOperation({ summary: 'Abrir caixa com o dinheiro em espécie inicial' })
  @Post('cash-register/open')
  open(@Body() dto: OpenCashRegisterDto) {
    return this.service.openCashRegister(dto);
  }

  @ApiOperation({ summary: 'Fechar caixa conferindo o dinheiro contado' })
  @Patch('cash-register/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseCashRegisterDto) {
    return this.service.closeCashRegister(id, dto);
  }

  @ApiOperation({ summary: 'Lançar entrada ou saída de dinheiro no caixa' })
  @Post('cash-register/:id/transaction')
  addTransaction(@Param('id') id: string, @Body() dto: CreateCashTransactionDto) {
    return this.service.addTransaction(id, dto);
  }

  @ApiOperation({ summary: 'Sangria ou suprimento — transferência de dinheiro' })
  @Post('cash-register/:id/transfer')
  transfer(@Param('id') id: string, @Body() dto: CashTransferDto) {
    return this.service.transfer(id, dto);
  }

  @ApiOperation({ summary: 'Relatório de fechamento do caixa' })
  @Get('cash-register/:id/closing-report')
  getClosingReport(@Param('id') id: string) {
    return this.service.getClosingReport(id);
  }

  @ApiOperation({ summary: 'Transações do caixa' })
  @Get('cash-register/:id/transactions')
  getTransactions(@Param('id') id: string) {
    return this.service.getTransactions(id);
  }

  @ApiOperation({ summary: 'Contas a receber' })
  @Get('receivables')
  getReceivables(@Query() query: ListReceivablesDto) {
    return this.service.getReceivables(query);
  }

  @ApiOperation({ summary: 'Criar conta a receber' })
  @Post('receivables')
  createReceivable(@Body() dto: CreateReceivableDto) {
    return this.service.createReceivable(dto);
  }

  @ApiOperation({ summary: 'Criar venda parcelada, com sinal opcional' })
  @Post('receivables/installments')
  createInstallments(@Body() dto: CreateInstallmentsDto) {
    return this.service.createInstallments(dto);
  }

  @ApiOperation({ summary: 'Dar baixa em conta a receber' })
  @Patch('receivables/:id/pay')
  payReceivable(@Param('id') id: string, @Body() dto: PayDto) {
    return this.service.payReceivable(id, dto);
  }

  @ApiOperation({ summary: 'Cancelar conta a receber' })
  @Delete('receivables/:id')
  cancelReceivable(@Param('id') id: string) {
    return this.service.cancelReceivable(id);
  }

  @ApiOperation({ summary: 'Contas a pagar' })
  @Get('payables')
  getPayables(@Query() query: ListPayablesDto) {
    return this.service.getPayables(query);
  }

  @ApiOperation({ summary: 'Criar conta a pagar' })
  @Post('payables')
  createPayable(@Body() dto: CreatePayableDto) {
    return this.service.createPayable(dto);
  }

  @ApiOperation({ summary: 'Dar baixa em conta a pagar' })
  @Patch('payables/:id/pay')
  payPayable(@Param('id') id: string, @Body() dto: PayDto) {
    return this.service.payPayable(id, dto);
  }

  @ApiOperation({ summary: 'Cancelar conta a pagar' })
  @Delete('payables/:id')
  cancelPayable(@Param('id') id: string) {
    return this.service.cancelPayable(id);
  }

  @ApiOperation({ summary: 'Fluxo de caixa realizado no período' })
  @Get('cash-flow')
  getCashFlow(@Query() query: CashFlowQueryDto) {
    return this.service.getCashFlow(query);
  }

  @ApiOperation({ summary: 'Série do fluxo de caixa com projeção' })
  @Get('cash-flow/chart')
  getCashFlowChart(@Query() query: CashFlowChartQueryDto) {
    return this.service.getCashFlowChart(query);
  }

  @ApiOperation({ summary: 'Exportar o fluxo de caixa em CSV (abre no Excel)' })
  @Get('cash-flow/export')
  async exportCashFlow(@Query() query: CashFlowQueryDto, @Res() res: Response) {
    const flow = await this.service.getCashFlow(query);
    const rows = [
      ['Data', 'Descrição', 'Cliente/Fornecedor', 'Categoria', 'Forma', 'Tipo', 'Valor'],
      ...flow.entries.map(e => [
        new Date(e.date).toLocaleDateString('pt-BR'),
        e.description,
        e.party ?? '',
        e.category ?? '',
        e.method,
        e.type === 'INCOME' ? 'Entrada' : 'Saída',
        // Vírgula decimal para o Excel em português reconhecer como número.
        Number(e.amount).toFixed(2).replace('.', ','),
      ]),
    ];

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    // BOM: sem ele o Excel abre o arquivo como ASCII e quebra os acentos.
    const csv = '﻿' + rows.map(r => r.map(escape).join(';')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fluxo-de-caixa.csv"');
    res.send(csv);
  }

  @ApiOperation({ summary: 'Comprovante de pagamento' })
  @Get('payments/:id/receipt')
  getPaymentReceipt(@Param('id') id: string) {
    return this.service.getPaymentReceipt(id);
  }

  @ApiOperation({ summary: 'Categorias de receita e despesa' })
  @Get('categories')
  listCategories(@Query() query: ListCategoriesDto) {
    return this.service.listCategories(query);
  }

  @ApiOperation({ summary: 'Criar categoria' })
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @ApiOperation({ summary: 'Renomear ou ativar/desativar categoria' })
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @ApiOperation({ summary: 'Remover categoria' })
  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.service.removeCategory(id);
  }

  @ApiOperation({ summary: 'Resultado do mês: comparação, rateio, indicadores e histórico' })
  @Get('monthly-result')
  getMonthlyResult(@Query() query: MonthlyResultQueryDto) {
    return this.service.getMonthlyResult(query);
  }

  @ApiOperation({ summary: 'Divisão do resultado entre as sócias e o ateliê' })
  @Get('distribution')
  getDistribution(@Query() query: DistributionQueryDto) {
    return this.service.getDistribution(query);
  }

  @ApiOperation({ summary: 'Divisões já fechadas' })
  @Get('distribution/history')
  listDistributions() {
    return this.service.listDistributions();
  }

  @ApiOperation({ summary: 'Fechar a divisão do mês' })
  @Post('distribution/close')
  closeDistribution(@Body() dto: CloseDistributionDto) {
    return this.service.closeDistribution(dto);
  }

  @ApiOperation({ summary: 'Reabrir a divisão de um mês' })
  @Delete('distribution/:month')
  reopenDistribution(@Param('month') month: string) {
    return this.service.reopenDistribution(month);
  }

  @ApiOperation({ summary: 'DRE — resultado por categoria no período' })
  @Get('dre')
  getDre(@Query() query: DreQueryDto) {
    return this.service.getDre(query);
  }

  @ApiOperation({ summary: 'Gerar as próximas ocorrências das despesas recorrentes' })
  @Post('payables/generate-recurrences')
  generateRecurrences() {
    return this.service.generateRecurrences();
  }
}
