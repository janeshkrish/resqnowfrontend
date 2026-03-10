import mysql from "mysql2/promise";

let pool = null;

function isProductionLike() {
  return (
    String(process.env.NODE_ENV || "").toLowerCase() === "production" ||
    String(process.env.RENDER || "").toLowerCase() === "true" ||
    Boolean(process.env.RENDER_EXTERNAL_URL)
  );
}

function assertDatabaseConfig() {
  if (!isProductionLike()) return;

  const requiredKeys = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = requiredKeys.filter((key) => !String(process.env[key] || "").trim());
  if (missing.length > 0) {
    throw new Error(`[DB CONFIG] Missing required environment variables: ${missing.join(", ")}`);
  }

  const host = String(process.env.DB_HOST || "").trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    throw new Error("[DB CONFIG] DB_HOST cannot point to localhost in production/Render.");
  }
}

export async function getPool() {
  assertDatabaseConfig();
  if (pool) return pool;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 4000;
  const useSsl = process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number.isNaN(port) ? 4000 : port,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "test",
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0,
    ...(useSsl && {
      // TiDB Cloud uses TLS; allow non-strict verification for convenience unless user provides certs
      ssl: {
        rejectUnauthorized: process.env.DB_SSL_STRICT === 'true',
      },
    }),
  });

  // Quick connectivity check to surface helpful error messages early
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`Database connectivity test failed to ${process.env.DB_HOST}:${process.env.DB_PORT} (ssl=${process.env.DB_SSL}).`, err.message || err);
    throw err;
  }

  return pool;
}

export async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch (err) {
    console.error("Error while closing DB pool:", err?.message || err);
  }
}

export async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

const TECHNICIANS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS technicians (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  upi_id VARCHAR(255),
  service_type VARCHAR(100),
  location VARCHAR(255),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  password_hash VARCHAR(255),
  address VARCHAR(512),
  region VARCHAR(255),
  district VARCHAR(255),
  state VARCHAR(255),
  locality VARCHAR(255),
  service_area_range INT DEFAULT 10,
  experience INT DEFAULT 0,
  specialties JSON,
  pricing JSON,
  settings JSON
)
`.trim();

export async function ensureTechniciansTable() {
  const p = await getPool();
  await p.execute(TECHNICIANS_TABLE_SQL);
}

const USERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  is_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'approved',
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureUsersTable() {
  const p = await getPool();
  await p.execute(USERS_TABLE_SQL);
}

const OTP_REQUESTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS otp_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email_created (email, created_at)
)
`.trim();

export async function ensureOtpRequestsTable() {
  const p = await getPool();
  await p.execute(OTP_REQUESTS_TABLE_SQL);
}

const OTP_RATE_LIMITS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS otp_rate_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  otp_request_count INT NOT NULL DEFAULT 0,
  otp_last_request_time DATETIME NULL,
  otp_window_start_time DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_otp_rate_limits_email (email)
)
`.trim();

export async function ensureOtpRateLimitsTable() {
  const p = await getPool();
  await p.execute(OTP_RATE_LIMITS_TABLE_SQL);
}

const SERVICE_REQUESTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  technician_id INT,
  service_type VARCHAR(100) NOT NULL,
  vehicle_type VARCHAR(50),
  vehicle_model VARCHAR(100),
  address VARCHAR(512),
  description TEXT,
  location_lat FLOAT,
  location_lng FLOAT,
  amount DECIMAL(10, 2) DEFAULT 0.00,
  applied_coupon_code VARCHAR(64),
  applied_discount_percent DECIMAL(8,6) DEFAULT 0.000000,
  applied_discount_amount DECIMAL(10,2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'pending',
  status ENUM('pending','assigned','accepted','en-route','in-progress','completed','cancelled') DEFAULT 'pending',
  contact_phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
)
`.trim();

export async function ensureServiceRequestsTable() {
  const p = await getPool();
  await p.execute(SERVICE_REQUESTS_TABLE_SQL);
}

const DISPATCH_OFFERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dispatch_offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_request_id INT NOT NULL,
  technician_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected', 'expired') DEFAULT 'pending',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id),
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
)
`.trim();

export async function ensureDispatchOffersTable() {
  const p = await getPool();
  await p.execute(DISPATCH_OFFERS_TABLE_SQL);
  await addIndexIfNotExists(p, "dispatch_offers", "idx_dispatch_offers_request_status", "service_request_id, status");
  await addIndexIfNotExists(p, "dispatch_offers", "idx_dispatch_offers_request_tech", "service_request_id, technician_id");
  await addIndexIfNotExists(p, "dispatch_offers", "idx_dispatch_offers_tech_status", "technician_id, status");
}

const TECHNICIAN_LOCATION_HISTORY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS technician_location_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  service_request_id INT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tech_location_history_tech_time (technician_id, captured_at),
  INDEX idx_tech_location_history_request_time (service_request_id, captured_at)
)
`.trim();

