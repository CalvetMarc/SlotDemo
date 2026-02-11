import app from './app.js';
import { sql } from './db.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function ensureSchema(): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            balance NUMERIC(12, 2) NOT NULL DEFAULT 99999.00,
            game_phase TEXT NOT NULL DEFAULT 'base',
            bonus_data JSONB,
            last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `;
    // Add bonus_data column if missing (existing tables)
    await sql`
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS bonus_data JSONB
    `;
}

ensureSchema()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
