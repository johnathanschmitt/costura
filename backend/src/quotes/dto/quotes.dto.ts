import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive,
  IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { ItemType, PaymentMethod, QuoteStatus, SendChannel } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class QuoteItemDto {
  @ApiProperty({ enum: ItemType })
  @IsEnum(ItemType, { message: 'Tipo de item inválido' })
  type: ItemType;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  description: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade inválida' })
  @IsPositive({ message: 'Quantidade deve ser maior que zero' })
  quantity: number;

  @ApiProperty({ example: 250 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço unitário inválido' })
  @Min(0, { message: 'Preço unitário não pode ser negativo' })
  unitPrice: number;

  @ApiPropertyOptional({ example: 20, description: 'Desconto em reais nesta linha' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Desconto do item inválido' })
  @Min(0, { message: 'Desconto não pode ser negativo' })
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;
}

export class CreateQuoteDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus, { message: 'Status inválido' })
  status?: QuoteStatus;

  @ApiPropertyOptional({ description: 'Validade da proposta' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de validade inválida' })
  validUntil?: string;

  @ApiPropertyOptional({ description: 'Prazo de entrega estimado' })
  @IsOptional()
  @IsDateString({}, { message: 'Prazo de entrega inválido' })
  deliveryDate?: string;

  @ApiPropertyOptional({ description: 'Desconto geral em reais sobre o subtotal' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Desconto inválido' })
  @Min(0, { message: 'Desconto não pode ser negativo' })
  discount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ type: [QuoteItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];
}

export class UpdateQuoteDto extends CreateQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare customerId: string;
}

export class DownPaymentDto {
  @ApiProperty({ example: 300, description: 'Valor do sinal recebido agora' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor do sinal inválido' })
  @IsPositive({ message: 'O sinal deve ser maior que zero' })
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida' })
  method: PaymentMethod;
}

export class ConvertDto {
  @ApiPropertyOptional({ type: DownPaymentDto, description: 'Sinal recebido na aprovação' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DownPaymentDto)
  downPayment?: DownPaymentDto;

  @ApiPropertyOptional({ description: 'Dias até o vencimento do saldo. Padrão: 30.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  balanceDueInDays?: number;
}

export class ListQuotesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(QuoteStatus, { message: 'Status inválido' })
  status?: QuoteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Data inicial inválida' })
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Data final inválida' })
  endDate?: string;
}

export class ShareQuoteDto {
  @ApiProperty({ enum: SendChannel, description: 'WHATSAPP, EMAIL ou LINK' })
  @IsEnum(SendChannel, { message: 'Canal de envio inválido' })
  channel: SendChannel;

  @ApiPropertyOptional({
    description: 'Número alternativo. Sem isto, usa o telefone cadastrado da cliente.',
  })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
