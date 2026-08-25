-- Extra complaint form fields (reference UI)
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS part_code VARCHAR(120);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS lot_qty NUMERIC;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS defect_qty NUMERIC;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS rejection_pct NUMERIC;
