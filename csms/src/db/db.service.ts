import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

// Self-provisioning minimal schema. Set DATABASE_URL (e.g. from Supabase) and these
// tables are created automatically on boot. Full reference schema is in db/schema.sql.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS chargers (
  id            TEXT PRIMARY KEY,
  vendor        TEXT,
  model         TEXT,
  firmware      TEXT,
  serial_number TEXT,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id             BIGSERIAL PRIMARY KEY,
  ocpp_tx_id     BIGINT,
  charger_id     TEXT,
  connector_id   INT,
  id_tag         TEXT,
  meter_start_wh BIGINT,
  meter_stop_wh  BIGINT,
  status         TEXT NOT NULL DEFAULT 'active',
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at     TIMESTAMPTZ
);
`;

/**
 * Optional PostgreSQL layer. If DATABASE_URL is set (e.g. Supabase connection string),
 * persistence is ON. If not, the app still runs fully in memory. All queries are
 * best-effort: a DB hiccup never breaks the OCPP / charging flow.
 */
@Injectable()
export class DbService implements OnModuleInit {
  private readonly logger = new Logger('DB');
  private pool: Pool | null = null;

  get enabled(): boolean {
    return !!this.pool;
  }

  async onModuleInit() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      this.logger.warn('DATABASE_URL not set — running IN-MEMORY (no persistence). Charging still works.');
      return;
    }
    try {
      this.pool = new Pool({
        connectionString: url,
        // Supabase / most managed Postgres require SSL.
        ssl: { rejectUnauthorized: false },
        max: 5,
      });
      await this.pool.query(SCHEMA);
      this.logger.log('PostgreSQL connected — persistence ON');
    } catch (e: any) {
      this.pool = null;
      this.logger.error(`PostgreSQL connect failed (${e.message}) — falling back to IN-MEMORY`);
    }
  }

  async query(text: string, params?: any[]): Promise<{ rows: any[] }> {
    if (!this.pool) return { rows: [] };
    try {
      return await this.pool.query(text, params);
    } catch (e: any) {
      this.logger.error(`query failed: ${e.message}`);
      return { rows: [] };
    }
  }
}
