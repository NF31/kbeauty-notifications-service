import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { NotificationsConsumer } from './notifications/notifications.consumer.js';

describe('AppController', () => {
  let appController: AppController;

  function buildApp(connected: boolean) {
    return Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: NotificationsConsumer,
          useValue: { isConnected: () => connected },
        },
      ],
    }).compile();
  }

  describe('health', () => {
    it('reports ok when connected to RabbitMQ', async () => {
      const app: TestingModule = await buildApp(true);
      appController = app.get<AppController>(AppController);

      const res = { status: vi.fn() } as never;
      expect(appController.health(res)).toEqual({
        status: 'ok',
        rabbitmq: 'connected',
      });
    });

    it('reports degraded (and sets 503) when disconnected from RabbitMQ', async () => {
      const app: TestingModule = await buildApp(false);
      appController = app.get<AppController>(AppController);

      const status = vi.fn();
      const res = { status } as never;
      expect(appController.health(res)).toEqual({
        status: 'degraded',
        rabbitmq: 'disconnected',
      });
      expect(status).toHaveBeenCalledWith(503);
    });
  });
});
