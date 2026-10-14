import { Injectable, Logger } from '@nestjs/common';
// Les contrats (comme ceux de kbeauty-shop) declarent $schema en draft
// 2020-12 ; l'Ajv par defaut ne charge que le meta-schema draft-07, d'ou
// Ajv2020 plutot que Ajv.
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ajv-formats n'a pas d'export nomme (seulement un export par defaut CJS) ;
// sous module:nodenext + type:module, l'import par defaut classique de ce
// paquet n'a pas de signature d'appel pour le compilateur TS (connu,
// probleme d'interop CJS/ESM typage uniquement, pas d'impact a l'execution).
import addFormatsModule from 'ajv-formats';
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

export class MessageHorsContrat extends Error {}

/**
 * Un message RabbitMQ est une donnee non fiable tant qu'il n'a pas ete
 * verifie contre son contrat (meme principe que ContratRetourSoumis cote
 * sav-ticketing-php) : un message hors contrat n'est jamais traite.
 */
@Injectable()
export class ContractValidatorService {
  private readonly logger = new Logger(ContractValidatorService.name);
  private readonly ajv = addFormats(new Ajv2020({ allErrors: true }));
  private readonly validators = new Map<string, ValidateFunction>();

  validate<T>(eventType: string, payload: unknown): T {
    const validator = this.getValidator(eventType);

    if (!validator(payload)) {
      const errors = this.ajv.errorsText(validator.errors);
      throw new MessageHorsContrat(
        `Message hors contrat pour ${eventType} : ${errors}`,
      );
    }

    return payload as T;
  }

  private getValidator(eventType: string): ValidateFunction {
    const cached = this.validators.get(eventType);

    if (cached) {
      return cached;
    }

    const schemaPath = join(
      process.cwd(),
      'contracts',
      'rabbitmq',
      // meme convention de nommage que les contrats cote kbeauty-shop :
      // return_request.submitted -> return-request-submitted.schema.json
      `${eventType.replace(/[._]/g, '-')}.schema.json`,
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const validator = this.ajv.compile(schema);
    this.validators.set(eventType, validator);
    this.logger.log(`Contrat charge : ${schemaPath}`);

    return validator;
  }
}
