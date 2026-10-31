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
il ecoute les evenements RabbitMQ deja publies par le monolithe (meme exchange
`kbeauty.exchange` que l'integration [sav-ticketing-php](https://github.com/NF31/sav-ticketing-php))
et centralise l'envoi, le templating et la deduplication.

Aucun acces direct a la base de donnees ou au code de kbeauty-shop — uniquement les
messages RabbitMQ qu'il consomme.

## Stack

- NestJS (TypeScript, Node 24, ESM)
- `amqp-connection-manager`/`amqplib` pour consommer RabbitMQ directement (voir note
  d'architecture ci-dessous — pas `@nestjs/microservices`)
- `ajv`/`ajv-formats` (draft 2020-12) pour valider les messages contre leur contrat
  JSON Schema (`contracts/rabbitmq/`)
- `node:sqlite` (natif Node 24) pour la deduplication, pas de dependance ajoutee
- Resend pour l'envoi d'email reel (meme provider qu'en prod cote Laravel) ; sans
  `RESEND_API_KEY`, les emails sont journalises au lieu d'etre envoyes
- Vitest pour les tests

### Pourquoi pas `@nestjs/microservices` (transport RMQ) ?

Choix initial, revise apres etude : le transport RMQ de Nest gere ses propres
files/exchanges a sa facon (patterns de message, files par pattern) et ne se branche
pas naturellement sur un exchange + routing key deja geres par un producteur externe
non-Nest (kbeauty-shop, en PHP). `sav-ticketing-php` consomme deja ce meme exchange
avec `amqplib` brut plutot qu'un framework — ce service suit le meme principe plutot
que de forcer une abstraction qui ne correspond pas a la topologie reelle.

## Commandes

```bash
npm install
npm run start:dev    # dev avec auto-reload
npm run lint          # oxlint
npm run test           # vitest
npm run build            # build de prod
```

## Infra

Depend de RabbitMQ (`kbeauty-ecosystem`, meme exchange `kbeauty.exchange` que le SAV) et
d'un compte RabbitMQ dedie a droits limites (`notifications`, cree par
`kbeauty-ecosystem/rabbitmq/creer-comptes.sh`).

```bash
# 1. RabbitMQ + compte dedie (rejouable)
cd ~/projects/kbeauty-ecosystem
docker start kbeauty_rabbitmq
./rabbitmq/creer-comptes.sh

# 2. Ce service
cd ~/projects/kbeauty-notifications-service
cp .env.example .env   # ajuster RABBITMQ_URL/RESEND_API_KEY si besoin
npm run start:dev
```

Interface RabbitMQ : http://localhost:15672 (onglet *Queues* :
`notifications.newsletter`, `notifications.rejetees`).

## Evenements consommes

| Routing key | Contrat | Statut |
|---|---|---|
| `newsletter.subscription_requested` | [`contracts/rabbitmq/newsletter-subscription-requested.schema.json`](contracts/rabbitmq/newsletter-subscription-requested.schema.json) | Consumer ecrit et teste (voir ci-dessous) ; cote kbeauty-shop, la publication reelle de cet evenement n'est pas encore faite (`NewsletterSubscriptionConfirmation` publie toujours directement en mail) |

Meme garanties que l'integration SAV (voir doc 20 cote kbeauty-shop) : exchange direct
verifie en declaration passive, file quorum avec dead-letter vers une file de rejets,
un message a la fois (prefetch 1), idempotence (dedup SQLite par `subscriberId`).

## Ce qui a ete verifie en local

Avec un vrai RabbitMQ (`kbeauty_rabbitmq`) et le compte `notifications` cree par
`creer-comptes.sh` :

| Scenario | Resultat |
|---|---|
| Message conforme publie sur `kbeauty.exchange` | Consomme, email journalise (pas de `RESEND_API_KEY` en local), `subscriberId` enregistre en dedup |
| Meme message republie | "deja traite, ignore" — aucun second envoi, horodatage dedup inchange |
| Message hors contrat (`subscriberId` texte, email invalide) | Rejete vers `notifications.rejetees` (1 message), jamais traite |
| Compte `notifications` tente de publier sur `kbeauty.exchange` | `Access refused` |
| Compte `notifications` tente de lire `sav.retours` | `Access refused` |

Tests automatises : `npm run test` (contrat JSON Schema, 5/5).

## Développement assisté par IA

Ce projet est développé avec un assistant IA (Claude Code). Je définis le périmètre,
l'architecture et les priorités, puis je relis et teste chaque changement avant de le
fusionner. Les commits co-écrits avec l'IA le signalent par une ligne `Co-Authored-By`.
