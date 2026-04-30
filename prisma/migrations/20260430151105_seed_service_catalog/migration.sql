-- Seed the canonical service catalog idempotently. These rows are fixed
-- platform data (not user-generated), so they ship with the code and run
-- on every environment via `prisma migrate deploy`. Future services need
-- a new migration with their own INSERT.
--
-- ON CONFLICT DO NOTHING keeps the migration safe to re-run AND preserves
-- any per-deployment edits made through admin tools (price tweaks, label
-- corrections) — we never overwrite live rows.

INSERT INTO services (key, label, short, color, description, "unitPrice", active)
VALUES
  ('epc',
   'Energy Performance Certificate', 'EPC', 'var(--color-epc)',
   'Legally required energy rating for every sale or rental.',
   16500, TRUE),
  ('asbestos',
   'Asbestos Inventory Attest', 'AIV', 'var(--color-asbestos)',
   'Mandatory asbestos inventory for buildings from before 2001.',
   24500, TRUE),
  ('electrical',
   'Electrical Inspection', 'EK', 'var(--color-electrical)',
   'AREI installation inspection for safe electrical systems.',
   19500, TRUE),
  ('fuel',
   'Fuel Tank Check', 'TK', 'var(--color-fuel)',
   'Periodic inspection for above-ground and buried fuel tanks.',
   13500, TRUE),
  ('photos',
   'Property Photography', 'PH', 'var(--color-photos)',
   'Professional listing photography for sales and rentals.',
   15000, TRUE),
  ('signage',
   'On-site Signage', 'SG', 'var(--color-signage)',
   'Mounted For-Sale / For-Rent signage at the property.',
   7500, TRUE)
ON CONFLICT (key) DO NOTHING;
