import { describe, expect, it } from 'vitest';
import {
  ContractValidatorService,
  MessageHorsContrat,
} from './contract-validator.service.js';

describe('ContractValidatorService', () => {
  const validator = new ContractValidatorService();

  const payloadValide = {
    eventType: 'newsletter.subscription_requested',
    subscriberId: 42,
    email: 'client@example.com',
    confirmUrl: 'https://kbeauty-shop.test/newsletter/confirm?signature=abc',
    occurredAt: '2026-10-14T15:00:00Z',
  };

  it('accepte un message conforme au contrat', () => {
    const result = validator.validate(
      'newsletter.subscription_requested',
      payloadValide,
    );

    expect(result).toEqual(payloadValide);
  });

  it('rejette un message avec un champ manquant', () => {
    const { email: _email, ...sansEmail } = payloadValide;

    expect(() =>
      validator.validate('newsletter.subscription_requested', sansEmail),
    ).toThrow(MessageHorsContrat);
  });

  it('rejette un message avec un champ en plus (additionalProperties: false)', () => {
    const payloadAvecChampEnPlus = { ...payloadValide, motDePasse: 'secret' };

    expect(() =>
      validator.validate(
        'newsletter.subscription_requested',
        payloadAvecChampEnPlus,
      ),
    ).toThrow(MessageHorsContrat);
  });

  it('rejette un email mal forme', () => {
    const payloadEmailInvalide = { ...payloadValide, email: 'pas-un-email' };

    expect(() =>
      validator.validate(
        'newsletter.subscription_requested',
        payloadEmailInvalide,
      ),
    ).toThrow(MessageHorsContrat);
  });
});
