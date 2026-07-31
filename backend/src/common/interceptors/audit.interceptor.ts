import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, user, ip, headers } = request;

    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!writeMethods.includes(method) || !user) return next.handle();

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const resource = context.getClass().name.replace('Controller', '').toLowerCase();
          await this.prisma.auditLog.create({
            data: {
              userId: user.id,
              action: method,
              resource,
              resourceId: responseData?.id ?? 'unknown',
              after: responseData,
              ip: ip,
              userAgent: headers['user-agent'],
            },
          });
        } catch (_) {}
      }),
    );
  }
}
