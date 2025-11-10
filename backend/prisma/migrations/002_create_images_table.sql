-- Create enum for entity types that can have images
CREATE TYPE image_entity_type AS ENUM ('bike', 'service_order', 'customer', 'part');

-- Create images table
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type image_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'bikes',
  public_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_images_entity ON images(entity_type, entity_id);
CREATE INDEX idx_images_entity_id ON images(entity_id);
CREATE INDEX idx_images_uploaded_by ON images(uploaded_by);
CREATE INDEX idx_images_is_primary ON images(entity_type, entity_id, is_primary);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_images_updated_at
  BEFORE UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_images_updated_at();

-- Add comment
COMMENT ON TABLE images IS 'Stores image metadata for bikes, service orders, customers, and parts';
COMMENT ON COLUMN images.entity_type IS 'Type of entity the image belongs to';
COMMENT ON COLUMN images.entity_id IS 'ID of the entity (bike_id, service_order_id, etc.)';
COMMENT ON COLUMN images.file_path IS 'Path in storage bucket';
COMMENT ON COLUMN images.public_url IS 'Public URL to access the image';
COMMENT ON COLUMN images.display_order IS 'Order for displaying images (0 = first)';
COMMENT ON COLUMN images.is_primary IS 'Whether this is the primary/featured image';
