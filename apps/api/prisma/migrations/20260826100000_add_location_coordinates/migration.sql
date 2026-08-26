-- AlterTable: Add latitude and longitude columns to locations table
-- These are nullable so existing rows are not affected
ALTER TABLE "locations" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
