import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), NotificationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
