import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FinancialService } from './financial.service';
import { AccountsService } from './accounts.service';
import {
  AccountStatementQueryDto, CreateAccountDto, TransferBetweenAccountsDto, UpdateAccountDto,
} from './dto/accounts-crud.dto';
import {
  CloseCashRegisterDto, CreateCashTransactionDto, OpenCashRegisterDto,
} from './dto/cash-register.dto';
import {
  CashFlowQueryDto, CreatePayableDto, CreateReceivableDto, ListCashRegistersDto,
  ListPayablesDto, ListReceivablesDto, PayDto, UpdatePayableDto, UpdateReceivableDto,
} from './dto/accounts.dto';
import {
  CashFlowChartQueryDto, CashTransferDto, CreateInstallmentsDto, ReversePaymentDto,
} from './dto/phase2.dto';
import {
  CreateCategoryDto, DreQueryDto, ListCategoriesDto, UpdateCategoryDto,
} from './dto/categories.dto';
import { MonthlyResultQueryDto } from './dto/monthly.dto';
import {
  CloseDistributionDto, DistributionQueryDto, SaveDistributionRuleDto,
} from './dto/distribution.dto';

/**
 * Todo o módulo exige permissão de leitura do financeiro, e o que mexe em
 * dinheiro exige a de escrita.
 *
 * Antes bastava estar logado: qualquer usuária — inclusive uma costureira —
 * podia fazer sangria, dar baixa e ver quanto cada sócia recebeu.
 */