export async function ensureTechnicianLocationHistoryTable() {
  const p = await getPool();
  await p.execute(TECHNICIAN_LOCATION_HISTORY_TABLE_SQL);
}

const JOB_MONITORING_ALERTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS job_monitoring_alerts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  service_request_id INT NOT NULL,
  technician_id INT NULL,
  reason_code VARCHAR(64) NOT NULL,
  reason_text VARCHAR(255) NOT NULL,
  risk_level VARCHAR(16) NOT NULL DEFAULT 'yellow',
  eta_minutes DECIMAL(10, 2) NULL,
  eta_arrival DATETIME NULL,
  sla_deadline DATETIME NULL,
  technician_lat DECIMAL(10, 8) NULL,
  technician_lng DECIMAL(11, 8) NULL,
  customer_lat DECIMAL(10, 8) NULL,
  customer_lng DECIMAL(11, 8) NULL,
  metadata JSON,
  is_active BOOLEAN DEFAULT TRUE,
  first_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_job_monitoring_alerts_active (is_active, risk_level, last_detected_at),
  INDEX idx_job_monitoring_alerts_request (service_request_id, is_active),
  INDEX idx_job_monitoring_alerts_reason (reason_code, is_active)
)
`.trim();

export async function ensureJobMonitoringAlertsTable() {
  const p = await getPool();
  await p.execute(JOB_MONITORING_ALERTS_TABLE_SQL);
}

const NOTIFICATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureNotificationsTable() {
  const p = await getPool();
  await p.execute(NOTIFICATIONS_TABLE_SQL);
}

const REVIEWS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  user_id INT NOT NULL,
  service_request_id INT,
  rating DECIMAL(2, 1) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id)
)
`.trim();

export async function ensureReviewsTable() {
  const p = await getPool();
  await p.execute(REVIEWS_TABLE_SQL);
}

// Helper to add columns if they don't exist
// Using try-catch as robust way to handle "Duplicate column name" error across different MySQL versions
async function addColumnIfNotExists(pool, table, columnDef) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (err) {
    // Ignore duplicate column error (code 1060: Duplicate column name)
    // Also ignore if it says something like "Duplicate field name"
    if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060 && !err.message?.includes("Duplicate column")) {
      console.log(`Note: Could not add column ${columnDef} to ${table}, might already exist. Error: ${err.message}`);
    }
  }
}

async function addIndexIfNotExists(pool, table, indexName, columnsSql) {
  try {
    await pool.query(`CREATE INDEX ${indexName} ON ${table} (${columnsSql})`);
  } catch (err) {
    const message = String(err?.message || "");
    const isDuplicateIndex =
      err.code === "ER_DUP_KEYNAME" ||
      err.code === "ER_DUP_INDEX" ||
      err.errno === 1061 ||
      message.includes("Duplicate key name") ||
      message.includes("already exists");
    if (!isDuplicateIndex) {
      console.log(`Note: Could not add index ${indexName} on ${table}. Error: ${message}`);
    }
  }
}

async function addUniqueIndexIfNotExists(pool, table, indexName, columnsSql) {
  try {
    await pool.query(`CREATE UNIQUE INDEX ${indexName} ON ${table} (${columnsSql})`);
  } catch (err) {
    const message = String(err?.message || "");
    const isDuplicateIndex =
      err.code === "ER_DUP_KEYNAME" ||
      err.code === "ER_DUP_INDEX" ||
      err.errno === 1061 ||
      message.includes("Duplicate key name") ||
      message.includes("already exists");
    if (!isDuplicateIndex) {
      console.log(`Note: Could not add unique index ${indexName} on ${table}. Error: ${message}`);
    }
  }
}

