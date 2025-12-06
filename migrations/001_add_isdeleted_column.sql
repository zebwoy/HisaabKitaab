-- Migration: Add IsDeleted column for soft delete functionality
-- Date: 2025-12-06
-- Description: Adds IsDeleted column to transactions table to enable soft delete

-- Add IsDeleted column with default value 'N'
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS IsDeleted CHAR(1) DEFAULT 'N' NOT NULL;

-- Update existing records to have IsDeleted = 'N' if they're NULL
UPDATE transactions 
SET IsDeleted = 'N' 
WHERE IsDeleted IS NULL OR IsDeleted = '';

-- Create index for better query performance when filtering by IsDeleted
CREATE INDEX IF NOT EXISTS idx_transactions_isdeleted 
ON transactions(IsDeleted);

-- Add comment to column
COMMENT ON COLUMN transactions.IsDeleted IS 'Soft delete flag: Y = deleted, N = active';
