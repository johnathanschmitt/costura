import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class OpenCashRegisterDto {
  @ApiProperty({ description: 'Dinheiro em espécie na gaveta ao abrir o caixa', example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Saldo de abertura inválido' })
  @Min(0, { message: 'Saldo de abertura não pode ser negativo' })
  openingBalance: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CloseCashRegisterDto {
  @ApiProperty({
    description: 'Dinheiro efetivamente contado na gaveta. Comparado ao saldo esperado.',
    example: 430.5,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor contado inválido' })
  @Min(0, { message: 'Valor contado não pode ser negativo' })
  countedBalance: number;

  @ApiPropertyOptional({ description: 'Justificativa — obrigatória quando há divergência' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateCashTransactionDto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType, { message: 'Tipo deve ser INCOME ou EXPENSE' })
  type: TransactionType;

  @ApiProperty({ example: 'Sangria para depósito' })
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiPropertyOptional({ example: 'Material' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
