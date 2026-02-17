import { sql } from '../db.js';

export interface SessionRow {
    balance: string;
    game_phase: string;
    bonus_data: Record<string, unknown> | null;
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
    const rows = await sql`
        SELECT balance, game_phase, bonus_data FROM sessions WHERE id = ${sessionId}
    `;
    return rows.length > 0 ? (rows[0] as SessionRow) : null;
}
