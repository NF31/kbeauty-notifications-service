import { Module } from '@nestjs/common';
import { ContractValidatorService } from './contract-validator.service.js';
import { DedupService } from './dedup.service.js';
import { EmailService } from './email.service.js';
import { NotificationsConsumer } from './notifications.consumer.js';

@Module({
  providers: [
    ContractValidatorService,
    DedupService,
    EmailService,
    NotificationsConsumer,
  ],
})
export class NotificationsModule {}