export async function updateTechniciansTableSchema() {
  const p = await getPool();
  await addColumnIfNotExists(p, 'technicians', 'is_active BOOLEAN DEFAULT FALSE');
  await addColumnIfNotExists(p, 'technicians', 'is_available BOOLEAN DEFAULT FALSE');
  await addColumnIfNotExists(p, 'technicians', 'upi_id VARCHAR(255)');
  await addColumnIfNotExists(p, 'technicians', 'latitude DECIMAL(10, 8)');
  await addColumnIfNotExists(p, 'technicians', 'longitude DECIMAL(11, 8)');
  await addColumnIfNotExists(p, 'technicians', 'current_lat DECIMAL(10, 8)');
  await addColumnIfNotExists(p, 'technicians', 'current_lng DECIMAL(11, 8)');
  await addColumnIfNotExists(p, 'technicians', 'last_location_update DATETIME NULL');
  await addColumnIfNotExists(p, 'technicians', 'acceptance_rate DECIMAL(5,2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'technicians', 'skill_set JSON');
  await addColumnIfNotExists(p, 'technicians', 'current_job_id INT');
  // New columns for comprehensive technician data model
  await addColumnIfNotExists(p, 'technicians', 'resume_url VARCHAR(1024)');
  await addColumnIfNotExists(p, 'technicians', 'documents JSON');
  await addColumnIfNotExists(p, 'technicians', 'proprietor_name VARCHAR(255)');
  await addColumnIfNotExists(p, 'technicians', 'alternate_phone VARCHAR(50)');
  await addColumnIfNotExists(p, 'technicians', 'whatsapp_number VARCHAR(50)');
  await addColumnIfNotExists(p, 'technicians', 'google_maps_link VARCHAR(1024)');
  await addColumnIfNotExists(p, 'technicians', 'aadhaar_number VARCHAR(50)');
  await addColumnIfNotExists(p, 'technicians', 'pan_number VARCHAR(50)');
  await addColumnIfNotExists(p, 'technicians', 'business_type VARCHAR(100)');
  await addColumnIfNotExists(p, 'technicians', 'gst_number VARCHAR(50)');
  await addColumnIfNotExists(p, 'technicians', 'trade_license_number VARCHAR(50)');
  await addColumnIfNotExists(p, 'technicians', 'working_hours JSON');
  await addColumnIfNotExists(p, 'technicians', 'service_costs JSON');
  await addColumnIfNotExists(p, 'technicians', 'payment_details JSON');
  await addColumnIfNotExists(p, 'technicians', 'app_readiness JSON');
  await addColumnIfNotExists(p, 'technicians', 'vehicle_types JSON');
  await addColumnIfNotExists(p, 'technicians', 'settings JSON');

  await addColumnIfNotExists(p, 'technicians', 'registration_payment_status VARCHAR(50) DEFAULT "pending"');
  await addColumnIfNotExists(p, 'technicians', 'registration_payment_id VARCHAR(255)');
  await addColumnIfNotExists(p, 'technicians', 'registration_order_id VARCHAR(255)');

  // Columns already present in CREATE TABLE but added here for migration safety if table existed before
  await addColumnIfNotExists(p, 'technicians', 'jobs_completed INT DEFAULT 0');
  await addColumnIfNotExists(p, 'technicians', 'total_earnings DECIMAL(12, 2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'technicians', 'rating DECIMAL(3, 2) DEFAULT 5.00');

  // New column for user phone
  await addColumnIfNotExists(p, 'users', 'phone VARCHAR(50)');
  await addIndexIfNotExists(p, "technicians", "idx_technicians_upi_id", "upi_id");
}

const FILES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  content LONGBLOB NOT NULL,
  mimetype VARCHAR(100),
  size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureFilesTable() {
  const p = await getPool();
  await p.execute(FILES_TABLE_SQL);
}

const USER_VEHICLES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS user_vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  license_plate VARCHAR(50),
  status VARCHAR(32) DEFAULT 'ready',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
`.trim();

export async function ensureUserVehiclesTable() {
  const p = await getPool();
  await p.execute(USER_VEHICLES_TABLE_SQL);
  await addColumnIfNotExists(p, 'user_vehicles', "status VARCHAR(32) DEFAULT 'ready'");
}

const DEVICE_TOKENS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS device_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_type ENUM('user', 'technician') NOT NULL,
  token VARCHAR(512) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, user_type)
)
`.trim();

export async function ensureDeviceTokensTable() {
  const p = await getPool();
  await p.execute(DEVICE_TOKENS_TABLE_SQL);
}

const PAYMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_request_id INT NOT NULL,
  technician_id INT NULL,
  payment_method VARCHAR(50) DEFAULT 'razorpay',
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  amount DECIMAL(10, 2),
  service_cost DECIMAL(10, 2) DEFAULT 0.00,
  commission DECIMAL(10, 2) DEFAULT 0.00,
  total_paid DECIMAL(10, 2) DEFAULT 0.00,
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_signature VARCHAR(255),
  platform_fee DECIMAL(10, 2) DEFAULT 0.00,
  technician_amount DECIMAL(10, 2) DEFAULT 0.00,
  payout_status VARCHAR(50) DEFAULT 'pending',
  payout_id VARCHAR(255),
  payout_idempotency_key VARCHAR(255),
  payout_attempt_count INT DEFAULT 0,
  payout_last_error TEXT,
  payout_last_attempt_at DATETIME NULL,
  payout_processed_at DATETIME NULL,
  webhook_last_event VARCHAR(100),
  webhook_received_at DATETIME NULL,
  is_settled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id),
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
)
`.trim();

export async function ensurePaymentsTable() {
  const p = await getPool();
  await p.execute(PAYMENTS_TABLE_SQL);
  // Ensure columns exist if table already existed without them
  await addColumnIfNotExists(p, 'payments', 'technician_id INT NULL');
  await addColumnIfNotExists(p, 'payments', 'payment_status VARCHAR(50) DEFAULT "pending"');
  await addColumnIfNotExists(p, 'payments', 'service_cost DECIMAL(10, 2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'payments', 'commission DECIMAL(10, 2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'payments', 'total_paid DECIMAL(10, 2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'payments', 'platform_fee DECIMAL(10, 2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'payments', 'technician_amount DECIMAL(10, 2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'payments', 'payout_status VARCHAR(50) DEFAULT "pending"');
  await addColumnIfNotExists(p, 'payments', 'payout_id VARCHAR(255)');
  await addColumnIfNotExists(p, 'payments', 'payout_idempotency_key VARCHAR(255)');
  await addColumnIfNotExists(p, 'payments', 'payout_attempt_count INT DEFAULT 0');
  await addColumnIfNotExists(p, 'payments', 'payout_last_error TEXT');
  await addColumnIfNotExists(p, 'payments', 'payout_last_attempt_at DATETIME NULL');
  await addColumnIfNotExists(p, 'payments', 'payout_processed_at DATETIME NULL');
  await addColumnIfNotExists(p, 'payments', 'webhook_last_event VARCHAR(100)');
  await addColumnIfNotExists(p, 'payments', 'webhook_received_at DATETIME NULL');
  await addColumnIfNotExists(p, 'payments', 'is_settled BOOLEAN DEFAULT TRUE');
}

export async function updatePaymentsTableSchema() {
  const p = await getPool();
  try {
    await p.query("ALTER TABLE payments MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'");
  } catch (err) {
    console.log("Note: could not modify payments.status column:", err.message);
  }
  try {
    await p.query("ALTER TABLE payments MODIFY COLUMN payment_status VARCHAR(50) DEFAULT 'pending'");
  } catch (err) {
    console.log("Note: could not modify payments.payment_status column:", err.message);
  }
  try {
    await p.query("ALTER TABLE payments MODIFY COLUMN payout_status VARCHAR(50) DEFAULT 'pending'");
  } catch (err) {
    console.log("Note: could not modify payments.payout_status column:", err.message);
  }

  await addIndexIfNotExists(p, "payments", "idx_payments_order", "razorpay_order_id");
  await addIndexIfNotExists(p, "payments", "idx_payments_payment_id", "razorpay_payment_id");
  await addIndexIfNotExists(p, "payments", "idx_payments_service_request", "service_request_id");
  await addIndexIfNotExists(p, "payments", "idx_payments_technician", "technician_id");
  await addIndexIfNotExists(p, "payments", "idx_payments_statuses", "status, payment_status, payout_status");
  await addIndexIfNotExists(p, "payments", "idx_payments_payout_status_created", "payout_status, created_at");
  await addUniqueIndexIfNotExists(p, "payments", "uq_payments_payout_idempotency_key", "payout_idempotency_key");
}

const PAYMENT_RECONCILIATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT NULL,
  payment_id INT NOT NULL,
  razorpay_payment_id VARCHAR(255),
  razorpay_status VARCHAR(64),
  database_status VARCHAR(64),
  payout_gateway_status VARCHAR(64),
  payout_database_status VARCHAR(64),
  settlement_status VARCHAR(64),
  discrepancy_type VARCHAR(64) NOT NULL,
  discrepancy_details JSON,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_action VARCHAR(255),
  resolved_at DATETIME NULL,
  first_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`.trim();

