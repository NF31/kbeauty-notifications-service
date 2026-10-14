import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppService, type Health } from './app.service.js';

/**
 * Seule route HTTP de ce service - il n'a pas d'interface, son travail se
 * fait entierement via RabbitMQ (NotificationsConsumer). Utile pour un
 * hebergeur (Railway, Azure...) qui a besoin de savoir si le process est
 * vivant et connecte au broker, pas pour un usage humain/navigateur.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(@Res({ passthrough: true }) res: Response): Health {
    const health = this.appService.getHealth();

    if (health.status === 'degraded') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