@ApiTags('financial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('read:financial')
@Controller('financial')
export class FinancialController {
  constructor(private service: FinancialService, private accounts: AccountsService) {}

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
  @Permissions('update:financial')
  @Post('cash-register/open')
  open(@Body() dto: OpenCashRegisterDto, @CurrentUser() user: any) {
    return this.service.openCashRegister(dto, user?.id);
  }

  @ApiOperation({ summary: 'Fechar caixa conferindo o dinheiro contado' })
  @Permissions('update:financial')
  @Patch('cash-register/:id/close')
  close(@Param('id') id: string, @Body() dto: CloseCashRegisterDto, @CurrentUser() user: any) {
    return this.service.closeCashRegister(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Lançar entrada ou saída de dinheiro no caixa' })
  @Permissions('update:financial')
  @Post('cash-register/:id/transaction')
  addTransaction(
    @Param('id') id: string,
    @Body() dto: CreateCashTransactionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addTransaction(id, dto, user?.id);
  }

  @ApiOperation({ summary: 'Sangria ou suprimento — transferência de dinheiro' })
  @Permissions('update:financial')
  @Post('cash-register/:id/transfer')
  transfer(@Param('id') id: string, @Body() dto: CashTransferDto, @CurrentUser() user: any) {
    return this.service.transfer(id, dto, user?.id);
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
  @Permissions('update:financial')
  @Post('receivables')
  createReceivable(@Body() dto: CreateReceivableDto) {
    return this.service.createReceivable(dto);
  }

  @ApiOperation({ summary: 'Criar venda parcelada, com sinal opcional' })
  @Permissions('update:financial')
  @Post('receivables/installments')
  createInstallments(@Body() dto: CreateInstallmentsDto) {
    return this.service.createInstallments(dto);
  }

  @ApiOperation({ summary: 'Dar baixa em conta a receber' })
  @Permissions('update:financial')
  @Patch('receivables/:id/pay')
  payReceivable(@Param('id') id: string, @Body() dto: PayDto) {
    return this.service.payReceivable(id, dto);
  }

  @ApiOperation({ summary: 'Editar conta a receber ainda em aberto' })
  @Permissions('update:financial')
  @Patch('receivables/:id')
  updateReceivable(@Param('id') id: string, @Body() dto: UpdateReceivableDto) {
    return this.service.updateReceivable(id, dto);
  }

  @ApiOperation({ summary: 'Cancelar conta a receber' })
  @Permissions('update:financial')
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
  @Permissions('update:financial')
  @Post('payables')
  createPayable(@Body() dto: CreatePayableDto) {
    return this.service.createPayable(dto);
  }

  @ApiOperation({ summary: 'Dar baixa em conta a pagar' })
  @Permissions('update:financial')
  @Patch('payables/:id/pay')
  payPayable(@Param('id') id: string, @Body() dto: PayDto) {
    return this.service.payPayable(id, dto);
  }

  @ApiOperation({ summary: 'Editar conta a pagar ainda em aberto' })
  @Permissions('update:financial')
  @Patch('payables/:id')
  updatePayable(@Param('id') id: string, @Body() dto: UpdatePayableDto) {
    return this.service.updatePayable(id, dto);
  }

  @ApiOperation({ summary: 'Cancelar conta a pagar' })
  @Permissions('update:financial')
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
    const flow = await this.service.getCashFlow(query, false);
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

  @ApiOperation({ summary: 'Estornar uma baixa lançada errado' })
  @Permissions('update:financial')
  @Post('payments/:id/reverse')
  reversePayment(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.reversePayment(id, dto.reason, user?.id);
  }

  @ApiOperation({ summary: 'Comprovante de pagamento' })
  @Get('payments/:id/receipt')
  getPaymentReceipt(@Param('id') id: string) {
    return this.service.getPaymentReceipt(id);
  }

  // ── Contas e saldos ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Contas com saldo: gaveta, banco, carteira, reserva' })
  @Get('accounts')
  listAccounts() {
    return this.accounts.listWithBalances();
  }

  @ApiOperation({ summary: 'Cadastrar conta' })
  @Permissions('update:financial')
  @Post('accounts')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @ApiOperation({ summary: 'Editar conta' })
  @Permissions('update:financial')
  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(id, dto);
  }

  @ApiOperation({ summary: 'Remover conta sem movimentação' })
  @Permissions('update:financial')
  @Delete('accounts/:id')
  removeAccount(@Param('id') id: string) {
    return this.accounts.remove(id);
  }

  @ApiOperation({ summary: 'Extrato da conta' })
  @Get('accounts/:id/statement')
  accountStatement(@Param('id') id: string, @Query() query: AccountStatementQueryDto) {
    return this.accounts.statement(id, query.startDate, query.endDate);
  }

  @ApiOperation({ summary: 'Marcar lançamento como conferido no extrato do banco' })
  @Permissions('update:financial')
  @Patch('accounts/reconcile/:kind/:id')
  toggleReconciled(
    @Param('kind') kind: 'PAYMENT' | 'TRANSFER',
    @Param('id') id: string,
    @Body() body: { reconciled?: boolean },
  ) {
    return this.accounts.toggleReconciled(kind, id, body?.reconciled !== false);
  }

  @ApiOperation({ summary: 'Conferir a conta até uma data' })
  @Permissions('update:financial')
  @Post('accounts/:id/reconcile')
  reconcileUntil(@Param('id') id: string, @Body() body: { until: string }) {
    return this.accounts.reconcileUntil(id, body.until);
  }

  @ApiOperation({ summary: 'Transferir dinheiro entre contas' })
  @Permissions('update:financial')
  @Post('accounts/transfer')
  transferBetweenAccounts(@Body() dto: TransferBetweenAccountsDto, @CurrentUser() user: any) {
    return this.accounts.transfer(dto, user?.id);
  }

  @ApiOperation({ summary: 'Painel: dinheiro hoje, mês, projeção, saúde e atrasados' })
  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }

  @ApiOperation({ summary: 'Parâmetros do financeiro: custo fixo e meta por hora' })
  @Get('settings')
  getSettings() {
    return this.service.getSettings();
  }

  @ApiOperation({ summary: 'Categorias de receita e despesa' })
  @Get('categories')
  listCategories(@Query() query: ListCategoriesDto) {
    return this.service.listCategories(query);
  }

  @ApiOperation({ summary: 'Criar categoria' })
  @Permissions('update:financial')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @ApiOperation({ summary: 'Renomear ou ativar/desativar categoria' })
  @Permissions('update:financial')
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @ApiOperation({ summary: 'Remover categoria' })
  @Permissions('update:financial')
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
  @Permissions('update:financial')
  @Post('distribution/close')
  closeDistribution(@Body() dto: CloseDistributionDto) {
    return this.service.closeDistribution(dto);
  }

  @ApiOperation({ summary: 'Regra de divisão: percentual de cada sócia e do ateliê' })
  @Permissions('update:financial')
  @Put('distribution/rule')
  saveDistributionRule(@Body() dto: SaveDistributionRuleDto) {
    return this.service.saveDistributionRule(dto);
  }

  @ApiOperation({ summary: 'Registrar a retirada da sócia' })
  @Permissions('update:financial')
  @Patch('distribution/payouts/:id/pay')
  payPartner(@Param('id') id: string, @Body() body: { accountId?: string }) {
    return this.service.payPartner(id, body?.accountId);
  }

  @ApiOperation({ summary: 'Cobrir o prejuízo do mês com a reserva do ateliê' })
  @Permissions('update:financial')
  @Post('distribution/:month/settle-loss')
  settleLoss(@Param('month') month: string) {
    return this.service.settleLoss(month);
  }

  @ApiOperation({ summary: 'Reabrir a divisão de um mês' })
  @Permissions('update:financial')
  @Delete('distribution/:month')
  reopenDistribution(@Param('month') month: string) {
    return this.service.reopenDistribution(month);
  }

  @ApiOperation({ summary: 'Retorno por tipo de peça e por serviço (valor por hora)' })
  @Get('returns')
  getReturnAnalysis(@Query() query: DreQueryDto) {
    return this.service.getReturnAnalysis(query);
  }

  @ApiOperation({ summary: 'DRE — resultado por categoria no período' })
  @Get('dre')
  getDre(@Query() query: DreQueryDto) {
    return this.service.getDre(query);
  }

  @ApiOperation({ summary: 'Gerar as próximas ocorrências das despesas recorrentes' })
  @Permissions('update:financial')
  @Post('payables/generate-recurrences')
  generateRecurrences() {
    return this.service.generateRecurrences();
  }
}
