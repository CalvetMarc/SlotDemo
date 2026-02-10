import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

/** Neon serverless SQL tagged template — works in both serverless and local. */
export const sql = neon(DATABASE_URL);