const PAYMENT_RECONCILIATION_AUDIT_LOGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payment_reconciliation_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT NULL,
  payment_id INT NULL,
  discrepancy_type VARCHAR(64),
  action VARCHAR(128) NOT NULL,
  action_details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

const PAYMENT_RECONCILIATION_RUNS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payment_reconciliation_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_key VARCHAR(128) NOT NULL,
  trigger_source VARCHAR(64) NOT NULL DEFAULT 'scheduled',
  initiated_by VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  scanned_count INT DEFAULT 0,
  discrepancy_count INT DEFAULT 0,
  resolved_count INT DEFAULT 0,
  auto_resolved_count INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  notes TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`.trim();

const PAYMENT_RECONCILIATION_LOCKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payment_reconciliation_locks (
  lock_name VARCHAR(128) PRIMARY KEY,
  owner_id VARCHAR(255),
  locked_until DATETIME NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`.trim();

export async function ensurePaymentReconciliationTable() {
  const p = await getPool();
  await p.execute(PAYMENT_RECONCILIATION_TABLE_SQL);
}

const PAYOUT_BATCHES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS payout_batches (
  batch_id INT AUTO_INCREMENT PRIMARY KEY,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_payouts INT NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending'
)
`.trim();

export async function ensurePayoutBatchesTable() {
  const p = await getPool();
  await p.execute(PAYOUT_BATCHES_TABLE_SQL);
}

const BATCH_PAYOUTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS batch_payouts (
  batch_id INT NOT NULL,
  payout_id INT NOT NULL,
  PRIMARY KEY (batch_id, payout_id),
  FOREIGN KEY (batch_id) REFERENCES payout_batches(batch_id)
)
`.trim();

