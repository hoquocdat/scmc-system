-- Migration: Add 'comment' and 'service_item' to image_entity_type enum
-- Description: Allows comments and service items (tasks) to have images attached

-- Add 'comment' value to the image_entity_type enum
ALTER TYPE image_entity_type ADD VALUE IF NOT EXISTS 'comment';

-- Add 'service_item' value to the image_entity_type enum
ALTER TYPE image_entity_type ADD VALUE IF NOT EXISTS 'service_item';
