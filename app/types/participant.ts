// ============================================================================
// Peer Support Studio - Participant & Readiness Types
// File: /app/types/participant.ts
// ============================================================================

// ============================================================================
// Core Participant Types
// ============================================================================

export interface Participant {
    id: string;
    organization_id: string;
    
    // Basic Info
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    
    // Contact
    email?: string;
    phone?: string;
    
    // Address
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    
    // Emergency Contact
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    
    // Program Info
    status: ParticipantStatus;
    intake_date: string;
    referral_source?: string;
    primary_pss_id?: string;
    primary_pss_name?: string;
    internal_notes?: string;
    
    // Reentry Tracking
    is_reentry_participant: boolean;
    
    // Audit
    created_at: string;
    updated_at?: string;
    updated_by?: string;
}

export type ParticipantStatus = 'active' | 'inactive' | 'discharged' | 'waitlist';

// For creating a new participant
export interface CreateParticipantInput {
    organization_id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    referral_source?: string;
    internal_notes?: string;
    is_reentry_participant?: boolean;
}

// For updating a participant
export interface UpdateParticipantInput extends Partial<CreateParticipantInput> {
    status?: ParticipantStatus;
}

// Participant with related counts (for list views)
export interface ParticipantWithCounts extends Participant {
    goals_count?: number;
    notes_count?: number;
    assessments_count?: number;
    readiness_completion?: number;
}

// ============================================================================
// Readiness Tracking Types
// ============================================================================

export type ReadinessCategory = 'identity' | 'financial' | 'healthcare' | 'housing' | 'legal';

export type ReadinessStatus = 'not_needed' | 'missing' | 'in_progress' | 'obtained' | 'expired';

// Definition of a readiness item (from reference table)
export interface ReadinessItemDefinition {
    id: string;
    category: ReadinessCategory;
    item_key: string;
    item_label: string;
    description?: string;
    display_order: number;
    is_active: boolean;
}

// A participant's status on a specific readiness item
export interface ParticipantReadinessItem {
    id: string;
    participant_id: string;
    organization_id: string;
    item_key: string;
    status: ReadinessStatus;
    obtained_date?: string;
    expiration_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    updated_by?: string;
    
    // Joined from definition table
    item_label?: string;
    category?: ReadinessCategory;
    description?: string;
}

// For updating a readiness item
export interface UpdateReadinessItemInput {
    status: ReadinessStatus;
    obtained_date?: string | null;
    expiration_date?: string | null;
    notes?: string | null;
}

// Grouped readiness items by category (for UI display)
export interface ReadinessByCategory {
    identity: ParticipantReadinessItem[];
    financial: ParticipantReadinessItem[];
    healthcare: ParticipantReadinessItem[];
    housing: ParticipantReadinessItem[];
    legal: ParticipantReadinessItem[];
}

// Summary statistics for a participant's readiness
export interface ReadinessSummary {
    participant_id: string;
    obtained_count: number;
    in_progress_count: number;
    missing_count: number;
    expired_count: number;
    not_needed_count: number;
    total_items: number;
    completion_percentage: number;
}

// ============================================================================
// Category Metadata (for UI rendering)
// ============================================================================

export const READINESS_CATEGORIES: Record<ReadinessCategory, {
    label: string;
    icon: string; // Lucide icon name
    color: string; // Tailwind color class
    bgColor: string;
    description: string;
}> = {
    identity: {
        label: 'Identity Documents',
        icon: 'IdCard',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: 'Foundation documents that unlock access to services'
    },
    financial: {
        label: 'Financial Access',
        icon: 'CreditCard',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: 'Banking and financial stability'
    },
    healthcare: {
        label: 'Healthcare',
        icon: 'Heart',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        description: 'Insurance and provider connections'
    },
    housing: {
        label: 'Housing',
        icon: 'Home',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        description: 'Address stability and housing documentation'
    },
    legal: {
        label: 'Legal / Reentry',
        icon: 'Scale',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        description: 'Justice-involved documentation and requirements'
    }
};

// Status metadata for UI
export const READINESS_STATUSES: Record<ReadinessStatus, {
    label: string;
    color: string;
    bgColor: string;
    icon: string;
}> = {
    not_needed: {
        label: 'Not Needed',
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        icon: 'Minus'
    },
    missing: {
        label: 'Missing',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: 'X'
    },
    in_progress: {
        label: 'In Progress',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        icon: 'Clock'
    },
    obtained: {
        label: 'Obtained',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: 'Check'
    },
    expired: {
        label: 'Expired',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        icon: 'AlertTriangle'
    }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get display name for a participant
 */
export function getParticipantDisplayName(participant: Participant): string {
    return participant.preferred_name || participant.first_name;
}

/**
 * Get full name for a participant
 */
export function getParticipantFullName(participant: Participant): string {
    return `${participant.first_name} ${participant.last_name}`;
}

/**
 * Get initials for a participant
 */
export function getParticipantInitials(participant: Participant): string {
    return `${participant.first_name[0]}${participant.last_name[0]}`.toUpperCase();
}

/**
 * Calculate days in program
 */
export function getDaysInProgram(intakeDate: string): number {
    const intake = new Date(intakeDate);
    const today = new Date();
    return Math.floor((today.getTime() - intake.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format address as single line
 */
export function formatAddress(participant: Participant): string | null {
    const parts = [
        participant.address_line1,
        participant.address_line2,
        participant.city,
        participant.state,
        participant.zip
    ].filter(Boolean);
    
    if (parts.length === 0) return null;
    
    // Format as: "123 Main St, Apt 4, Louisville, KY 40202"
    let address = participant.address_line1 || '';
    if (participant.address_line2) address += `, ${participant.address_line2}`;
    if (participant.city) address += `, ${participant.city}`;
    if (participant.state) address += `, ${participant.state}`;
    if (participant.zip) address += ` ${participant.zip}`;
    
    return address;
}

/**
 * Group readiness items by category
 */
export function groupReadinessByCategory(
    items: ParticipantReadinessItem[]
): ReadinessByCategory {
    const grouped: ReadinessByCategory = {
        identity: [],
        financial: [],
        healthcare: [],
        housing: [],
        legal: []
    };
    
    items.forEach(item => {
        const category = item.category as ReadinessCategory;
        if (category && grouped[category]) {
            grouped[category].push(item);
        }
    });
    
    return grouped;
}

/**
 * Calculate readiness summary from items
 */
export function calculateReadinessSummary(
    items: ParticipantReadinessItem[],
    participantId: string
): ReadinessSummary {
    const summary: ReadinessSummary = {
        participant_id: participantId,
        obtained_count: 0,
        in_progress_count: 0,
        missing_count: 0,
        expired_count: 0,
        not_needed_count: 0,
        total_items: items.length,
        completion_percentage: 0
    };
    
    items.forEach(item => {
        switch (item.status) {
            case 'obtained': summary.obtained_count++; break;
            case 'in_progress': summary.in_progress_count++; break;
            case 'missing': summary.missing_count++; break;
            case 'expired': summary.expired_count++; break;
            case 'not_needed': summary.not_needed_count++; break;
        }
    });
    
    const applicableItems = summary.total_items - summary.not_needed_count;
    if (applicableItems > 0) {
        summary.completion_percentage = Math.round(
            (summary.obtained_count / applicableItems) * 100
        );
    }
    
    return summary;
}
