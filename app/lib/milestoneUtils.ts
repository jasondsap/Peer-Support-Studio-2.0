// lib/milestoneUtils.ts
// Shared utility for goal milestones — generate from AI phased plan, calculate progress

export interface Milestone {
    id: string;
    phase: 'preparation' | 'action' | 'followThrough' | 'maintenance';
    title: string;
    completed: boolean;
    completed_at: string | null;
    completed_by: string | null;
    notes: string;
    order: number;
}

/**
 * Generate a simple UUID-like ID (no crypto dependency needed)
 */
function generateId(): string {
    return 'ms_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Build milestones array from an AI-generated phased plan.
 * Each action in each phase becomes a checkable milestone.
 */
export function generateMilestonesFromPlan(phasedPlan: {
    preparation?: { title: string; description: string; actions: string[] };
    action?: { title: string; description: string; actions: string[] };
    followThrough?: { title: string; description: string; actions: string[] };
    maintenance?: { title: string; description: string; actions: string[] };
}): Milestone[] {
    const milestones: Milestone[] = [];
    let order = 0;

    const phases: Array<{ key: Milestone['phase']; data: { actions: string[] } | undefined }> = [
        { key: 'preparation', data: phasedPlan.preparation },
        { key: 'action', data: phasedPlan.action },
        { key: 'followThrough', data: phasedPlan.followThrough },
        { key: 'maintenance', data: phasedPlan.maintenance },
    ];

    for (const { key, data } of phases) {
        if (!data?.actions) continue;
        for (const actionText of data.actions) {
            milestones.push({
                id: generateId(),
                phase: key,
                title: actionText,
                completed: false,
                completed_at: null,
                completed_by: null,
                notes: '',
                order: order++,
            });
        }
    }

    return milestones;
}

/**
 * Calculate progress percentage from milestones.
 * Returns 0 if no milestones exist.
 */
export function calculateProgress(milestones: Milestone[]): number {
    if (!milestones || milestones.length === 0) return 0;
    const completed = milestones.filter(m => m.completed).length;
    return Math.round((completed / milestones.length) * 100);
}

/**
 * Get milestone stats grouped by phase.
 */
export function getMilestoneStats(milestones: Milestone[]) {
    const phases: Milestone['phase'][] = ['preparation', 'action', 'followThrough', 'maintenance'];
    const stats = phases.map(phase => {
        const phaseMilestones = milestones.filter(m => m.phase === phase);
        const completed = phaseMilestones.filter(m => m.completed).length;
        return {
            phase,
            total: phaseMilestones.length,
            completed,
            milestones: phaseMilestones.sort((a, b) => a.order - b.order),
        };
    }).filter(s => s.total > 0);

    return {
        phases: stats,
        totalMilestones: milestones.length,
        totalCompleted: milestones.filter(m => m.completed).length,
    };
}

/**
 * Phase display info — labels and colors
 */
export const phaseConfig: Record<Milestone['phase'], { label: string; color: string; dotColor: string }> = {
    preparation: { label: 'Week 1: Preparation', color: '#3B82F6', dotColor: 'bg-blue-500' },
    action: { label: 'Week 2-3: Action', color: '#22C55E', dotColor: 'bg-green-500' },
    followThrough: { label: 'Week 3-4: Follow-Through', color: '#EAB308', dotColor: 'bg-yellow-500' },
    maintenance: { label: 'Ongoing: Maintenance', color: '#8B5CF6', dotColor: 'bg-purple-500' },
};

/**
 * Add a new custom milestone to a specific phase.
 */
export function addMilestone(milestones: Milestone[], phase: Milestone['phase'], title: string): Milestone[] {
    const maxOrder = milestones.length > 0 ? Math.max(...milestones.map(m => m.order)) : -1;
    return [
        ...milestones,
        {
            id: generateId(),
            phase,
            title,
            completed: false,
            completed_at: null,
            completed_by: null,
            notes: '',
            order: maxOrder + 1,
        },
    ];
}

/**
 * Toggle a milestone's completed status.
 */
export function toggleMilestone(milestones: Milestone[], milestoneId: string, userId?: string): Milestone[] {
    return milestones.map(m => {
        if (m.id !== milestoneId) return m;
        const nowCompleted = !m.completed;
        return {
            ...m,
            completed: nowCompleted,
            completed_at: nowCompleted ? new Date().toISOString() : null,
            completed_by: nowCompleted ? (userId || null) : null,
        };
    });
}

/**
 * Update a milestone's title.
 */
export function updateMilestoneTitle(milestones: Milestone[], milestoneId: string, newTitle: string): Milestone[] {
    return milestones.map(m => m.id === milestoneId ? { ...m, title: newTitle } : m);
}

/**
 * Update a milestone's notes.
 */
export function updateMilestoneNotes(milestones: Milestone[], milestoneId: string, notes: string): Milestone[] {
    return milestones.map(m => m.id === milestoneId ? { ...m, notes } : m);
}

/**
 * Remove a milestone by ID.
 */
export function removeMilestone(milestones: Milestone[], milestoneId: string): Milestone[] {
    return milestones.filter(m => m.id !== milestoneId);
}