export async function ensureBatchPayoutsTable() {
  const p = await getPool();
  await p.execute(BATCH_PAYOUTS_TABLE_SQL);
}

const DAILY_SETTLEMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS daily_settlements (
  settlement_id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_payments DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_technician_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_payouts DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureDailySettlementsTable() {
  const p = await getPool();
  await p.execute(DAILY_SETTLEMENTS_TABLE_SQL);
}

const FRAUD_FLAGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS fraud_flags (
  flag_id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT,
  technician_id INT NOT NULL,
  flag_type VARCHAR(100) NOT NULL,
  description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  status ENUM('pending', 'investigating', 'approved', 'blocked') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
)
`.trim();

export async function ensureFraudFlagsTable() {
  const p = await getPool();
  await p.execute(FRAUD_FLAGS_TABLE_SQL);
}

const GATEWAY_TRANSACTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS gateway_transactions (
  gateway_txn_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(255),
  payment_id VARCHAR(255),
  amount DECIMAL(10, 2),
  payment_status VARCHAR(100),
  event_type VARCHAR(100),
  payload JSON,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_gateway_order (order_id),
  INDEX idx_gateway_payment (payment_id)
)
`.trim();

export async function ensureGatewayTransactionsTable() {
  const p = await getPool();
  await p.execute(GATEWAY_TRANSACTIONS_TABLE_SQL);
}

const RECONCILIATION_ERRORS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS reconciliation_errors (
  error_id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_txn_id INT,
  ledger_txn_id INT,
  difference_amount DECIMAL(10, 2),
  status ENUM('open', 'resolved', 'ignored') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureReconciliationErrorsTable() {
  const p = await getPool();
  await p.execute(RECONCILIATION_ERRORS_TABLE_SQL);
}

const FINANCE_AUDIT_LOGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS finance_audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  admin_id VARCHAR(255) NOT NULL,
  reference_id VARCHAR(255),
  details JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureFinanceAuditLogsTable() {
  const p = await getPool();
  await p.execute(FINANCE_AUDIT_LOGS_TABLE_SQL);
}

const LEDGER_ACCOUNTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ledger_accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`.trim();

export async function ensureLedgerAccountsTable() {
  const p = await getPool();
  await p.execute(LEDGER_ACCOUNTS_TABLE_SQL);
}

const LEDGER_ENTRIES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(100) NOT NULL,
  account_id INT NOT NULL,
  reference_type VARCHAR(100),
  reference_id INT,
  debit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'INR',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES ledger_accounts(account_id),
  INDEX idx_transaction (transaction_id),
  INDEX idx_reference (reference_type, reference_id)
)
`.trim();

export async function ensureLedgerEntriesTable() {
  const p = await getPool();
  await p.execute(LEDGER_ENTRIES_TABLE_SQL);
}

export async function ensurePaymentReconciliationAuditLogsTable() {
  const p = await getPool();
  await p.execute(PAYMENT_RECONCILIATION_AUDIT_LOGS_TABLE_SQL);
}

export async function ensurePaymentReconciliationRunsTable() {
  const p = await getPool();
  await p.execute(PAYMENT_RECONCILIATION_RUNS_TABLE_SQL);
}

export async function ensurePaymentReconciliationLocksTable() {
  const p = await getPool();
  await p.execute(PAYMENT_RECONCILIATION_LOCKS_TABLE_SQL);
}

export async function updatePaymentReconciliationSchema() {
  const p = await getPool();

  await addColumnIfNotExists(p, "payment_reconciliation", "run_id BIGINT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation", "payment_id INT NOT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation", "razorpay_payment_id VARCHAR(255)");
  await addColumnIfNotExists(p, "payment_reconciliation", "razorpay_status VARCHAR(64)");
  await addColumnIfNotExists(p, "payment_reconciliation", "database_status VARCHAR(64)");
  await addColumnIfNotExists(p, "payment_reconciliation", "payout_gateway_status VARCHAR(64)");
  await addColumnIfNotExists(p, "payment_reconciliation", "payout_database_status VARCHAR(64)");
  await addColumnIfNotExists(p, "payment_reconciliation", "settlement_status VARCHAR(64)");
  await addColumnIfNotExists(p, "payment_reconciliation", "discrepancy_type VARCHAR(64) NOT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation", "discrepancy_details JSON");
  await addColumnIfNotExists(p, "payment_reconciliation", "resolved BOOLEAN DEFAULT FALSE");
  await addColumnIfNotExists(p, "payment_reconciliation", "resolution_action VARCHAR(255)");
  await addColumnIfNotExists(p, "payment_reconciliation", "resolved_at DATETIME NULL");
  await addColumnIfNotExists(p, "payment_reconciliation", "first_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfNotExists(p, "payment_reconciliation", "last_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfNotExists(p, "payment_reconciliation", "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

  await addColumnIfNotExists(p, "payment_reconciliation_audit_logs", "run_id BIGINT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_audit_logs", "payment_id INT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_audit_logs", "discrepancy_type VARCHAR(64)");
  await addColumnIfNotExists(p, "payment_reconciliation_audit_logs", "action VARCHAR(128) NOT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_audit_logs", "action_details JSON");

  await addColumnIfNotExists(p, "payment_reconciliation_runs", "run_key VARCHAR(128) NOT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "trigger_source VARCHAR(64) NOT NULL DEFAULT 'scheduled'");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "initiated_by VARCHAR(255) NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "status VARCHAR(32) NOT NULL DEFAULT 'running'");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "scanned_count INT DEFAULT 0");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "discrepancy_count INT DEFAULT 0");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "resolved_count INT DEFAULT 0");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "auto_resolved_count INT DEFAULT 0");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "errors_count INT DEFAULT 0");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "notes TEXT");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "started_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "finished_at DATETIME NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_runs", "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

  await addColumnIfNotExists(p, "payment_reconciliation_locks", "owner_id VARCHAR(255)");
  await addColumnIfNotExists(p, "payment_reconciliation_locks", "locked_until DATETIME NOT NULL");
  await addColumnIfNotExists(p, "payment_reconciliation_locks", "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

  await addIndexIfNotExists(p, "payment_reconciliation", "idx_recon_payment_resolved", "payment_id, resolved");
  await addIndexIfNotExists(p, "payment_reconciliation", "idx_recon_discrepancy_resolved", "discrepancy_type, resolved");
  await addIndexIfNotExists(p, "payment_reconciliation", "idx_recon_last_detected", "last_detected_at");
  await addIndexIfNotExists(p, "payment_reconciliation", "idx_recon_run_id", "run_id");

  await addIndexIfNotExists(p, "payment_reconciliation_audit_logs", "idx_recon_audit_run_created", "run_id, created_at");
  await addIndexIfNotExists(p, "payment_reconciliation_audit_logs", "idx_recon_audit_payment_created", "payment_id, created_at");
  await addIndexIfNotExists(p, "payment_reconciliation_audit_logs", "idx_recon_audit_action_created", "action, created_at");

  await addUniqueIndexIfNotExists(p, "payment_reconciliation_runs", "uq_recon_runs_run_key", "run_key");
  await addIndexIfNotExists(p, "payment_reconciliation_runs", "idx_recon_runs_status_started", "status, started_at");
  await addIndexIfNotExists(p, "payment_reconciliation_runs", "idx_recon_runs_trigger_started", "trigger_source, started_at");
}

