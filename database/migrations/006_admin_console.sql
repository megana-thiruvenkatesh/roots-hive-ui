-- Migration: Expand users and knowledge base for Admin Console

-- Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS clearance VARCHAR(255) DEFAULT 'SOP, PUBLIC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) DEFAULT 'EMP-ROO001';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact VARCHAR(100) DEFAULT '+91 98765 43210 / Ext. 204';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_shift VARCHAR(60) DEFAULT 'Morning (06:00 - 14:00)';

-- Add columns to kb_documents table
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS root_cause TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS solution TEXT;
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'Medium';
ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS tags VARCHAR(255);

-- Seed specific users from mock console if they don't already exist
-- Default password for all seeded users is 'password123'
INSERT INTO users (name, email, password_hash, dept, role_key, role_label, is_admin, clearance, is_online)
VALUES
  ('Priya Krishnamurthy', 'priya@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'Engineering', 'QUALITY_WORKER', 'Production Engineer', FALSE, 'SOP, PUBLIC', TRUE),
  ('Ravi Murugesan', 'ravi@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'Quality', 'QUALITY_WORKER', 'Quality Manager', FALSE, 'SOP, PUBLIC', TRUE),
  ('Anitha Selvam', 'anitha@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'Maintenance', 'QUALITY_WORKER', 'Maintenance Lead', FALSE, 'SOP, PUBLIC', FALSE),
  ('Karthik Rajendran', 'karthik@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'Management', 'DEPT_HOD', 'Plant Manager', FALSE, 'SOP, ERP, PUBLIC', TRUE),
  ('Root Hive Admin', 'admin@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'IT Security', 'MANAGEMENT', 'System Administrator', TRUE, 'ALL, ADMIN', TRUE),
  ('Suresh Venkataraman', 'suresh@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'Sales', 'USER', 'Sales Executive', FALSE, 'PUBLIC', TRUE),
  ('Meena Radhakrishnan', 'meena@sfwtechnologies.com', '$2a$10$n4kUnOGegNt6SIPN1sA1oOwr7kCdDkHekVO.jgAKFA1.pYInAMW.K', 'HR', 'USER', 'HR Manager', FALSE, 'PUBLIC', TRUE)
ON CONFLICT (email) DO UPDATE SET
  job_title = EXCLUDED.role_label,
  role_label = EXCLUDED.role_label,
  dept = EXCLUDED.dept,
  clearance = EXCLUDED.clearance,
  is_online = EXCLUDED.is_online,
  is_admin = EXCLUDED.is_admin;
