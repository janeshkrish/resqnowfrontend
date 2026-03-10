-- Run this in your database (e.g. USE test; or USE resqnow;) if you prefer manual setup.
-- The server also creates this table automatically on startup when using TiDB/MySQL.
CREATE TABLE IF NOT EXISTS technicians (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  phone VARCHAR(50),
  proprietor_name VARCHAR(255),
  alternate_phone VARCHAR(50),
  whatsapp_number VARCHAR(50),
  service_type VARCHAR(100),
  location VARCHAR(255),
  address VARCHAR(512),
  region VARCHAR(255),
  district VARCHAR(255),
  state VARCHAR(255),
  locality VARCHAR(255),
  google_maps_link VARCHAR(512),
  aadhaar_number VARCHAR(50),
  pan_number VARCHAR(50),
  business_type VARCHAR(50),
  gst_number VARCHAR(50),
  trade_license_number VARCHAR(50),
  service_area_range INT DEFAULT 10,
  experience INT DEFAULT 0,
  specialties JSON,
  pricing JSON,
  working_hours JSON,
  service_costs JSON,
  payment_details JSON,
  app_readiness JSON,
  vehicle_types JSON,
  documents JSON,
  resume_url VARCHAR(512),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  is_active BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT FALSE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

-- Admin Finance System Extensions

CREATE TABLE IF NOT EXISTS payout_batches (
  batch_id INT AUTO_INCREMENT PRIMARY KEY,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_payouts INT NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS batch_payouts (
  batch_id INT NOT NULL,
  payout_id INT NOT NULL, -- references payments.id where payout is needed
  PRIMARY KEY (batch_id, payout_id),
  FOREIGN KEY (batch_id) REFERENCES payout_batches(batch_id)
);

CREATE TABLE IF NOT EXISTS daily_settlements (
  settlement_id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_payments DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_technician_earnings DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_payouts DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_flags (
  flag_id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT, -- references service_requests.id
  technician_id INT NOT NULL,
  flag_type VARCHAR(100) NOT NULL,
  description TEXT,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  status ENUM('pending', 'investigating', 'approved', 'blocked') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
);

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
);

-- Note: reconciliation_errors is already mostly handled by payment_reconciliation, 
-- but we create this explicit one as requested for Phase 6.
CREATE TABLE IF NOT EXISTS reconciliation_errors (
  error_id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_txn_id INT,
  ledger_txn_id INT,
  difference_amount DECIMAL(10, 2),
  status ENUM('open', 'resolved', 'ignored') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  admin_id VARCHAR(255) NOT NULL, -- email or ID
  reference_id VARCHAR(255), -- Could be batch_id, flag_id, etc.
  details JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Double-Entry Ledger System

CREATE TABLE IF NOT EXISTS ledger_accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(100) NOT NULL, -- logical grouping
  account_id INT NOT NULL,
  reference_type VARCHAR(100), -- 'service_request', 'payout_batch', 'settlement'
  reference_id INT,
  debit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'INR',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES ledger_accounts(account_id),
  INDEX idx_transaction (transaction_id),
  INDEX idx_reference (reference_type, reference_id)
);

