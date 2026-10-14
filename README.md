# kbeauty-notifications-service

Microservice NestJS — notifications transactionnelles (email d'abord, SMS/push en
extension future), decouplees du monolithe Laravel
[kbeauty-shop](https://github.com/NF31/kbeauty-shop).

Exercice de montee en competence (preparation Master MIAGE), voir
[21-notifications-service.md](https://github.com/NF31/kbeauty-shop/blob/main/docs/montee-competence/21-notifications-service.md)
dans le repo principal pour le cadrage complet (pourquoi, backlog, architecture).

## Principe

Aujourd'hui, les notifications (confirmation de commande, retour, newsletter...) sont
envoyees en dur depuis `app/Notifications/` dans kbeauty-shop. Ce service les decouple :
il ecoute les evenements RabbitMQ deja publies par le monolithe (meme bus que
l'integration [sav-ticketing-php](https://github.com/NF31/sav-ticketing-php)) et centralise
l'envoi, le templating et la deduplication.

Aucun acces direct a la base de donnees ou au code de kbeauty-shop — uniquement les
messages RabbitMQ qu'il consomme.

## Stack

- NestJS (TypeScript, Node 24)
- `@nestjs/microservices` (transport AMQP) pour consommer RabbitMQ
- Resend pour l'envoi d'email reel (meme provider qu'en prod cote Laravel)
- Vitest pour les tests

## Commandes

```bash
npm install
npm run start:dev    # dev avec auto-reload
npm run lint          # oxlint
npm run test           # vitest
npm run build            # build de prod
```

## Infra

Depend de RabbitMQ, demarre via `kbeauty-ecosystem` (docker-compose partage avec les
autres microservices du meme ecosystem).
