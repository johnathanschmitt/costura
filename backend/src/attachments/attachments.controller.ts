import {
  Controller, Post, Get, Delete, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AttachmentsService } from './attachments.service';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private service: AttachmentsService) {}

  @ApiOperation({ summary: 'Upload de arquivo' })
  @ApiConsumes('multipart/form-data')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  upload(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_SIZE })] }))
    file: Express.Multer.File,
    @Query('entityType') entityType: 'customer' | 'workOrder' | 'quote',
    @Query('entityId') entityId: string,
  ) {
    return this.service.upload(file, entityType, entityId);
  }

  @ApiOperation({ summary: 'Listar anexos de uma entidade' })
  @Get()
  list(
    @Query('entityType') entityType: 'customer' | 'workOrder' | 'quote',
    @Query('entityId') entityId: string,
  ) {
    return this.service.list(entityType, entityId);
  }

  @ApiOperation({ summary: 'Remover anexo' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
