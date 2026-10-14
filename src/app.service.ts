import { Injectable } from '@nestjs/common';
import { NotificationsConsumer } from './notifications/notifications.consumer.js';

export interface Health {
  status: 'ok' | 'degraded';
  rabbitmq: 'connected' | 'disconnected';
}

@Injectable()
export class AppService {
  constructor(private readonly consumer: NotificationsConsumer) {}

  getHealth(): Health {
    const connected = this.consumer.isConnected();

    return {
      status: connected ? 'ok' : 'degraded',
      rabbitmq: connected ? 'connected' : 'disconnected',
    };
  }
}
