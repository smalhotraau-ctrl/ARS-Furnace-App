-- Common schema — shared user registry for Furnace RLS
-- Run this before database/schema.sql

CREATE SCHEMA IF NOT EXISTS common;

CREATE TABLE common.users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username   text NOT NULL UNIQUE,
  role       text NOT NULL CHECK (role IN ('supervisor', 'qa', 'plant_head', 'admin_owner')),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
