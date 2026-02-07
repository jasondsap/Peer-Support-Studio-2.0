import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

// GET - Generate insights for a participant's journey
export async function GET(request: NextRequest) {
    try {
        // TODO: Add proper auth check based on your auth setup
        // const session = await getServerSession(authOptions);
        // if (!session?.user) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');
        const participantId = searchParams.get('participant_id');

        if (!organizationId || !participantId) {
            return NextResponse.json({ error: 'organization_id and participant_id required' }, { status: 400 });
        }

        // Fetch all domains with their statuses
        const domains = await sql`
            SELECT id, domain_key, domain_label, statuses, color
            FROM journey_domains
            WHERE organization_id = ${organizationId}
            AND is_active = true
        `;

        // Fetch all entries for this participant, ordered by date
        const entries = await sql`
            SELECT 
                je.id,
                je.domain_id,
                jd.domain_key,
                jd.domain_label,
                je.status_key,
                je.status_label,
                je.entry_date,
                je.is_milestone,
                je.milestone_type,
                je.notes
            FROM journey_entries je
            JOIN journey_domains jd ON jd.id = je.domain_id
            WHERE je.organization_id = ${organizationId}
            AND je.participant_id = ${participantId}
            ORDER BY je.entry_date ASC, je.created_at ASC
        `;

        if (entries.length === 0) {
            return NextResponse.json({ success: true, insights: [] });
        }

        // Build a status order lookup for each domain
        const domainStatusOrder: Record<string, Record<string, number>> = {};
        const domainStatusCount: Record<string, number> = {};
        domains.forEach((d: any) => {
            const statuses = typeof d.statuses === 'string' ? JSON.parse(d.statuses) : d.statuses;
            domainStatusOrder[d.id] = {};
            domainStatusCount[d.id] = statuses.length;
            statuses.forEach((s: any) => {
                domainStatusOrder[d.id][s.key] = s.order;
            });
        });

        const getOrder = (domainId: string, statusKey: string): number => {
            return domainStatusOrder[domainId]?.[statusKey] ?? -1;
        };

        const getMaxOrder = (domainId: string): number => {
            return (domainStatusCount[domainId] || 6) - 1;
        };

        const isNegative = (domainId: string, statusKey: string): boolean => {
            const order = getOrder(domainId, statusKey);
            const max = getMaxOrder(domainId);
            return order >= 0 && order <= Math.floor(max * 0.33);
        };

        const isPositive = (domainId: string, statusKey: string): boolean => {
            const order = getOrder(domainId, statusKey);
            const max = getMaxOrder(domainId);
            return order >= Math.floor(max * 0.66);
        };

        const parseDate = (d: any): Date => {
            if (!d) return new Date();
            // If it's already a Date object, return it
            if (d instanceof Date) {
                return isNaN(d.getTime()) ? new Date() : d;
            }
            // If it's a string, parse it
            if (typeof d === 'string') {
                const dateStr = d.includes('T') ? d : d + 'T00:00:00';
                const parsed = new Date(dateStr);
                return isNaN(parsed.getTime()) ? new Date() : parsed;
            }
            // Fallback
            return new Date();
        };

        const daysBetween = (a: string, b: string): number => {
            const dateA = parseDate(a);
            const dateB = parseDate(b);
            const diff = Math.round((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
            return isNaN(diff) ? 0 : diff;
        };

        const insights: { type: 'positive' | 'warning' | 'insight'; text: string }[] = [];

        // ================================================================
        // INSIGHT 1: Milestone count
        // ================================================================
        const milestones = entries.filter((e: any) => e.is_milestone);
        const milestoneDomains = new Set(milestones.map((m: any) => m.domain_id));
        if (milestones.length > 0) {
            insights.push({
                type: 'positive',
                text: `${milestones.length} milestone${milestones.length > 1 ? 's' : ''} achieved across ${milestoneDomains.size} domain${milestoneDomains.size > 1 ? 's' : ''}`,
            });
        }

        // ================================================================
        // INSIGHT 2: Risk clusters (2+ domains decline within 7 days)
        // ================================================================
        const negativeEntries = entries.filter((e: any) => isNegative(e.domain_id, e.status_key));
        let riskClusterCount = 0;
        const processedPairs = new Set<string>();

        for (const entry of negativeEntries) {
            const nearby = negativeEntries.filter((e: any) => {
                if (e.id === (entry as any).id || e.domain_id === (entry as any).domain_id) return false;
                return Math.abs(daysBetween((entry as any).entry_date, e.entry_date)) <= 7;
            });
            if (nearby.length > 0) {
                const pairKey = [(entry as any).id, ...nearby.map((n: any) => n.id)].sort().join('-');
                if (!processedPairs.has(pairKey)) {
                    processedPairs.add(pairKey);
                    riskClusterCount++;
                }
            }
        }

        if (riskClusterCount > 0) {
            insights.push({
                type: 'warning',
                text: `${riskClusterCount} risk cluster${riskClusterCount > 1 ? 's' : ''} detected — multiple domains declined within 7-day windows`,
            });
        }

        // ================================================================
        // INSIGHT 3: Cross-domain positive correlations
        // Look for: positive event in domain A followed by improvement in domain B within 30 days
        // ================================================================
        const domainEntries: Record<string, any[]> = {};
        entries.forEach((e: any) => {
            if (!domainEntries[e.domain_id]) domainEntries[e.domain_id] = [];
            domainEntries[e.domain_id].push(e);
        });

        const domainIds = Object.keys(domainEntries);
        const correlationsFound = new Set<string>();

        for (let i = 0; i < domainIds.length; i++) {
            for (let j = 0; j < domainIds.length; j++) {
                if (i === j) continue;
                const domainA = domainIds[i];
                const domainB = domainIds[j];

                // Find positive milestone/improvement in domain A
                const positiveA = domainEntries[domainA].filter(
                    (e: any) => isPositive(e.domain_id, e.status_key) || e.is_milestone
                );

                for (const posEvent of positiveA) {
                    // Check if domain B improved within 30 days after
                    const bEntries = domainEntries[domainB];
                    for (let k = 0; k < bEntries.length; k++) {
                        const bEntry = bEntries[k];
                        const gap = daysBetween(posEvent.entry_date, bEntry.entry_date);
                        if (gap < 1 || gap > 30) continue;

                        // Check if this B entry is an improvement over the previous B entry
                        const prevB = bEntries[k - 1];
                        if (!prevB) continue;
                        const prevOrder = getOrder(domainB, prevB.status_key);
                        const currOrder = getOrder(domainB, bEntry.status_key);
                        if (currOrder > prevOrder) {
                            const corrKey = `${domainA}-${domainB}`;
                            if (!correlationsFound.has(corrKey)) {
                                correlationsFound.add(corrKey);
                                const domainAInfo = domains.find((d: any) => d.id === domainA);
                                const domainBInfo = domains.find((d: any) => d.id === domainB);
                                if (domainAInfo && domainBInfo) {
                                    insights.push({
                                        type: 'insight',
                                        text: `${domainBInfo.domain_label} improved within ${gap} days of a positive ${domainAInfo.domain_label} change`,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // ================================================================
        // INSIGHT 4: Setback recovery resilience
        // Look for: negative event followed by recovery in same domain
        // ================================================================
        for (const domainId of domainIds) {
            const dEntries = domainEntries[domainId];
            let setbackCount = 0;
            let recoveryCount = 0;

            for (let k = 1; k < dEntries.length; k++) {
                const prev = dEntries[k - 1];
                const curr = dEntries[k];
                const prevOrder = getOrder(domainId, prev.status_key);
                const currOrder = getOrder(domainId, curr.status_key);

                if (currOrder < prevOrder) {
                    // This is a setback (order decreased)
                    setbackCount++;
                    // Check if there's a subsequent recovery
                    for (let m = k + 1; m < dEntries.length; m++) {
                        const futureOrder = getOrder(domainId, dEntries[m].status_key);
                        if (futureOrder >= prevOrder) {
                            recoveryCount++;
                            break;
                        }
                    }
                }
            }

            if (setbackCount > 0 && recoveryCount > 0) {
                const domainInfo = domains.find((d: any) => d.id === domainId);
                if (domainInfo) {
                    insights.push({
                        type: 'insight',
                        text: `${domainInfo.domain_label}: ${setbackCount} setback${setbackCount > 1 ? 's' : ''} with ${recoveryCount} recovery${recoveryCount > 1 ? 'ies' : ''} — resilience pattern observed`,
                    });
                }
            }
        }

        // ================================================================
        // INSIGHT 5: Longest streak of improvement
        // ================================================================
        const allDates = Array.from(new Set(entries.map((e: any) => e.entry_date))).sort();
        if (allDates.length >= 2) {
            const firstDate = allDates[0];
            const lastDate = allDates[allDates.length - 1];
            const totalSpan = daysBetween(firstDate, lastDate);
            if (totalSpan > 30) {
                // Count domains currently at their highest-ever status
                let atPeakCount = 0;
                for (const domainId of domainIds) {
                    const dEntries = domainEntries[domainId];
                    if (dEntries.length === 0) continue;
                    const latest = dEntries[dEntries.length - 1];
                    const latestOrder = getOrder(domainId, latest.status_key);
                    const maxEver = Math.max(...dEntries.map((e: any) => getOrder(domainId, e.status_key)));
                    if (latestOrder === maxEver && latestOrder > 0) {
                        atPeakCount++;
                    }
                }

                if (atPeakCount >= 2) {
                    insights.push({
                        type: 'positive',
                        text: `${atPeakCount} domain${atPeakCount > 1 ? 's are' : ' is'} currently at their highest recorded status`,
                    });
                }
            }
        }

        // ================================================================
        // INSIGHT 6: No activity warning
        // ================================================================
        if (allDates.length > 0) {
            const lastEntryDate = allDates[allDates.length - 1];
            const today = new Date().toISOString().split('T')[0];
            const daysSinceLastEntry = daysBetween(lastEntryDate, today);
            if (daysSinceLastEntry > 14) {
                insights.push({
                    type: 'warning',
                    text: `No entries recorded in the last ${daysSinceLastEntry} days — consider a check-in`,
                });
            }
        }

        return NextResponse.json({ success: true, insights });
    } catch (error) {
        console.error('Error generating journey insights:', error);
        return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
    }
}
