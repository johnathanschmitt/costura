import {
  Controller, Post, Get, Delete, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, ParseEnumPipe, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AttachmentsService, ATTACHMENT_ENTITIES, AttachmentEntity } from './attachments.service';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * `entityType` vira nome de coluna no Prisma (`<entidade>Id`), então precisa vir
 * de uma lista fechada — não do que o cliente mandar.
 */
const parseEntity = new ParseEnumPipe(
  ATTACHMENT_ENTITIES.reduce((acc, e) => ({ ...acc, [e]: e }), {}),
  { exceptionFactory: () => new BadRequestException(`entityType deve ser: ${ATTACHMENT_ENTITIES.join(', ')}`) },
);

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
    @Query('entityType', parseEntity) entityType: AttachmentEntity,
    @Query('entityId') entityId: string,
  ) {
    return this.service.upload(file, entityType, entityId);
  }

  @ApiOperation({ summary: 'Listar anexos de uma entidade' })
  @Get()
  list(
    @Query('entityType', parseEntity) entityType: AttachmentEntity,
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
