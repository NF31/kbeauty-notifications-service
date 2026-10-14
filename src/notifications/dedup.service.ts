import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * RabbitMQ garantit une livraison "au moins une fois", pas "exactement une
 * fois" (meme principe que tickets.retour_kbeauty_id cote sav-ticketing-php,
 * contrainte UNIQUE). Un meme evenement recu deux fois ne declenche qu'un
 * seul envoi. SQLite local suffit : le volume ne justifie pas une base
 * partagee (Neon) pour l'instant.
 */
@Injectable()
export class DedupService implements OnModuleInit {
  private db!: DatabaseSync;

  onModuleInit(): void {
    const path =
      process.env.NOTIFICATIONS_DB_PATH ?? join(process.cwd(), 'data', 'notifications.sqlite');
    mkdirSync(dirname(path), { recursive: true });

    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_type TEXT NOT NULL,
        event_id TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        PRIMARY KEY (event_type, event_id)
      )
    `);
  }

  /** true si l'evenement a deja ete traite (et ne doit pas l'etre a nouveau). */
  dejaTraite(eventType: string, eventId: string): boolean {
    const row = this.db
      .prepare(
        'SELECT 1 FROM processed_events WHERE event_type = ? AND event_id = ?',
      )
      .get(eventType, eventId);

    return row !== undefined;
  }

  marquerTraite(eventType: string, eventId: string): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO processed_events (event_type, event_id, processed_at) VALUES (?, ?, ?)',
      )
      .run(eventType, eventId, new Date().toISOString());
  }
}
