import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class MonthlyResultQueryDto {
  @ApiPropertyOptional({ example: '2026-08', description: 'Mês no formato AAAA-MM. Padrão: mês atual.' })
  @IsOptional()
  @EmptyToUndefined()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mês deve estar no formato AAAA-MM' })
  month?: string;

  @ApiPropertyOptional({ default: 12, description: 'Quantos meses trazer no histórico' })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  historyMonths?: number = 12;
}
