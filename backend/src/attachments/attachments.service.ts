import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttachmentsService {
  private minio: Minio.Client;
  private bucket: string;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.minio = new Minio.Client({
      endPoint: this.config.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.config.get('MINIO_PORT', '9000')),
      useSSL: this.config.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucket = this.config.get('MINIO_BUCKET', 'atelie');
  }

  private async ensureBucket() {
    const exists = await this.minio.bucketExists(this.bucket);
    if (!exists) {
      await this.minio.makeBucket(this.bucket);
      await this.minio.setBucketPolicy(this.bucket, JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${this.bucket}/*`] }],
      }));
    }
  }

  async upload(
    file: Express.Multer.File,
    entityType: 'customer' | 'workOrder' | 'quote',
    entityId: string,
  ) {
    await this.ensureBucket();
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `${entityType}/${entityId}/${Date.now()}.${ext}`;
    await this.minio.putObject(this.bucket, key, file.buffer, file.size, { 'Content-Type': file.mimetype });

    const minioPublicUrl = this.config.get('MINIO_PUBLIC_URL', 'http://localhost:9000');
    const url = `${minioPublicUrl}/${this.bucket}/${key}`;

    return this.prisma.attachment.create({
      data: {
        fileName: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        [`${entityType}Id`]: entityId,
      },
    });
  }

  async list(entityType: 'customer' | 'workOrder' | 'quote', entityId: string) {
    return this.prisma.attachment.findMany({
      where: { [`${entityType}Id`]: entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Anexo não encontrado');
    try {
      await this.minio.removeObject(this.bucket, att.fileName);
    } catch { /* ignora erro do MinIO, remove do DB mesmo assim */ }
    return this.prisma.attachment.delete({ where: { id } });
  }
}
