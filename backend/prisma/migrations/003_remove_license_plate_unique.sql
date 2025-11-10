-- Remove unique constraint on license_plate
-- In Vietnam, license plates belong to owners and can be transferred between motorcycles
-- So the same license plate can be associated with different motorcycles over time

ALTER TABLE bikes DROP CONSTRAINT IF EXISTS bikes_license_plate_key;

-- The index idx_bikes_license will remain for query performance
