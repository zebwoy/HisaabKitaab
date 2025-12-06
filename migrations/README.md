# Database Migrations

This directory contains SQL migration scripts for database schema changes.

## Migration: Add IsDeleted Column (001_add_isdeleted_column.sql)

This migration adds soft delete functionality to the transactions table.

### What it does:
- Adds `IsDeleted` column (CHAR(1)) with default value 'N'
- Sets existing records to 'N' if they're NULL
- Creates an index on `IsDeleted` for better query performance

### How to run:

1. **Using Neon Console (Recommended):**
   - Log into your Neon dashboard
   - Go to your database
   - Open the SQL Editor
   - Copy and paste the contents of `001_add_isdeleted_column.sql`
   - Execute the script

2. **Using psql command line:**
   ```bash
   psql "YOUR_NEON_CONNECTION_STRING" -f migrations/001_add_isdeleted_column.sql
   ```

3. **Using a database client:**
   - Connect to your Neon database
   - Open and execute the migration file

### After running the migration:
- Transactions will now use soft delete (marked as deleted instead of removed)
- Existing transactions remain visible (IsDeleted = 'N')
- New transactions default to IsDeleted = 'N'
- Deleted transactions are marked with IsDeleted = 'Y' and hidden from queries
