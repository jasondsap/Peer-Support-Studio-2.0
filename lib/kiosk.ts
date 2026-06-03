import { randomBytes, randomInt } from 'crypto';
import { sql } from '@/lib/db';

// Unambiguous alphabet (no O/0/I/1) for human-readable participant codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateKioskToken(): string {
    return randomBytes(24).toString('hex'); // 48 hex chars
}

function randomCode(len = 8): string {
    let out = '';
    for (let i = 0; i < len; i++) {
        out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    return out;
}

// Generate a kiosk_code unique within the org (retry on collision).
export async function generateUniqueKioskCode(organizationId: string): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = randomCode(8);
        const existing = await sql`
            SELECT 1 FROM participants
            WHERE organization_id = ${organizationId}::uuid AND kiosk_code = ${code}
            LIMIT 1
        `;
        if (existing.length === 0) return code;
    }
    // Extremely unlikely; widen with a longer code as a fallback.
    return randomCode(10);
}