const TECHNICIAN_DUES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS technician_dues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  service_request_id INT,
  amount DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(255),
  status ENUM('pending', 'paid') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id),
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id)
)
`.trim();

export async function ensureTechnicianDuesTable() {
  const p = await getPool();
  await p.execute(TECHNICIAN_DUES_TABLE_SQL);
  await addColumnIfNotExists(p, 'technician_dues', 'service_request_id INT');
}

// Invoices table keeps generated invoice PDF in TiDB (LONGBLOB) for Render-safe storage.
const INVOICES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  razorpay_payment_id VARCHAR(255),
  amount DECIMAL(10,2),
  invoice_pdf LONGBLOB,
  status VARCHAR(50) DEFAULT 'GENERATED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  service_request_id INT,
  technician_id INT,
  platform_fee DECIMAL(12,2) DEFAULT 0.00,
  technician_amount DECIMAL(12,2) DEFAULT 0.00,
  gst DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  FOREIGN KEY (service_request_id) REFERENCES service_requests(id)
)
`.trim();

export async function ensureInvoicesTable() {
  const p = await getPool();
  await p.execute(INVOICES_TABLE_SQL);
  await addColumnIfNotExists(p, 'invoices', 'user_id INT NOT NULL DEFAULT 0');
  await addColumnIfNotExists(p, 'invoices', 'order_id VARCHAR(255) NOT NULL DEFAULT ""');
  await addColumnIfNotExists(p, 'invoices', 'razorpay_payment_id VARCHAR(255)');
  await addColumnIfNotExists(p, 'invoices', 'amount DECIMAL(10,2)');
  await addColumnIfNotExists(p, 'invoices', 'invoice_pdf LONGBLOB');
  await addColumnIfNotExists(p, 'invoices', 'status VARCHAR(50) DEFAULT "GENERATED"');
  await addColumnIfNotExists(p, 'invoices', 'service_request_id INT');
  await addColumnIfNotExists(p, 'invoices', 'technician_id INT');
  await addColumnIfNotExists(p, 'invoices', 'platform_fee DECIMAL(12,2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'invoices', 'technician_amount DECIMAL(12,2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'invoices', 'gst DECIMAL(12,2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'invoices', 'total_amount DECIMAL(12,2) DEFAULT 0.00');
}

const PLATFORM_PRICING_CONFIG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS platform_pricing_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  platform_fee_percent DECIMAL(8,6) NOT NULL DEFAULT 0.100000,
  welcome_coupon_code VARCHAR(64) NOT NULL DEFAULT 'RESQ10',
  welcome_coupon_discount_percent DECIMAL(8,6) NOT NULL DEFAULT 0.100000,
  welcome_coupon_max_uses_per_user INT NOT NULL DEFAULT 2,
  welcome_coupon_active BOOLEAN DEFAULT TRUE,
  registration_fee DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  booking_fee DECIMAL(12,2) NOT NULL DEFAULT 199.00,
  pay_now_discount_percent DECIMAL(8,6) NOT NULL DEFAULT 0.000000,
  default_service_amount DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  service_base_prices JSON,
  subscription_plans JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
`.trim();

export async function ensurePlatformPricingConfigTable() {
  const p = await getPool();
  await p.execute(PLATFORM_PRICING_CONFIG_TABLE_SQL);
  await addColumnIfNotExists(p, 'platform_pricing_config', 'currency VARCHAR(10) NOT NULL DEFAULT "INR"');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'platform_fee_percent DECIMAL(8,6) NOT NULL DEFAULT 0.100000');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'welcome_coupon_code VARCHAR(64) NOT NULL DEFAULT "RESQ10"');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'welcome_coupon_discount_percent DECIMAL(8,6) NOT NULL DEFAULT 0.100000');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'welcome_coupon_max_uses_per_user INT NOT NULL DEFAULT 2');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'welcome_coupon_active BOOLEAN DEFAULT TRUE');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'registration_fee DECIMAL(12,2) NOT NULL DEFAULT 500.00');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'booking_fee DECIMAL(12,2) NOT NULL DEFAULT 199.00');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'pay_now_discount_percent DECIMAL(8,6) NOT NULL DEFAULT 0.000000');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'default_service_amount DECIMAL(12,2) NOT NULL DEFAULT 500.00');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'service_base_prices JSON');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'subscription_plans JSON');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'is_active BOOLEAN DEFAULT TRUE');
  await addColumnIfNotExists(p, 'platform_pricing_config', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
}

const TECHNICIAN_APPROVAL_AUDIT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS technician_approval_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  technician_id INT NOT NULL,
  action ENUM('approved', 'rejected') NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  reason TEXT,
  admin_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
)
`.trim();

export async function ensureTechnicianApprovalAuditTable() {
  const p = await getPool();
  await p.execute(TECHNICIAN_APPROVAL_AUDIT_TABLE_SQL);
  await addColumnIfNotExists(p, 'technician_approval_audit', 'reason TEXT');
  await addColumnIfNotExists(p, 'technician_approval_audit', 'previous_status VARCHAR(50)');
  await addColumnIfNotExists(p, 'technician_approval_audit', 'admin_email VARCHAR(255)');
}

export async function updateServiceRequestsTableSchema() {
  const p = await getPool();
  // Add fields that may be missing on older DB installs
  await addColumnIfNotExists(p, 'service_requests', 'vehicle_model VARCHAR(255)');
  await addColumnIfNotExists(p, 'service_requests', 'vehicle_type VARCHAR(100)');
  await addColumnIfNotExists(p, 'service_requests', 'description TEXT');
  await addColumnIfNotExists(p, 'service_requests', 'service_charge DECIMAL(10,2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'service_requests', 'applied_coupon_code VARCHAR(64)');
  await addColumnIfNotExists(p, 'service_requests', 'applied_discount_percent DECIMAL(8,6) DEFAULT 0.000000');
  await addColumnIfNotExists(p, 'service_requests', 'applied_discount_amount DECIMAL(10,2) DEFAULT 0.00');
  await addColumnIfNotExists(p, 'service_requests', 'payment_method VARCHAR(50)');
  await addColumnIfNotExists(p, 'service_requests', 'contact_name VARCHAR(255)');
  await addColumnIfNotExists(p, 'service_requests', 'contact_email VARCHAR(255)');
  await addColumnIfNotExists(p, 'service_requests', 'contact_phone VARCHAR(50)');
  await addColumnIfNotExists(p, 'service_requests', 'address VARCHAR(512)');
  await addColumnIfNotExists(p, 'service_requests', 'location_lat FLOAT');
  await addColumnIfNotExists(p, 'service_requests', 'location_lng FLOAT');
  await addColumnIfNotExists(p, 'service_requests', 'started_at TIMESTAMP NULL');
  await addColumnIfNotExists(p, 'service_requests', 'completed_at TIMESTAMP NULL');
  await addColumnIfNotExists(p, 'service_requests', 'cancelled_at TIMESTAMP NULL');
  await addColumnIfNotExists(p, 'service_requests', 'cancellation_reason VARCHAR(512)');
  await addColumnIfNotExists(p, 'service_requests', 'closing_reason VARCHAR(512)');
  await addColumnIfNotExists(p, 'service_requests', 'accepted_time DATETIME NULL');
  await addColumnIfNotExists(p, 'service_requests', 'start_time DATETIME NULL');
  await addColumnIfNotExists(p, 'service_requests', 'scheduled_time DATETIME NULL');
  await addColumnIfNotExists(p, 'service_requests', 'sla_deadline DATETIME NULL');
  await addColumnIfNotExists(p, 'service_requests', 'customer_location_lat DECIMAL(10, 8)');
  await addColumnIfNotExists(p, 'service_requests', 'customer_location_lng DECIMAL(11, 8)');

  // Ensure status column can hold longer status strings like 'payment_pending'
  try {
    // Changing to VARCHAR(50) to be flexible and avoid "Data too long" for longer status strings
    await p.query("ALTER TABLE service_requests MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'");
  } catch (err) {
    // Ignore if modify fails on some DB versions, but log for visibility
    console.log("Note: could not modify service_requests.status column:", err.message);
  }

  try {
    await p.query("ALTER TABLE service_requests MODIFY COLUMN payment_status VARCHAR(50) DEFAULT 'pending'");
  } catch (err) {
    console.log("Note: could not modify service_requests.payment_status column:", err.message);
  }

  try {
    await p.query("ALTER TABLE service_requests MODIFY COLUMN cancellation_reason VARCHAR(1024)");
  } catch (err) {
    console.log("Note: could not modify service_requests.cancellation_reason column:", err.message);
  }

  // Monitoring and admin filters rely heavily on these columns.
  await addIndexIfNotExists(p, "service_requests", "idx_service_requests_status", "status");
  await addIndexIfNotExists(p, "service_requests", "idx_service_requests_technician_status", "technician_id, status");
  await addIndexIfNotExists(p, "service_requests", "idx_service_requests_created_at", "created_at");
  await addIndexIfNotExists(p, "service_requests", "idx_service_requests_updated_at", "updated_at");
}

export async function updateUsersTableSchema() {
  const p = await getPool();
  await addColumnIfNotExists(p, 'users', 'role VARCHAR(32) DEFAULT "user"');
  await addColumnIfNotExists(p, 'users', 'subscription VARCHAR(50) DEFAULT "free"');
  await addColumnIfNotExists(p, 'users', 'phone VARCHAR(50)');
  await addColumnIfNotExists(p, 'users', 'birthday DATE');
  await addColumnIfNotExists(p, 'users', 'gender VARCHAR(20)');
  await addColumnIfNotExists(p, 'users', 'settings JSON');
}
