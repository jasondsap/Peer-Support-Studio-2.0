// =============================================
// PEER SUPPORT STUDIO - TYPE DEFINITIONS
// =============================================

// ==================== ORGANIZATIONS ====================

export interface Organization {
    id: string;
    name: string;
    slug: string;
    type: 'peer_org' | 'treatment_center' | 'recovery_house' | 'independent';
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state: string;
    zip?: string;
    phone?: string;
    email?: string;
    website?: string;
    logo_url?: string;
    primary_color: string;
    settings: OrganizationSettings;
    plan: 'trial' | 'starter' | 'professional' | 'enterprise';
    trial_ends_at?: string;
    subscription_status: string;
    created_at: string;
    updated_at: string;
}

export interface OrganizationSettings {
    require_supervisor_approval: boolean;
    session_timeout_hours: number;
    allow_self_registration: boolean;
    default_member_role: string;
}

// ==================== USERS ====================

export interface User {
    id: string;
    cognito_sub: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string;
    certification_type?: string;
    certification_number?: string;
    certification_expiry?: string;
    supervisor_id?: string;
    preferences: UserPreferences;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
}

export interface UserPreferences {
    theme: 'light' | 'dark';
    notifications: boolean;
    email_summaries: 'daily' | 'weekly' | 'never';
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'supervisor' | 'pss';
    permissions: Record<string, boolean>;
    status: 'active' | 'inactive' | 'pending';
    joined_at: string;
    // Joined data
    user?: User;
    organization?: Organization;
}

// ==================== PARTICIPANTS ====================

export interface Participant {
    id: string;
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
    state: string;
    zip?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relationship?: string;
    status: 'active' | 'inactive' | 'discharged' | 'waitlist';
    referral_source?: string;
    intake_date: string;
    discharge_date?: string;
    discharge_reason?: string;
    primary_pss_id?: string;
    internal_notes?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    // Computed/joined
    full_name?: string;
    primary_pss?: User;
    goals_count?: number;
    notes_count?: number;
}

export interface ParticipantCareTeamMember {
    id: string;
    participant_id: string;
    user_id: string;
    role: 'pss' | 'supervisor' | 'case_manager';
    is_primary: boolean;
    assigned_at: string;
    user?: User;
}

// ==================== GOALS ====================

export interface Goal {
    id: string;
    organization_id: string;
    participant_id?: string;
    created_by: string;
    title: string;
    goal_area: GoalArea;
    desired_outcome: string;
    smart_goal?: string;
    timeframe_days: number;
    start_date: string;
    target_date?: string;
    status: 'draft' | 'active' | 'completed' | 'abandoned';
    progress: number;
    completed_at?: string;
    goal_data?: GoalData;
    created_at: string;
    updated_at: string;
    // Joined
    participant?: Participant;
    creator?: User;
}

export type GoalArea = 
    | 'substance-use'
    | 'mental-health'
    | 'housing'
    | 'employment'
    | 'education'
    | 'family'
    | 'legal'
    | 'physical-health'
    | 'life-skills'
    | 'social-support'
    | 'transportation'
    | 'financial';

export interface GoalData {
    motivation?: string;
    strengths?: string[];
    barriers?: string[];
    coping_strategies?: string[];
    action_steps?: ActionStep[];
    support_activities?: string[];
    progress_indicators?: string[];
    backup_plan?: string;
}

export interface ActionStep {
    phase: string;
    description: string;
    timeline: string;
}

// ==================== SESSION NOTES ====================

export interface SessionNote {
    id: string;
    organization_id: string;
    participant_id?: string;
    created_by: string;
    session_date: string;
    session_type: 'individual' | 'group' | 'family' | 'crisis';
    setting: string;
    duration_minutes: number;
    attendance_count?: number;
    metadata: SessionNoteMetadata;
    pss_note?: PSSNote;
    transcript?: string;
    source: 'manual' | 'audio_upload' | 'ai_generated';
    status: 'draft' | 'complete' | 'reviewed' | 'archived';
    is_archived: boolean;
    reviewed_by?: string;
    reviewed_at?: string;
    review_notes?: string;
    created_at: string;
    updated_at: string;
    // Joined
    participant?: Participant;
    creator?: User;
    reviewer?: User;
}

export interface SessionNoteMetadata {
    date: string;
    duration: string;
    sessionType: string;
    setting: string;
    participantName?: string;
}

export interface PSSNote {
    sessionOverview: string;
    topicsDiscussed: string[];
    participantPresentation?: string;
    interventionsUsed?: string[];
    progressObserved?: string;
    challengesIdentified?: string[];
    followUpItems?: string[];
    peerSupportActivities?: string[];
}

// ==================== ASSESSMENTS ====================

export interface RecoveryAssessment {
    id: string;
    organization_id: string;
    participant_id?: string;
    administered_by: string;
    assessment_type: 'barc10' | 'comprehensive';
    total_score: number;
    domain_scores: DomainScores;
    responses: Record<string, number>;
    ai_analysis?: AssessmentAnalysis;
    assessment_date: string;
    notes?: string;
    created_at: string;
    // Joined
    participant?: Participant;
    administrator?: User;
}

export interface DomainScores {
    human: number;
    social: number;
    physical: number;
    cultural: number;
}

export interface AssessmentAnalysis {
    summary: string;
    strengths: string[];
    areas_for_growth: string[];
    recommendations: string[];
}

export interface PeerReadinessAssessment {
    id: string;
    user_id: string;
    total_score: number;
    domain_scores: Record<string, number>;
    responses: Record<string, number>;
    ai_analysis?: AssessmentAnalysis;
    created_at: string;
}

// ==================== SERVICE PLANS ====================

export interface ServicePlan {
    id: string;
    organization_id: string;
    created_by: string;
    participant_id?: string;
    service_type: 'individual' | 'group';
    service_code?: string;
    planned_date: string;
    planned_duration: number;
    setting: string;
    lesson_id?: string;
    goal_id?: string;
    session_note_id?: string;
    planning_notes?: string;
    actual_date?: string;
    actual_duration?: number;
    delivered_as_planned?: boolean;
    deviation_notes?: string;
    completed_at?: string;
    status: 'draft' | 'planned' | 'approved' | 'completed' | 'verified';
    created_at: string;
    updated_at: string;
    // Joined
    participant?: Participant;
    goal?: Goal;
    lesson?: Lesson;
}

// ==================== LESSONS ====================

export interface Lesson {
    id: string;
    organization_id?: string;
    created_by: string;
    title: string;
    description?: string;
    topic?: string;
    duration_minutes: number;
    content?: LessonContent;
    is_template: boolean;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

export interface LessonContent {
    objectives: string[];
    materials?: string[];
    introduction?: string;
    main_content?: string;
    activities?: string[];
    discussion_questions?: string[];
    wrap_up?: string;
}

// ==================== AUDIT LOG ====================

export interface AuditLogEntry {
    id: string;
    user_id?: string;
    organization_id?: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'login' | 'logout';
    resource_type: string;
    resource_id?: string;
    details?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// ==================== FORM TYPES ====================

export interface CreateParticipantInput {
    first_name: string;
    last_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    gender?: string;
    email?: string;
    phone?: string;
    referral_source?: string;
    internal_notes?: string;
}

export interface CreateGoalInput {
    participant_id?: string;
    title: string;
    goal_area: GoalArea;
    desired_outcome: string;
    timeframe_days?: number;
}

export interface CreateSessionNoteInput {
    participant_id?: string;
    session_date: string;
    session_type: string;
    setting: string;
    duration_minutes: number;
}
