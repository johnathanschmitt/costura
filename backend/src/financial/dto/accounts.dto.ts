import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString,
  Max, MaxLength, Min,
} from 'class-validator';
import { PayableStatus, PaymentMethod, ReceivableStatus, Recurrence } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class CreateReceivableDto {
  @ApiProperty({ example: 'Vestido de festa — saldo' })
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 450 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePayableDto {
  @ApiProperty({ example: 'Aluguel de agosto' })
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 1200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string;

  @ApiPropertyOptional({ example: 'Aluguel' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional({
    enum: Recurrence,
    description: 'MONTHLY ou YEARLY geram as próximas ocorrências automaticamente',
  })
  @IsOptional()
  @IsEnum(Recurrence, { message: 'Recorrência inválida' })
  recurrence?: Recurrence;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PayDto {
  @ApiProperty({ description: 'Valor da baixa. Não pode exceder o saldo em aberto.', example: 200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida' })
  method: PaymentMethod;

  @ApiPropertyOptional({
    example: 250,
    description: 'Em dinheiro: quanto a cliente entregou. O troco é calculado a partir daqui.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor entregue inválido' })
  @IsPositive({ message: 'Valor entregue deve ser maior que zero' })
  amountTendered?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ListReceivablesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReceivableStatus })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(ReceivableStatus, { message: 'Status inválido' })
  status?: ReceivableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Vencimento a partir de' })
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Data inicial inválida' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Vencimento até' })
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Data final inválida' })
  endDate?: string;
}

export class ListPayablesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PayableStatus })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(PayableStatus, { message: 'Status inválido' })
  status?: PayableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional({ description: 'Vencimento a partir de' })
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Data inicial inválida' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Vencimento até' })
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Data final inválida' })
  endDate?: string;
}

export class CashFlowQueryDto {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'Data inicial inválida' })
  startDate: string;

  @ApiProperty({ example: '2026-08-31T23:59:59.999Z' })
  @IsDateString({}, { message: 'Data final inválida' })
  endDate: string;
}

export class ListCashRegistersDto extends PaginationQueryDto {}
