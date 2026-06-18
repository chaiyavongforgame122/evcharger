-- EvCharger CSMS — PostgreSQL schema (NEXT STEP reference)
-- The scaffold currently keeps state in memory (ChargersService). When you're ready to
-- persist, create this schema on the Railway PostgreSQL plugin and wire it up (TypeORM/Prisma).

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  line_user_id  TEXT UNIQUE NOT NULL,         -- LINE LIFF profile userId
  display_name  TEXT,
  wallet_satang BIGINT NOT NULL DEFAULT 0,    -- prepaid balance (Phase 2), stored in satang
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chargers (
  id              TEXT PRIMARY KEY,           -- OCPP chargePointId, e.g. EVLINK01
  vendor          TEXT,
  model           TEXT,
  firmware        TEXT,
  serial_number   TEXT,
  online          BOOLEAN NOT NULL DEFAULT false,
  last_heartbeat  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS connectors (
  charger_id    TEXT NOT NULL REFERENCES chargers(id) ON DELETE CASCADE,
  connector_id  INT  NOT NULL,
  status        TEXT,                          -- Available | Charging | Faulted | ...
  error_code    TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (charger_id, connector_id)
);

CREATE TABLE IF NOT EXISTS tariffs (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  price_satang_kwh  INT  NOT NULL,             -- THB/kWh in satang (e.g. 700 = 7.00 THB)
  overstay_satang_min INT NOT NULL DEFAULT 0,  -- overstay penalty per minute (Phase 2)
  active            BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS transactions (
  id              BIGSERIAL PRIMARY KEY,
  ocpp_tx_id      BIGINT,                      -- transactionId returned in StartTransaction.conf
  charger_id      TEXT NOT NULL REFERENCES chargers(id),
  connector_id    INT  NOT NULL,
  user_id         BIGINT REFERENCES users(id),
  id_tag          TEXT,
  meter_start_wh  BIGINT,
  meter_stop_wh   BIGINT,
  energy_wh       BIGINT GENERATED ALWAYS AS (COALESCE(meter_stop_wh,0) - COALESCE(meter_start_wh,0)) STORED,
  amount_satang   BIGINT,                      -- computed at stop from energy * tariff
  status          TEXT NOT NULL DEFAULT 'active', -- active | completed
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS meter_values (
  id              BIGSERIAL PRIMARY KEY,
  transaction_id  BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
  sampled_at      TIMESTAMPTZ NOT NULL,
  energy_wh       BIGINT,
  power_w         INT,
  raw             JSONB
);

CREATE INDEX IF NOT EXISTS idx_tx_charger ON transactions(charger_id);
CREATE INDEX IF NOT EXISTS idx_tx_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mv_tx      ON meter_values(transaction_id);
