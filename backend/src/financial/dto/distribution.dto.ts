import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class DistributionQueryDto {
  @ApiPropertyOptional({ example: '2026-08', description: 'Mês AAAA-MM. Padrão: mês atual.' })
  @IsOptional()
  @EmptyToUndefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mês deve estar no formato AAAA-MM' })
  month?: string;
}

export class DistributionShareRuleDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ example: 30, description: 'Percentual do resultado que cabe a esta sócia' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Percentual inválido' })
  @Min(0, { message: 'Percentual não pode ser negativo' })
  @Max(100, { message: 'Percentual não pode passar de 100' })
  percent: number;
}

/** Regra de divisão. A soma das sócias mais o ateliê tem que fechar 100%. */
export class SaveDistributionRuleDto {
  @ApiProperty({ example: 20, description: 'Percentual que fica na reserva do ateliê' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Percentual do ateliê inválido' })
  @Min(0)
  @Max(100)
  atelierPercent: number;

  @ApiProperty({ type: [DistributionShareRuleDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe o percentual de pelo menos uma sócia' })
  @ValidateNested({ each: true })
  @Type(() => DistributionShareRuleDto)
  shares: DistributionShareRuleDto[];

  @ApiPropertyOptional({
    example: '2026-09',
    description:
      'Informando o mês, a regra vale só para ele — para o caso pontual, como uma sócia ' +
      'afastada, sem mexer na regra dos outros meses.',
  })
  @IsOptional()
  @EmptyToUndefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mês deve estar no formato AAAA-MM' })
  month?: string;
}

export class CloseDistributionDto {
  @ApiProperty({ example: '2026-08' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mês deve estar no formato AAAA-MM' })
  month: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
