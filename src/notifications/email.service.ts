import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Meme provider qu'en production cote Laravel (Resend). Si aucune cle API
 * n'est configuree (dev local sans compte Resend), le service journalise
 * l'email au lieu de l'envoyer, pour pouvoir developper/tester sans compte.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      this.config.get<string>('NOTIFICATIONS_FROM_EMAIL') ??
      'Korea Beauty <no-reply@kbeauty-shop.test>';

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY absent : les emails seront journalises, pas envoyes.',
      );
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[email simule] to=${to} subject="${subject}"`);

      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend a refuse l'envoi : ${error.message}`);
    }
  }
}
