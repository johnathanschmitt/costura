import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsObject,
  IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { ItemType, Priority, WorkOrderStatus } from '@prisma/client';
import { EmptyToUndefined } from '../../common/decorators/empty-to-undefined.decorator';

export class WorkOrderItemDto {
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

  @ApiProperty({ example: 150 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço unitário inválido' })
  @Min(0, { message: 'Preço unitário não pode ser negativo' })
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ description: 'Tipo de peça' })
  @IsOptional()
  @IsString()
  garmentId?: string;

  @ApiPropertyOptional({ description: 'Costureira responsável' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority, { message: 'Prioridade inválida' })
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Prazo de entrega inválido' })
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Descrição detalhada, visível à cliente' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Observações internas — só para a equipe' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;

  @ApiPropertyOptional({ description: 'Medidas específicas desta peça' })
  @IsOptional()
  @IsObject()
  measurements?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Desconto inválido' })
  @Min(0, { message: 'Desconto não pode ser negativo' })
  discount?: number;

  @ApiPropertyOptional({ type: [WorkOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderItemDto)
  items?: WorkOrderItemDto[];
}

export class UpdateWorkOrderDto extends CreateWorkOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare customerId: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus, { message: 'Status inválido' })
  status: WorkOrderStatus;
}

export class AssignDto {
  @ApiPropertyOptional({ description: 'Costureira responsável. Vazio remove a atribuição.' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Motivo da reatribuição, registrado no histórico' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class DeliverDto {
  @ApiPropertyOptional({ description: 'Quem retirou a peça' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receivedBy?: string;

  @ApiPropertyOptional({
    description: 'Confirma a entrega mesmo havendo saldo devedor. Sem isso, a entrega é recusada.',
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDebt?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateUpdateDto {
  @ApiProperty({ example: 'Corte concluído, iniciando a montagem' })
  @IsString()
  @MaxLength(1000)
  note: string;

  @ApiPropertyOptional({ example: 50, description: 'Percentual de conclusão: 0, 25, 50, 75 ou 100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Percentual inválido' })
  @Min(0)
  @Max(100)
  progressPct?: number;
}

export class SetEstimatedHoursDto {
  @ApiProperty({ example: 6.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Horas estimadas inválidas' })
  @Min(0)
  @Max(999)
  estimatedHours: number;
}

export class ListWorkOrdersDto {
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

  @ApiPropertyOptional({ enum: WorkOrderStatus })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(WorkOrderStatus, { message: 'Status inválido' })
  status?: WorkOrderStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(Priority, { message: 'Prioridade inválida' })
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  garmentId?: string;

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

  @ApiPropertyOptional({ description: 'Prazo a partir de' })
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Prazo inicial inválido' })
  dueStart?: string;

  @ApiPropertyOptional({ description: 'Prazo até' })
  @IsOptional()
  @EmptyToUndefined()
  @IsDateString({}, { message: 'Prazo final inválido' })
  dueEnd?: string;
}

export class BoardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @EmptyToUndefined()
  @IsEnum(Priority, { message: 'Prioridade inválida' })
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  garmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(120)
  search?: string;
}
