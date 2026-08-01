import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class DistributionQueryDto {
  @ApiPropertyOptional({ example: '2026-08', description: 'Mês AAAA-MM. Padrão: mês atual.' })
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
