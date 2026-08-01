import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { ApptStatus, ScheduleType } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class CreateScheduleDto {
  @ApiProperty({ enum: ScheduleType })
  @IsEnum(ScheduleType, { message: 'Tipo de compromisso inválido' })
  type: ScheduleType;

  @ApiProperty({ example: 'Prova — Ana Paula' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: '2026-08-12T14:00:00.000Z' })
  @IsDateString({}, { message: 'Data de início inválida' })
  startAt: string;

  @ApiProperty({ example: '2026-08-12T15:00:00.000Z' })
  @IsDateString({}, { message: 'Data de término inválida' })
  endAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ enum: ApptStatus })
  @IsOptional()
  @IsEnum(ApptStatus, { message: 'Situação inválida' })
  status?: ApptStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Ordem de serviço vinculada' })
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiPropertyOptional({ description: 'Orçamento vinculado' })
  @IsOptional()
  @IsString()
  quoteId?: string;

  @ApiPropertyOptional({ description: 'Responsável pelo atendimento' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateScheduleDto extends CreateScheduleDto {
  @ApiPropertyOptional({ enum: ScheduleType })
  @IsOptional()
  @IsEnum(ScheduleType, { message: 'Tipo de compromisso inválido' })
  declare type: ScheduleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Data de início inválida' })
  declare startAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Data de término inválida' })
  declare endAt: string;
}

export class ListSchedulesDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: ScheduleType })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(ScheduleType, { message: 'Tipo inválido' })
  type?: ScheduleType;

  @ApiPropertyOptional({ description: 'Inclui os prazos de entrega das OS no período' })
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => String)
  includeDeadlines?: string;
}

export class ConflictQueryDto {
  @ApiProperty()
  @IsDateString({}, { message: 'Data de início inválida' })
  startAt: string;

  @ApiProperty()
  @IsDateString({}, { message: 'Data de término inválida' })
  endAt: string;

  @ApiPropertyOptional({ description: 'Ignora este agendamento — usado ao editar' })
  @IsOptional()
  @IsString()
  excludeId?: string;
}
