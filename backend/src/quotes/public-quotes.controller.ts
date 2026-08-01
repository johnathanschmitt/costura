import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';

/**
 * Rota pública, sem JwtAuthGuard: é o link que a cliente recebe por WhatsApp.
 * O acesso é pelo token aleatório do orçamento, e o retorno traz só o que ela
 * precisa ver — sem telefone, CPF ou endereço.
 */
@ApiTags('public')
@Controller('public/quotes')
export class PublicQuotesController {
  constructor(private service: QuotesService) {}

  @ApiOperation({ summary: 'Orçamento pelo link público (sem login)' })
  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.service.findByPublicToken(token);
  }
}
