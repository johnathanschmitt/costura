import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString,
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

  @ApiPropertyOptional({
    example: 'Costura',
    description: 'Categoria de receita — é ela que faz o DRE dizer de onde veio o dinheiro',
  })
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

/**
 * Edição de conta ainda em aberto. Antes só dava para cancelar e recriar: um
 * vencimento digitado errado virava uma conta cancelada no histórico.
 */
export class UpdateReceivableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: 'Não pode ficar abaixo do que já foi recebido' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdatePayableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: 'Não pode ficar abaixo do que já foi pago' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  supplier?: string;

  @ApiPropertyOptional()
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
    description: 'Em qual conta o dinheiro entrou. Em espécie é sempre a gaveta.',
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  accountId?: string;

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

/**
 * Vencido de mês anterior continua aparecendo no mês escolhido.
 *
 * Filtrar só pelo mês faria a conta atrasada sumir da tela justamente quando ela
 * mais precisa ser vista — quem cobra abre o mês corrente, não vai atrás dos
 * meses passados um por um.
 */
class MonthlyListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Traz também as contas vencidas de meses anteriores',
  })
  @IsOptional()
  @EmptyToUndefined()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  includeOverdue?: boolean = true;
}

export class ListReceivablesDto extends MonthlyListQueryDto {
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

export class ListPayablesDto extends MonthlyListQueryDto {
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

  @ApiPropertyOptional({ default: 1, description: 'Página do extrato' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Busca na descrição, no cliente ou no fornecedor' })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class ListCashRegistersDto extends PaginationQueryDto {}
