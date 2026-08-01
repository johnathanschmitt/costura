import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CategoryType } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Bordado' })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType, { message: 'Tipo deve ser INCOME ou EXPENSE' })
  type: CategoryType;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListCategoriesDto {
  @ApiPropertyOptional({ enum: CategoryType })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(CategoryType, { message: 'Tipo inválido' })
  type?: CategoryType;
}

export class DreQueryDto {
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString({}, { message: 'Data inicial inválida' })
  startDate: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  @IsDateString({}, { message: 'Data final inválida' })
  endDate: string;
}
