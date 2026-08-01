import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBooleanString, IsDateString, IsEnum, IsInt, IsNumber,
  IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { MovementType } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class CreateEntryDto {
  @ApiProperty({ description: 'Produto que está entrando no estoque' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 12.5, description: 'Quantidade recebida, na unidade do produto' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade inválida' })
  @IsPositive({ message: 'Quantidade deve ser maior que zero' })
  quantity: number;

  @ApiPropertyOptional({ example: 18.9, description: 'Preço de custo por unidade' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço de custo inválido' })
  @Min(0, { message: 'Preço de custo não pode ser negativo' })
  unitCost?: number;

  @ApiPropertyOptional({ example: 'Tecidos Silva' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string;

  @ApiPropertyOptional({ example: 'NF-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Data da entrada. Padrão: agora.' })
  @IsOptional()
  @IsDateString({}, { message: 'Data inválida' })
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateExitDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade inválida' })
  @IsPositive({ message: 'Quantidade deve ser maior que zero' })
  quantity: number;

  @ApiProperty({ example: 'Consumo na OS-00007' })
  @IsString()
  @MaxLength(200)
  reason: string;

  @ApiPropertyOptional({ description: 'Ordem de serviço que consumiu o material' })
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ example: 47.5, description: 'Quantidade física contada. O sistema calcula a diferença.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade inválida' })
  @Min(0, { message: 'Quantidade contada não pode ser negativa' })
  countedQuantity: number;

  @ApiProperty({ example: 'Inventário de julho — sobra encontrada na prateleira B' })
  @IsString()
  @MaxLength(200)
  reason: string;
}

export class CountItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ example: 47.5, description: 'Quantidade contada fisicamente' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade contada inválida' })
  @Min(0, { message: 'Quantidade contada não pode ser negativa' })
  countedQuantity: number;
}

export class CloseCountDto {
  @ApiProperty({ type: [CountItemDto], description: 'Contagem física de cada produto' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe a contagem de ao menos um produto' })
  @ValidateNested({ each: true })
  @Type(() => CountItemDto)
  items: CountItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SetMinQuantityDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Quantidade mínima inválida' })
  @Min(0, { message: 'Quantidade mínima não pode ser negativa' })
  minQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  location?: string;
}

export class ListMovementsDto {
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
  productId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(MovementType, { message: 'Tipo de movimentação inválido' })
  type?: MovementType;

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

export class ListInventoryDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou SKU do produto' })
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Apenas itens no ou abaixo do mínimo' })
  @IsOptional()
  @EmptyToUndefined()
  @IsBooleanString()
  lowOnly?: string;
}
