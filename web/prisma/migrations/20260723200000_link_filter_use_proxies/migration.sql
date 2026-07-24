-- Add useProxies toggle to link-filter jobs

ALTER TABLE "LinkFilterJob" ADD COLUMN "useProxies" BOOLEAN NOT NULL DEFAULT true;
