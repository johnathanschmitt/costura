import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min,
} from 'class-validator';
import { AccountKind } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Banco Inter' })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiProperty({ enum: AccountKind, example: 'BANK' })
  @IsEnum(AccountKind, { message: 'Tipo de conta inválido' })
  kind: AccountKind;

  @ApiPropertyOptional({ description: 'Saldo que já existe nesta conta hoje' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Saldo inicial inválido' })
  @Min(0)
  openingBalance?: number;

  @ApiPropertyOptional({ description: 'Conta sugerida para Pix, cartão e transferência' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Saldo inicial inválido' })
  @Min(0)
  openingBalance?: number;
}

export class TransferBetweenAccountsDto {
  @ApiProperty()
  @IsString()
  fromAccountId: string;

  @ApiProperty()
  @IsString()
  toAccountId: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor inválido' })
  @IsPositive({ message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ example: 'Aporte para a reserva' })
  @IsString()
  @MaxLength(200)
  reason: string;
}

export class AccountStatementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  endDate?: string;
}
