import { NextRequest, NextResponse } from 'next/server';
import { getSession, getInternalUserId, requireOrgAccess } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET - Lightweight global search (org-scoped) across participants + their goals.
// Returns a small unified result list, each linking to the participant 360 hub.
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await getInternalUserId(session.user.id, session.user.email);
        if (!userId) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const searchParams = request.nextUrl.searchParams;
        const q = (searchParams.get('q') || searchParams.get('search') || '').trim();
        const organizationId =
            searchParams.get('organization_id') ||
            searchParams.get('organizationId') ||
            (session as any)?.currentOrganization?.id;

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
        }

        if (q.length < 2) {
            return NextResponse.json({ results: [] });
        }

        // Verify org access before touching PHI
        try {
            await requireOrgAccess(organizationId);
        } catch {
            return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
        }

        const pattern = `%${q.toLowerCase()}%`;
        const digitsOnly = q.replace(/\D/g, '');
        const phonePattern = `%${digitsOnly}%`;
        const phoneEnabled = digitsOnly.length >= 3;

        const results: any[] = [];

        // Participants — name / email / phone
        try {
            const participants = await sql`
                SELECT p.id, p.first_name, p.last_name, p.preferred_name,
                       p.email, p.phone, p.status
                FROM participants p
                WHERE p.organization_id = ${organizationId}::uuid
                  AND (
                      LOWER(p.first_name) LIKE ${pattern}
                      OR LOWER(p.last_name) LIKE ${pattern}
                      OR LOWER(COALESCE(p.preferred_name, '')) LIKE ${pattern}
                      OR LOWER(p.first_name || ' ' || p.last_name) LIKE ${pattern}
                      OR LOWER(COALESCE(p.email, '')) LIKE ${pattern}
                      OR (${phoneEnabled} AND regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g') LIKE ${phonePattern})
                  )
                ORDER BY p.last_name, p.first_name
                LIMIT 8
            `;
            for (const p of participants) {
                results.push({
                    type: 'participant',
                    id: p.id,
                    participant_id: p.id,
                    title: `${p.preferred_name || p.first_name} ${p.last_name}`,
                    subtitle: p.email || p.phone || (p.status ? `Status: ${p.status}` : ''),
                    href: `/participants/${p.id}`,
                });
            }
        } catch (e) {
            console.error('Search participants failed:', e);
        }

        // Goals — match goal text, link to the owning participant
        if (results.length < 8) {
            try {
                const goals = await sql`
                    SELECT g.id, g.smart_goal, g.participant_id,
                           p.first_name, p.last_name, p.preferred_name
                    FROM saved_goals g
                    JOIN participants p ON p.id = g.participant_id
                    WHERE p.organization_id = ${organizationId}::uuid
                      AND g.status != 'abandoned'
                      AND LOWER(COALESCE(g.smart_goal, '')) LIKE ${pattern}
                    ORDER BY g.created_at DESC
                    LIMIT ${8 - results.length}
                `;
                for (const g of goals) {
                    results.push({
                        type: 'goal',
                        id: g.id,
                        participant_id: g.participant_id,
                        title: g.smart_goal && g.smart_goal.length > 80
                            ? `${g.smart_goal.slice(0, 80)}…`
                            : (g.smart_goal || 'Goal'),
                        subtitle: `Goal · ${g.preferred_name || g.first_name} ${g.last_name}`,
                        href: `/participants/${g.participant_id}`,
                    });
                }
            } catch (e) {
                console.error('Search goals failed:', e);
            }
        }

        return NextResponse.json({ results: results.slice(0, 8) });
    } catch (error) {
        console.error('Global search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
