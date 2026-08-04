import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString,
  Max, MaxLength, Min,
} from 'class-validator';
import { PaymentMethod, Recurrence } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

/** Sangria e suprimento são transferências de dinheiro, não resultado. */
export enum CashTransferKind {
  WITHDRAWAL = 'WITHDRAWAL',
  SUPPLY = 'SUPPLY',
}

/**
 * Destinos padronizados da sangria (e origens do suprimento). Texto livre não
 * vira relatório: com a lista dá para responder "quanto foi para o banco no mês".
 */
export const CASH_COUNTERPARTS = [
  'Banco',
  'Cofre',
  'Fornecedor',
  'Retirada de sócia',
  'Outro',
] as const;

export class CashTransferDto {
  @ApiProperty({ enum: CashTransferKind, description: 'WITHDRAWAL = sangria, SUPPLY = suprimento' })
  @IsEnum(CashTransferKind, { message: 'Tipo de transferência inválido' })
  kind: CashTransferKind;

  @ApiProperty({ example: 200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({
    enum: CASH_COUNTERPARTS,
    example: 'Banco',
    description: 'Para onde o dinheiro foi (sangria) ou de onde veio (suprimento)',
  })
  @IsEnum(CASH_COUNTERPARTS as any, { message: 'Destino inválido' })
  counterpart: string;

  @ApiPropertyOptional({
    description:
      'Conta que recebe a sangria (ou de onde saiu o suprimento). Informando, o dinheiro ' +
      'aparece no saldo dela em vez de sumir da gaveta e não chegar em lugar nenhum.',
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  accountId?: string;

  @ApiProperty({ example: 'Depósito da semana', description: 'Motivo é obrigatório' })
  @IsString()
  @MaxLength(200)
  reason: string;
}

export class ReversePaymentDto {
  @ApiProperty({
    example: 'Valor digitado errado — recebido R$ 20, lançado R$ 200',
    description: 'Motivo do estorno. Obrigatório: é o que explica a diferença depois.',
  })
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class CreateInstallmentsDto {
  @ApiProperty({ example: 'Vestido de festa' })
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 1200, description: 'Valor total a parcelar' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ example: 3, description: 'Número de parcelas' })
  @Type(() => Number)
  @IsInt({ message: 'Número de parcelas inválido' })
  @Min(1, { message: 'Mínimo de 1 parcela' })
  @Max(36, { message: 'Máximo de 36 parcelas' })
  installments: number;

  @ApiProperty({ example: '2026-09-10T00:00:00.000Z', description: 'Vencimento da primeira parcela' })
  @IsDateString({}, { message: 'Data da primeira parcela inválida' })
  firstDueDate: string;

  @ApiPropertyOptional({ description: 'Sinal pago na hora, fora do parcelamento' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor do sinal inválido' })
  @Min(0)
  downPayment?: number;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Forma do sinal' })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida' })
  downPaymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiPropertyOptional({ example: 'Costura', description: 'Categoria de receita das parcelas' })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RecurrenceDto {
  @ApiPropertyOptional({ enum: Recurrence, default: 'NONE' })
  @IsOptional()
  @IsEnum(Recurrence, { message: 'Recorrência inválida' })
  recurrence?: Recurrence;
}

export class CashFlowChartQueryDto {
  @ApiProperty()
  @IsDateString({}, { message: 'Data inicial inválida' })
  startDate: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Data final inválida' })
  endDate: string;

  @ApiPropertyOptional({ enum: ['week', 'month'], default: 'month' })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(['week', 'month'] as any, { message: 'Agrupamento deve ser week ou month' })
  groupBy?: 'week' | 'month';

  @ApiPropertyOptional({ description: 'Filtra despesas por categoria' })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(60)
  category?: string;
}
