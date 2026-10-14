import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  type AmqpConnectionManager,
  type ChannelWrapper,
  type Channel,
} from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import { ContractValidatorService, MessageHorsContrat } from './contract-validator.service.js';
import { DedupService } from './dedup.service.js';
import { EmailService } from './email.service.js';
import { newsletterSubscriptionRequestedTemplate } from './templates.js';

interface NewsletterSubscriptionRequested {
  eventType: 'newsletter.subscription_requested';
  subscriberId: number;
  email: string;
  confirmUrl: string;
  occurredAt: string;
}

/**
 * Ecoute les evenements publies par kbeauty-shop sur l'exchange commun et
 * envoie les notifications correspondantes. Meme principe que
 * ConsommateurRetours cote sav-ticketing-php (docs/montee-competence/20-
 * integration-sav-rabbitmq.md) : exchange direct declare par l'infra
 * commune (verifie ici en declaration passive, jamais modifie), file
 * "quorum" avec dead-letter vers une file de rejets, un message a la fois
 * (prefetch 1), ack/nack/reject selon le resultat du traitement.
 *
 * Implemente avec amqp-connection-manager/amqplib directement plutot
 * qu'avec le transport RMQ de @nestjs/microservices : ce dernier gere ses
 * propres files/exchanges a sa facon et ne se branche pas naturellement
 * sur un exchange + routing key deja geres par un producteur externe
 * (kbeauty-shop, en PHP) - le meme choix que sav-ticketing-php, qui utilise
 * aussi amqplib brut plutot qu'un framework.
 */
@Injectable()
export class NotificationsConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsConsumer.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  static readonly EXCHANGE = 'kbeauty.exchange';
  static readonly QUEUE = 'notifications.newsletter';
  static readonly ROUTING_KEY = 'newsletter.subscription_requested';
  static readonly REJECTS_EXCHANGE = 'notifications.rejetees';
  static readonly REJECTS_QUEUE = 'notifications.rejetees';
  private static readonly DELIVERY_LIMIT = 5;

  constructor(
    private readonly config: ConfigService,
    private readonly validator: ContractValidatorService,
    private readonly dedup: DedupService,
    private readonly email: EmailService,
  ) {}

  onApplicationBootstrap(): void {
    const url = this.config.get<string>(
      'RABBITMQ_URL',
      'amqp://notifications:notifications@localhost:5672',
    );

    this.connection = connect([url]);
    this.connection.on('connect', () =>
      this.logger.log('Connecte a RabbitMQ.'),
    );
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn(`Deconnecte de RabbitMQ : ${err?.message}`),
    );

    this.channel = this.connection.createChannel({
      json: false,
      setup: async (channel: Channel) => {
        await channel.checkExchange(NotificationsConsumer.EXCHANGE);

        await channel.assertExchange(
          NotificationsConsumer.REJECTS_EXCHANGE,
          'fanout',
          { durable: true },
        );
        await channel.assertQueue(NotificationsConsumer.REJECTS_QUEUE, {
          durable: true,
        });
        await channel.bindQueue(
          NotificationsConsumer.REJECTS_QUEUE,
          NotificationsConsumer.REJECTS_EXCHANGE,
          '',
        );

        await channel.assertQueue(NotificationsConsumer.QUEUE, {
          durable: true,
          arguments: {
            'x-queue-type': 'quorum',
            'x-delivery-limit': NotificationsConsumer.DELIVERY_LIMIT,
            'x-dead-letter-exchange': NotificationsConsumer.REJECTS_EXCHANGE,
          },
        });
        await channel.bindQueue(
          NotificationsConsumer.QUEUE,
          NotificationsConsumer.EXCHANGE,
          NotificationsConsumer.ROUTING_KEY,
        );
      },
    });

    void this.channel.consume(
      NotificationsConsumer.QUEUE,
      (message) => this.traiter(message),
      { prefetch: 1 },
    );

    this.logger.log(`En ecoute sur la file ${NotificationsConsumer.QUEUE}.`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async traiter(message: ConsumeMessage): Promise<void> {
    const channel = this.channel!;
    let payload: NewsletterSubscriptionRequested;

    try {
      payload = this.validator.validate<NewsletterSubscriptionRequested>(
        NotificationsConsumer.ROUTING_KEY,
        JSON.parse(message.content.toString('utf8')),
      );
    } catch (error) {
      // Pas le corps du message dans le journal : il contient l'email du
      // destinataire (donnee personnelle).
      if (error instanceof MessageHorsContrat) {
        this.logger.warn(`Rejete vers les rejets : ${error.message}`);
      } else {
        this.logger.warn('Rejete vers les rejets : JSON invalide.');
      }
      channel.nack(message, false, false);

      return;
    }

    const eventId = String(payload.subscriberId);

    if (this.dedup.dejaTraite(payload.eventType, eventId)) {
      channel.ack(message);
      this.logger.log(`Abonne ${eventId} : deja traite, ignore.`);

      return;
    }

    try {
      const { subject, html } = newsletterSubscriptionRequestedTemplate(
        payload.confirmUrl,
      );
      await this.email.send(payload.email, subject, html);
    } catch (error) {
      const raison = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Abonne ${eventId} : erreur, nouvel essai (${raison}).`);
      channel.nack(message, false, true);

      return;
    }

    this.dedup.marquerTraite(payload.eventType, eventId);
    channel.ack(message);
    this.logger.log(`Abonne ${eventId} : email de confirmation envoye.`);
  }
}
