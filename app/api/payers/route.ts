import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';

// =============================================
// PAYERS API
// File: app/api/payers/route.ts
//
// Returns payer records, optionally filtered by state and type.
// Used by the intake form to dynamically populate MCO dropdowns.
// =============================================

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const state = searchParams.get('state');
        const payerType = searchParams.get('type');

        const conditions: string[] = ['active = true'];
        const values: unknown[] = [];
        let paramIdx = 1;

        if (state && state !== 'other') {
            conditions.push(`state = $${paramIdx}`);
            values.push(state);
            paramIdx++;
        }

        if (payerType) {
            conditions.push(`payer_type = $${paramIdx}`);
            values.push(payerType);
            paramIdx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const queryText = `
            SELECT id, payer_name, payer_id, payer_type, state, phone, notes
            FROM payers
            ${whereClause}
            ORDER BY payer_name
        `;

        const results = await sql(queryText, values);

        return NextResponse.json({ success: true, payers: results });
    } catch (error) {
        console.error('Error fetching payers:', error);
        return NextResponse.json({ error: 'Failed to fetch payers' }, { status: 500 });
    }
}
