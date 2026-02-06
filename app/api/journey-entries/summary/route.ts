import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET - Fetch current status for a participant across all domains
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');

        if (!organizationId || !participantId) {
            return NextResponse.json({ error: 'organization_id and participant_id required' }, { status: 400 });
        }

        // Get all active domains for the org
        const domains = await sql`
            SELECT 
                id,
                domain_key,
                domain_label,
                description,
                statuses,
                color,
                icon,
                display_order
            FROM journey_domains
            WHERE organization_id = ${organizationId}
            AND is_active = true
            ORDER BY display_order, domain_label
        `;

        // Get the latest entry for each domain for this participant
        const currentStatuses = await sql`
            SELECT DISTINCT ON (je.domain_id)
                je.domain_id,
                je.status_key,
                je.status_label,
                je.entry_date,
                je.notes,
                je.is_milestone
            FROM journey_entries je
            WHERE je.organization_id = ${organizationId}
            AND je.participant_id = ${participantId}
            ORDER BY je.domain_id, je.entry_date DESC, je.created_at DESC
        `;

        // Get entry counts per domain
        const entryCounts = await sql`
            SELECT 
                domain_id,
                COUNT(*) as entry_count,
                MIN(entry_date) as first_entry,
                MAX(entry_date) as last_entry
            FROM journey_entries
            WHERE organization_id = ${organizationId}
            AND participant_id = ${participantId}
            GROUP BY domain_id
        `;

        // Build status map
        const statusMap = new Map(currentStatuses.map((s: any) => [s.domain_id, s]));
        const countMap = new Map(entryCounts.map((c: any) => [c.domain_id, c]));

        // Combine domains with their current status
        const summary = domains.map((domain: any) => {
            const currentStatus = statusMap.get(domain.id);
            const counts = countMap.get(domain.id);
            
            return {
                domain_id: domain.id,
                domain_key: domain.domain_key,
                domain_label: domain.domain_label,
                description: domain.description,
                color: domain.color,
                icon: domain.icon,
                statuses: domain.statuses,
                current_status: currentStatus ? {
                    status_key: currentStatus.status_key,
                    status_label: currentStatus.status_label,
                    entry_date: currentStatus.entry_date,
                    notes: currentStatus.notes,
                    is_milestone: currentStatus.is_milestone
                } : null,
                entry_count: counts?.entry_count || 0,
                first_entry: counts?.first_entry || null,
                last_entry: counts?.last_entry || null
            };
        });

        // Get overall stats
        const totalEntries = await sql`
            SELECT COUNT(*) as count
            FROM journey_entries
            WHERE organization_id = ${organizationId}
            AND participant_id = ${participantId}
        `;

        const milestones = await sql`
            SELECT COUNT(*) as count
            FROM journey_entries
            WHERE organization_id = ${organizationId}
            AND participant_id = ${participantId}
            AND is_milestone = true
        `;

        return NextResponse.json({ 
            success: true, 
            summary,
            stats: {
                total_entries: parseInt(totalEntries[0]?.count || '0'),
                total_milestones: parseInt(milestones[0]?.count || '0'),
                domains_tracked: summary.filter((s: any) => s.current_status).length,
                total_domains: domains.length
            }
        });
    } catch (error) {
        console.error('Error fetching journey summary:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
