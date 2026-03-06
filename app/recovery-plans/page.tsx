'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Plus, Loader2, Save, Search, X, Target, Calendar,
    CheckCircle2, Clock, ChevronDown, ChevronUp, Edit3, Trash2,
    Users, Shield, Heart, Brain, Home, Compass, Activity, Star,
    Briefcase, AlertTriangle, Coffee, BookOpen, ChevronRight, Sparkles,
    BarChart3
} from 'lucide-react';

// ============================================================================
// 10-DOMAIN RECOVERY PLAN TEMPLATE
// ============================================================================

const DOMAIN_TEMPLATE = [
    {
        key: 'substance_use',
        number: 'I',
        name: 'Alcohol/Substance Use and Sobriety',
        icon: Shield,
        color: '#EF4444',
        bgColor: '#FEF2F2',
        goals: [
            'Abstain from use of drugs of abuse',
            'Abstain from use of alcohol',
        ],
        activities: [
            'Participate in recovery support programs',
            'Participate in an IOP',
            'Participate in OP counseling',
            'Participate in intensive residential treatment',
            'Use medications as prescribed',
            'Complete drug/alcohol screens as requested',
            'Participate in ongoing mutual aid/support groups',
            'Outline steps to manage chronic disease medications',
        ],
        outcomes: [
            { key: 'sessions_attended', label: 'Number of sessions attended', type: 'number' },
            { key: 'participation_rating', label: 'Rating of degree of participation', type: 'rating_10' },
            { key: 'program_satisfaction', label: 'Program Satisfaction Rating', type: 'rating_10' },
            { key: 'alliance_measure', label: 'Alliance Measure', type: 'rating_10' },
        ],
        instruments: ['SoDU', 'Craving', 'Motivation', 'AUDIT-C'],
        scalingQuestions: [
            'How important is it for you to abstain from alcohol or use of drugs? (0–10)',
            'How capable do you feel to abstain from using alcohol and/or drugs? (0–10)',
        ],
    },
    {
        key: 'emotional_wellbeing',
        number: 'II',
        name: 'Emotional Wellbeing',
        icon: Heart,
        color: '#EC4899',
        bgColor: '#FDF2F8',
        goals: [
            'Decrease Depression',
            'Decrease Anxiety',
        ],
        activities: [
            'Participation in recovery support programs/sessions',
            'Manage co-occurring disorders',
            'Keep counseling appointments',
            'Take medications as directed',
            'Engage in positive social activities',
            'Build a support group of understanding and supportive individuals',
            'Practice mindfulness and meditation to help manage stress',
            'Participate in activities that support personal growth and accomplishment',
            'Strengthen interpersonal skills to resolve conflicts and build healthier relationships',
            'Follow up with counseling',
            'Develop a plan to continue to manage emotions and stress',
        ],
        outcomes: [
            { key: 'phq4_score', label: 'PHQ-4 Score', type: 'assessment_link', assessment_type: 'phq4' },
            { key: 'stress_rating', label: 'Stress level self-rating', type: 'rating_10' },
        ],
        instruments: ['PHQ-4'],
        scalingQuestions: [],
    },
    {
        key: 'physical_health',
        number: 'III',
        name: 'Physical Health Wellbeing',
        icon: Activity,
        color: '#10B981',
        bgColor: '#ECFDF5',
        goals: [
            'Increase sense of physical wellbeing',
            'Address tobacco use',
            'Address medical conditions',
        ],
        activities: [
            'Obtain medical care as needed and identify primary care provider/clinic',
            'Obtain dental care and/or identify a dental care provider',
            'Obtain vision care and/or identify a provider of vision care',
            'Smoking Cessation',
            'Use nicotine replacement aids as directed',
            'Apply for Medicaid/insurance if needed',
            'Identify long term health conditions that need care',
            'Develop a plan to address long term health conditions',
        ],
        outcomes: [
            { key: 'cdc_hrqol', label: 'CDC Health-Related Quality of Life — Healthy Days', type: 'assessment_link', assessment_type: 'cdc_hrqol' },
        ],
        instruments: ['CDC HRQOL'],
        scalingQuestions: [],
    },
    {
        key: 'civic_engagement',
        number: 'IV',
        name: 'Civic and Community Engagement',
        icon: Users,
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
        goals: [
            'Identify interests and hobbies',
            'Identify ways to "give back" in the community',
            'Address any legal issues',
        ],
        activities: [
            'Participate in recovery support programs',
            'Engage in a community group(s)',
            'Assist with service opportunities with mutual aid groups',
            'List possible volunteer/community activities',
            'List hobbies and interests',
            'Develop goals to participate in volunteer/community activities',
            'Identify and address barriers to community participation (transportation, finances, social anxiety)',
            'Identify practical solutions and access available resources',
        ],
        outcomes: [
            { key: 'community_groups', label: 'Participation in community groups', type: 'boolean' },
            { key: 'volunteer_activities', label: 'Engaged in volunteer activities', type: 'boolean' },
        ],
        instruments: [],
        scalingQuestions: [],
    },
    {
        key: 'functional_wellbeing',
        number: 'V',
        name: 'Functional Wellbeing (Coping and Life Functioning)',
        icon: Coffee,
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        goals: [
            'Improve personal hygiene',
            'Attend and participate in daily activities',
            'Establish a daily routine (waking, bedtime, meals)',
            'Participate in sober/recreational activities',
            'Define and establish a plan for financial wellbeing',
        ],
        activities: [
            'Attend and participate in Life Skills Classes',
            'Abide by program schedules and curfews',
            'Participate in program exercise/recreational activities',
            'Identify enjoyable activities that are drug/alcohol free',
            'Develop a plan to pay restitution',
            'Keep CPS appointments',
            'Develop a plan to pay child support',
            'Keep DCBS appointments and explore assistance with rent, utilities, etc.',
            'Enroll in SNAP benefits',
            'Practice coping skills that do not use substances',
            'Develop a daily schedule that supports structure and recovery',
            'Identify a plan to establish a banking relationship',
            'Set goals for healthy lifestyle habits (exercise, nutrition, sleep, stress management)',
        ],
        outcomes: [
            { key: 'credit_score', label: 'Credit Score', type: 'number' },
            { key: 'daily_routine', label: 'Daily routine compliance', type: 'rating_10' },
        ],
        instruments: [],
        scalingQuestions: [],
    },
    {
        key: 'meaning_purpose',
        number: 'VI',
        name: 'Meaning & Purpose',
        icon: Star,
        color: '#D97706',
        bgColor: '#FEF3C7',
        goals: [
            'Identify training, education, and employment goals',
            'Increase sense of self-worth',
        ],
        activities: [
            'If no GED, obtain GED',
            'Schedule GED classes if needed',
            'Identify and participate in training curriculum',
            'Keep KYAE appointment',
            'Explore employment opportunities',
            'Submit employment applications',
            'Explore training/further educational opportunities',
            'Strengthen family relationships to reinforce positive goals',
        ],
        outcomes: [
            { key: 'education', label: 'Educational attainment', type: 'boolean' },
            { key: 'employment', label: 'Obtain employment', type: 'boolean' },
            { key: 'self_esteem', label: 'Self-esteem rating', type: 'rating_10' },
        ],
        instruments: [],
        scalingQuestions: [],
    },
    {
        key: 'housing',
        number: 'VII',
        name: 'Housing Status',
        icon: Home,
        color: '#0EA5E9',
        bgColor: '#F0F9FF',
        goals: [
            'Obtain stable housing',
        ],
        activities: [
            'Create a transitional housing plan',
            'Apply for Section 8 voucher if appropriate',
            'Apply for sober housing if needed',
            'Find affordable rental, transitional housing, or supportive housing options',
            'Investigate rental housing assistance and community partner resources',
            'Develop a plan to build supportive networks within community',
        ],
        outcomes: [
            { key: 'obtain_housing', label: 'Obtain and maintain housing', type: 'boolean' },
            { key: 'housing_satisfaction', label: 'Housing satisfaction rating', type: 'rating_10' },
        ],
        instruments: [],
        scalingQuestions: [],
    },
    {
        key: 'risk_taking',
        number: 'VIII',
        name: 'Risk Taking',
        icon: AlertTriangle,
        color: '#F97316',
        bgColor: '#FFF7ED',
        goals: [
            'Increase sense of resilience and confidence to manage challenges',
            'Manage the potential for a return to use',
        ],
        activities: [
            'Participation in recovery support programs/groups',
            'Share thoughts and feelings in recovery sessions',
            'Practice problem-solving skills that enhance resiliency',
            'Enhance decision-making abilities to reduce impulsivity',
            'Identify high-risk situations, people, and places and develop a plan to address them',
            'Develop a transition plan that includes return-to-use prevention',
            'Develop an intervention plan for steps to take in event of return to use',
        ],
        outcomes: [
            { key: 'locus_of_control', label: 'Locus of Control score', type: 'assessment_link', assessment_type: 'floc1' },
            { key: 'return_to_use_plan', label: 'Return to use plan completed', type: 'boolean' },
            { key: 'relapse_prevention_plan', label: 'Relapse prevention plan completed', type: 'boolean' },
        ],
        instruments: ['FLOC-1'],
        scalingQuestions: [],
    },
    {
        key: 'recovery_experience',
        number: 'IX',
        name: 'Recovery Experience',
        icon: Compass,
        color: '#6366F1',
        bgColor: '#EEF2FF',
        goals: [
            'Become engaged with programs',
            'Improve readiness to change',
        ],
        activities: [
            'Participation in recovery support programs/groups',
            'Develop a recovery support network',
            'Develop habits that support recovery (daily meditation, recovery journal, text/call support group, pray/meditate)',
            'Identify strengths supporting ongoing recovery',
            'Identify barriers to ongoing recovery including ambivalence',
            'Prioritize recovery-related activities',
            'Explore personal goals, values, and aspirations',
            'Practice problem-solving skills',
            'Identify ongoing support including mutual aid participation',
            'Develop a plan to include family/friends in the recovery process',
        ],
        outcomes: [
            { key: 'importance_recovery', label: 'Importance to achieve recovery (0–10)', type: 'rating_10' },
            { key: 'confidence_recovery', label: 'Confidence to achieve recovery (0–10)', type: 'rating_10' },
        ],
        instruments: ['Motivation', 'BARC-10', 'MIRC-28'],
        scalingQuestions: [
            'How important is it to you to achieve recovery? (0–10)',
            'How confident are you that you can achieve recovery? (0–10)',
        ],
    },
    {
        key: 'social_support',
        number: 'X',
        name: 'Social Support',
        icon: Users,
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        goals: [
            'Increase Social Connections',
            'Increase number of meaningful friendships',
        ],
        activities: [
            'Participation in recovery support programs/groups',
            'Engage with a sponsor/mentor',
            'Develop a support group of like-minded individuals',
            'Improve family relationships if appropriate',
            'Develop a plan to be of service to others',
            'Identify opportunities to expand pro-recovery social activities',
            'Design a plan that designates a schedule of support group activities and meetings with sponsor/mentor',
        ],
        outcomes: [
            { key: 'trusted_person', label: 'Identify person(s) you feel trust and are affirmed by', type: 'boolean' },
            { key: 'social_groups', label: 'Participate in social groups', type: 'boolean' },
        ],
        instruments: ['BARC-10', 'MIRC-28'],
        scalingQuestions: [],
    },
];

// ============================================================================
// TYPES
// ============================================================================

interface Participant {
    id: string; first_name: string; last_name: string; preferred_name?: string; status: string;
}

interface PlanActivity {
    id?: string; activity_text: string; frequency: string; duration: string;
    status: string; notes: string; is_custom: boolean; sort_order: number;
}
interface PlanGoal {
    id?: string; goal_text: string; status: string; target_date: string;
    is_custom: boolean; sort_order: number; activities: PlanActivity[];
}
interface PlanOutcome {
    id?: string; measure_key: string; measure_type: string; label: string;
    value: string | null; assessment_type: string | null; notes: string | null;
    recorded_by: string | null; recorded_at: string;
    recorded_by_first_name?: string; recorded_by_last_name?: string;
}
interface PlanDomain {
    id?: string; domain_key: string; status: string;
    importance_rating: number | null; confidence_rating: number | null;
    notes: string; sort_order: number; goals: PlanGoal[];
    outcomes?: PlanOutcome[];
}
interface Plan {
    id: string; participant_id: string; organization_id: string; user_id: string;
    plan_name: string; status: string; notes: string; created_at: string; updated_at: string;
    participant_first_name?: string; participant_last_name?: string; participant_preferred_name?: string;
    domains?: PlanDomain[]; domain_count?: number; completed_goals?: number; total_goals?: number;
    plan_summary?: string;
}

type ViewState = 'list' | 'create_select_participant' | 'create_select_domains' | 'create_configure' | 'detail';

// ============================================================================
// PAGE
// ============================================================================

export default function RecoveryPlansPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50"><Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" /></div>}>
            <RecoveryPlansContent />
        </Suspense>
    );
}

function RecoveryPlansContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    
    const [plans, setPlans] = useState<Plan[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);

    const [view, setView] = useState<ViewState>('list');
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Create flow state
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [participantSearch, setParticipantSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedDomainKeys, setSelectedDomainKeys] = useState<Set<string>>(new Set());
    const [domainConfigs, setDomainConfigs] = useState<Map<string, { goals: Set<number>; activities: Map<number, Set<number>>; customGoals: string[]; importance: number | null; confidence: number | null }>>(new Map());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Detail view state
    const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Plan summary state
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState('');

    // ========================================================================
    // Init & Data
    // ========================================================================
    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/auth/signin');
    }, [authStatus, router]);

    useEffect(() => {
        if (!currentOrg?.id) return;
        fetchPlans();
        fetchParticipants();
    }, [currentOrg?.id]);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/rc-plans?organization_id=${currentOrg!.id}`);
            const data = await res.json();
            setPlans(data.plans || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchParticipants = async () => {
        try {
            const res = await fetch(`/api/participants?organization_id=${currentOrg!.id}`);
            const data = await res.json();
            setParticipants(data.participants?.filter((p: Participant) => p.status === 'active') || []);
        } catch (e) { console.error(e); }
    };

    const fetchPlanDetail = async (planId: string) => {
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/rc-plans?organization_id=${currentOrg!.id}&id=${planId}`);
            const data = await res.json();
            if (data.plan) {
                setSelectedPlan(data.plan);
                setExpandedDomains(new Set(data.plan.domains?.map((d: PlanDomain) => d.id) || []));
            }
        } catch (e) { console.error(e); }
        finally { setDetailLoading(false); }
    };

    // ========================================================================
    // URL params
    // ========================================================================
    useEffect(() => {
        if (!currentOrg?.id || loading) return;
        const participantIdParam = searchParams.get('participant_id');
        const createParam = searchParams.get('create');
        const viewParam = searchParams.get('view');
        if (viewParam) {
            fetchPlanDetail(viewParam);
            setView('detail');
        } else if (createParam === 'true') {
            setView('create_select_participant');
            if (participantIdParam && participants.length > 0) {
                const p = participants.find(p => p.id === participantIdParam);
                if (p) { setSelectedParticipant(p); setView('create_select_domains'); }
            }
        }
    }, [currentOrg?.id, loading, participants.length]);

    // ========================================================================
    // Create flow helpers
    // ========================================================================
    const toggleDomain = (key: string) => {
        setSelectedDomainKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) { next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    const initDomainConfigs = () => {
        const configs = new Map<string, { goals: Set<number>; activities: Map<number, Set<number>>; customGoals: string[]; importance: number | null; confidence: number | null }>();
        selectedDomainKeys.forEach(key => {
            const tpl = DOMAIN_TEMPLATE.find(d => d.key === key);
            if (!tpl) return;
            const goalSet = new Set(tpl.goals.map((_, i) => i));
            const actMap = new Map<number, Set<number>>();
            tpl.goals.forEach((_, gi) => actMap.set(gi, new Set(tpl.activities.map((_, ai) => ai))));
            configs.set(key, { goals: goalSet, activities: actMap, customGoals: [], importance: null, confidence: null });
        });
        setDomainConfigs(configs);
    };

    const toggleGoal = (domainKey: string, goalIdx: number) => {
        setDomainConfigs(prev => {
            const next = new Map(prev);
            const cfg = { ...next.get(domainKey)! };
            const goals = new Set(cfg.goals);
            if (goals.has(goalIdx)) goals.delete(goalIdx); else goals.add(goalIdx);
            cfg.goals = goals;
            next.set(domainKey, cfg);
            return next;
        });
    };

    const toggleActivity = (domainKey: string, goalIdx: number, actIdx: number) => {
        setDomainConfigs(prev => {
            const next = new Map(prev);
            const cfg = { ...next.get(domainKey)! };
            const actMap = new Map(cfg.activities);
            const acts = new Set<number>(actMap.get(goalIdx) || new Set<number>());
            if (acts.has(actIdx)) acts.delete(actIdx); else acts.add(actIdx);
            actMap.set(goalIdx, acts);
            cfg.activities = actMap;
            next.set(domainKey, cfg);
            return next;
        });
    };

    // ========================================================================
    // Save plan
    // ========================================================================
    const handleSavePlan = async () => {
        if (!selectedParticipant || selectedDomainKeys.size === 0) return;
        setSaving(true); setError('');

        const domains = Array.from(selectedDomainKeys).map((key, di) => {
            const tpl = DOMAIN_TEMPLATE.find(d => d.key === key)!;
            const cfg = domainConfigs.get(key);
            const selectedGoals = tpl.goals
                .map((g, i) => ({ text: g, idx: i }))
                .filter((_, i) => cfg?.goals.has(i) ?? true);

            return {
                domain_key: key,
                importance_rating: cfg?.importance || null,
                confidence_rating: cfg?.confidence || null,
                sort_order: di,
                goals: selectedGoals.map((g, gi) => {
                    const selectedActs = tpl.activities
                        .map((a, i) => ({ text: a, idx: i }))
                        .filter((_, i) => cfg?.activities.get(g.idx)?.has(i) ?? true);

                    return {
                        goal_text: g.text,
                        is_custom: false,
                        sort_order: gi,
                        activities: selectedActs.map((a, ai) => ({
                            activity_text: a.text,
                            is_custom: false,
                            sort_order: ai,
                        })),
                    };
                }),
            };
        });

        try {
            const res = await fetch('/api/rc-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg!.id,
                    participant_id: selectedParticipant.id,
                    domains,
                }),
            });
            const data = await res.json();
            if (data.success) {
                await fetchPlans();
                resetCreate();
                setView('list');
            } else {
                setError(data.error || 'Failed to save');
            }
        } catch (e) { setError('Network error'); }
        finally { setSaving(false); }
    };

    const resetCreate = () => {
        setSelectedParticipant(null); setParticipantSearch(''); setSelectedDomainKeys(new Set());
        setDomainConfigs(new Map()); setError('');
    };

    // ========================================================================
    // Update status inline
    // ========================================================================
    const updateItem = async (type: string, id: string, data: any) => {
        setUpdatingId(id);
        try {
            await fetch('/api/rc-plans', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, id, _plan_id: selectedPlan?.id, ...data }),
            });
            if (selectedPlan) await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setUpdatingId(null); }
    };

    // ========================================================================
    // Add items to existing plan
    // ========================================================================
    const [addingGoalToDomain, setAddingGoalToDomain] = useState<string | null>(null);
    const [newGoalText, setNewGoalText] = useState('');
    const [addingActivityToGoal, setAddingActivityToGoal] = useState<string | null>(null);
    const [newActivityText, setNewActivityText] = useState('');
    const [editingFrequency, setEditingFrequency] = useState<string | null>(null);
    const [freqValue, setFreqValue] = useState('');
    const [showAddDomain, setShowAddDomain] = useState(false);
    const [addItemLoading, setAddItemLoading] = useState(false);

    const addGoalToDomain = async (domainEntryId: string) => {
        if (!newGoalText.trim()) return;
        setAddItemLoading(true);
        try {
            await fetch('/api/rc-plans/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'goal',
                    domain_entry_id: domainEntryId,
                    goal_text: newGoalText.trim(),
                    is_custom: true,
                }),
            });
            setNewGoalText('');
            setAddingGoalToDomain(null);
            if (selectedPlan) await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setAddItemLoading(false); }
    };

    const addActivityToGoal = async (goalEntryId: string) => {
        if (!newActivityText.trim()) return;
        setAddItemLoading(true);
        try {
            await fetch('/api/rc-plans/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'activity',
                    goal_entry_id: goalEntryId,
                    activity_text: newActivityText.trim(),
                    is_custom: true,
                }),
            });
            setNewActivityText('');
            setAddingActivityToGoal(null);
            if (selectedPlan) await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setAddItemLoading(false); }
    };

    const addDomainToPlan = async (domainKey: string) => {
        if (!selectedPlan) return;
        setAddItemLoading(true);
        const tpl = getDomainTemplate(domainKey);
        if (!tpl) return;
        try {
            await fetch('/api/rc-plans/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'domain',
                    plan_id: selectedPlan.id,
                    domain_key: domainKey,
                    goals: tpl.goals.map((g, gi) => ({
                        goal_text: g,
                        activities: tpl.activities.map((a, ai) => ({ activity_text: a })),
                    })),
                }),
            });
            setShowAddDomain(false);
            await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setAddItemLoading(false); }
    };

    const generatePlanSummary = async () => {
        if (!selectedPlan || !currentOrg?.id) return;
        setGeneratingSummary(true);
        setSummaryError('');
        try {
            const res = await fetch('/api/rc-plans/generate-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_id: selectedPlan.id,
                    organization_id: currentOrg.id,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate summary');
            setSelectedPlan(prev => prev ? { ...prev, plan_summary: data.summary } : prev);
        } catch (e: any) {
            setSummaryError(e.message || 'Failed to generate summary');
        } finally {
            setGeneratingSummary(false);
        }
    };

    const deleteItem = async (type: string, id: string) => {
        if (!confirm(`Delete this ${type}? This cannot be undone.`)) return;
        setUpdatingId(id);
        try {
            await fetch(`/api/rc-plans?type=${type}&id=${id}`, { method: 'DELETE' });
            if (selectedPlan) await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setUpdatingId(null); }
    };

    // ========================================================================
    // Outcome recording
    // ========================================================================
    const [outcomeValues, setOutcomeValues] = useState<Record<string, string>>({});
    const [recordingOutcome, setRecordingOutcome] = useState<string | null>(null);
    const [outcomeLoading, setOutcomeLoading] = useState(false);

    const recordOutcome = async (domainEntryId: string, measureKey: string, measureType: string, label: string, value: string) => {
        if (!value.trim()) return;
        setOutcomeLoading(true);
        try {
            await fetch('/api/rc-plans/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'outcome',
                    domain_entry_id: domainEntryId,
                    measure_key: measureKey,
                    measure_type: measureType,
                    label,
                    value: value.trim(),
                }),
            });
            setOutcomeValues(prev => ({ ...prev, [measureKey]: '' }));
            setRecordingOutcome(null);
            if (selectedPlan) await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setOutcomeLoading(false); }
    };

    const deleteOutcome = async (outcomeId: string) => {
        if (!confirm('Delete this outcome record?')) return;
        setUpdatingId(outcomeId);
        try {
            await fetch(`/api/rc-plans?type=outcome&id=${outcomeId}`, { method: 'DELETE' });
            if (selectedPlan) await fetchPlanDetail(selectedPlan.id);
        } catch (e) { console.error(e); }
        finally { setUpdatingId(null); }
    };

    // ========================================================================
    // Helpers
    // ========================================================================
    const getDomainTemplate = (key: string) => DOMAIN_TEMPLATE.find(d => d.key === key);

    const getParticipantName = (p: Participant | null) =>
        p ? `${p.preferred_name || p.first_name} ${p.last_name}` : '';

    const filteredParticipants = participants.filter(p => {
        const name = `${p.first_name} ${p.last_name} ${p.preferred_name || ''}`.toLowerCase();
        return name.includes(participantSearch.toLowerCase());
    });

    const statusColors: Record<string, string> = {
        not_started: '#9CA3AF', in_progress: '#3B82F6', completed: '#10B981', ongoing: '#F59E0B',
        active: '#3B82F6', on_hold: '#F97316', archived: '#6B7280',
    };

    const statusLabels: Record<string, string> = {
        not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', ongoing: 'Ongoing',
        active: 'Active', on_hold: 'On Hold', archived: 'Archived',
    };

    // ========================================================================
    // Loading
    // ========================================================================
    if (authStatus === 'loading') {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50"><Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" /></div>;
    }

    // ========================================================================
    // RENDER
    // ========================================================================
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => {
                                if (view === 'list') router.push('/');
                                else if (view === 'detail') { setSelectedPlan(null); setView('list'); }
                                else if (view === 'create_select_domains') setView('create_select_participant');
                                else if (view === 'create_configure') setView('create_select_domains');
                                else { resetCreate(); setView('list'); }
                            }} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">Recovery Plans</h1>
                                <p className="text-sm text-gray-500">
                                    {view === 'list' && 'Template-driven recovery planning'}
                                    {view === 'create_select_participant' && 'Step 1: Select Participant'}
                                    {view === 'create_select_domains' && 'Step 2: Select Recovery Domains'}
                                    {view === 'create_configure' && 'Step 3: Customize Goals & Activities'}
                                    {view === 'detail' && (selectedPlan ? getParticipantName({ first_name: selectedPlan.participant_first_name!, last_name: selectedPlan.participant_last_name!, preferred_name: selectedPlan.participant_preferred_name, id: '', status: '' }) : '')}
                                </p>
                            </div>
                        </div>
                        {view === 'list' && (
                            <button onClick={() => { resetCreate(); setView('create_select_participant'); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-medium hover:opacity-90"
                            >
                                <Plus className="w-4 h-4" /> New Plan
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 py-8">

                {/* ============================================================ */}
                {/* LIST VIEW                                                     */}
                {/* ============================================================ */}
                {view === 'list' && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                        ) : plans.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                                <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Recovery Plans Yet</h3>
                                <p className="text-gray-500 mb-6">Create a plan using the 10-domain recovery framework</p>
                                <button onClick={() => { resetCreate(); setView('create_select_participant'); }}
                                    className="px-6 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-medium hover:opacity-90"
                                >
                                    <Plus className="w-4 h-4 inline mr-2" /> Create First Plan
                                </button>
                            </div>
                        ) : (
                            plans.map(plan => {
                                const pName = plan.participant_preferred_name || plan.participant_first_name || '';
                                const goalPct = plan.total_goals ? Math.round(((plan.completed_goals || 0) / plan.total_goals) * 100) : 0;
                                return (
                                    <button key={plan.id} onClick={() => { fetchPlanDetail(plan.id); setView('detail'); }}
                                        className="w-full bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-semibold text-[#0E2235]">
                                                    {pName} {plan.participant_last_name || ''}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {plan.domain_count || 0} domains · {plan.total_goals || 0} goals · Created {new Date(plan.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${statusColors[plan.status]}15`, color: statusColors[plan.status] }}>
                                                    {statusLabels[plan.status]}
                                                </span>
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </div>
                                        </div>
                                        {(plan.total_goals ?? 0) > 0 && (
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                    <span>Goal Progress</span>
                                                    <span>{plan.completed_goals || 0}/{plan.total_goals || 0} completed</span>
                                                </div>
                                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-[#1A73A8] to-[#30B27A] rounded-full transition-all" style={{ width: `${goalPct}%` }} />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* CREATE: Step 1 – Select Participant                           */}
                {/* ============================================================ */}
                {view === 'create_select_participant' && (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="bg-white rounded-2xl p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-[#0E2235] mb-4">Who is this plan for?</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <input
                                    type="text" value={participantSearch}
                                    onChange={e => { setParticipantSearch(e.target.value); setShowDropdown(true); }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder="Search participants..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-[#1A73A8]"
                                />
                                {showDropdown && filteredParticipants.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                        {filteredParticipants.map(p => (
                                            <button key={p.id} onClick={() => {
                                                setSelectedParticipant(p); setShowDropdown(false); setParticipantSearch('');
                                            }}
                                                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-xs font-bold">
                                                    {p.first_name[0]}{p.last_name[0]}
                                                </div>
                                                <span className="font-medium text-[#0E2235]">{p.preferred_name || p.first_name} {p.last_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedParticipant && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        <span className="font-medium text-green-800">{getParticipantName(selectedParticipant)}</span>
                                    </div>
                                    <button onClick={() => setSelectedParticipant(null)} className="text-green-600 hover:text-green-800"><X className="w-4 h-4" /></button>
                                </div>
                            )}

                            <button
                                disabled={!selectedParticipant}
                                onClick={() => setView('create_select_domains')}
                                className="mt-6 w-full py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-semibold disabled:opacity-50 hover:opacity-90"
                            >
                                Next: Select Domains
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* CREATE: Step 2 – Select Domains                               */}
                {/* ============================================================ */}
                {view === 'create_select_domains' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-xs font-bold">
                                    {selectedParticipant?.first_name[0]}{selectedParticipant?.last_name[0]}
                                </div>
                                <span className="font-medium text-[#0E2235]">{getParticipantName(selectedParticipant)}</span>
                            </div>
                            <p className="text-sm text-gray-500">Select the recovery domains to include in this plan. You can customize goals and activities in the next step.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {DOMAIN_TEMPLATE.map(domain => {
                                const Icon = domain.icon;
                                const selected = selectedDomainKeys.has(domain.key);
                                return (
                                    <button key={domain.key} onClick={() => toggleDomain(domain.key)}
                                        className={`text-left rounded-2xl p-5 border-2 transition-all ${selected ? 'border-[#1A73A8] bg-blue-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: domain.bgColor }}>
                                                <Icon className="w-5 h-5" style={{ color: domain.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400">{domain.number}</span>
                                                    <h3 className="font-semibold text-[#0E2235] text-sm">{domain.name}</h3>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">{domain.goals.length} goals · {domain.activities.length} activities</p>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#1A73A8] bg-[#1A73A8]' : 'border-gray-300'}`}>
                                                {selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setView('create_select_participant')}
                                className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                            >Back</button>
                            <button
                                disabled={selectedDomainKeys.size === 0}
                                onClick={() => { initDomainConfigs(); setView('create_configure'); }}
                                className="flex-1 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-semibold disabled:opacity-50 hover:opacity-90"
                            >
                                Next: Customize ({selectedDomainKeys.size} selected)
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* CREATE: Step 3 – Configure Goals & Activities                  */}
                {/* ============================================================ */}
                {view === 'create_configure' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <p className="text-sm text-gray-600">
                                <strong>{getParticipantName(selectedParticipant)}</strong> — {selectedDomainKeys.size} domains selected.
                                Uncheck any goals or activities that don&apos;t apply.
                            </p>
                        </div>

                        {Array.from(selectedDomainKeys).map(key => {
                            const tpl = getDomainTemplate(key);
                            if (!tpl) return null;
                            const cfg = domainConfigs.get(key);
                            const Icon = tpl.icon;

                            return (
                                <div key={key} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-gray-100" style={{ backgroundColor: `${tpl.color}08` }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: tpl.bgColor }}>
                                                <Icon className="w-5 h-5" style={{ color: tpl.color }} />
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-400">{tpl.number}</span>
                                                <h3 className="font-semibold text-[#0E2235]">{tpl.name}</h3>
                                            </div>
                                        </div>

                                        {/* Scaling questions */}
                                        {tpl.scalingQuestions.length > 0 && (
                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                {tpl.scalingQuestions.map((q, i) => (
                                                    <div key={i}>
                                                        <label className="text-xs text-gray-600 block mb-1">{q}</label>
                                                        <input type="number" min="0" max="10" placeholder="0-10"
                                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                                            value={i === 0 ? (cfg?.importance ?? '') : (cfg?.confidence ?? '')}
                                                            onChange={e => {
                                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                                setDomainConfigs(prev => {
                                                                    const next = new Map(prev);
                                                                    const c = { ...next.get(key)! };
                                                                    if (i === 0) c.importance = val; else c.confidence = val;
                                                                    next.set(key, c);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-5">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Goals</h4>
                                        <div className="space-y-2 mb-5">
                                            {tpl.goals.map((goal, gi) => {
                                                const goalSelected = cfg?.goals.has(gi) ?? true;
                                                return (
                                                    <label key={gi} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${goalSelected ? 'bg-green-50' : 'bg-gray-50 opacity-60'}`}>
                                                        <input type="checkbox" checked={goalSelected} onChange={() => toggleGoal(key, gi)}
                                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                                        <span className="text-sm text-gray-800">{goal}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Activities</h4>
                                        <div className="space-y-1.5">
                                            {tpl.activities.map((act, ai) => {
                                                // Activity is shown if any selected goal includes it
                                                const actSelected = cfg?.activities.get(0)?.has(ai) ?? true;
                                                return (
                                                    <label key={ai} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${actSelected ? 'bg-blue-50/50' : 'bg-gray-50 opacity-60'}`}>
                                                        <input type="checkbox" checked={actSelected} onChange={() => toggleActivity(key, 0, ai)}
                                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1A73A8] focus:ring-[#1A73A8]" />
                                                        <span className="text-sm text-gray-700">{act}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {tpl.instruments.length > 0 && (
                                            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                                                <p className="text-xs font-medium text-gray-500 mb-1">Linked Instruments</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {tpl.instruments.map(inst => (
                                                        <span key={inst} className="text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600">{inst}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {tpl.outcomes.length > 0 && (
                                            <div className="mt-3 p-3 bg-amber-50 rounded-xl">
                                                <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                                                    <BarChart3 className="w-3 h-3" /> Outcome Measures
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {tpl.outcomes.map((o: any) => (
                                                        <span key={o.key} className="text-xs px-2 py-1 rounded-full bg-white border border-amber-200 text-amber-700">{o.label}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
                        )}

                        <div className="flex gap-4">
                            <button onClick={() => setView('create_select_domains')}
                                className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
                            >Back</button>
                            <button onClick={handleSavePlan} disabled={saving}
                                className="flex-1 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Create Recovery Plan'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* DETAIL VIEW                                                   */}
                {/* ============================================================ */}
                {view === 'detail' && (
                    <div className="space-y-4">
                        {detailLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                        ) : !selectedPlan ? (
                            <p className="text-center text-gray-500">Plan not found</p>
                        ) : (
                            <>
                                {/* Plan header */}
                                <div className="bg-white rounded-2xl p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-[#0E2235]">
                                                {selectedPlan.participant_preferred_name || selectedPlan.participant_first_name} {selectedPlan.participant_last_name}
                                            </h2>
                                            <p className="text-sm text-gray-500">Created {new Date(selectedPlan.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <select value={selectedPlan.status}
                                            onChange={e => updateItem('plan', selectedPlan.id, { status: e.target.value })}
                                            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                                        >
                                            <option value="active">Active</option>
                                            <option value="completed">Completed</option>
                                            <option value="on_hold">On Hold</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                    </div>

                                    {/* Domain summary chips */}
                                    <div className="flex flex-wrap gap-2">
                                        {selectedPlan.domains?.map(d => {
                                            const tpl = getDomainTemplate(d.domain_key);
                                            if (!tpl) return null;
                                            const Icon = tpl.icon;
                                            const completedGoals = d.goals?.filter(g => g.status === 'completed').length || 0;
                                            const totalGoals = d.goals?.length || 0;
                                            return (
                                                <button key={d.id} onClick={() => {
                                                    setExpandedDomains(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(d.id!)) next.delete(d.id!); else next.add(d.id!);
                                                        return next;
                                                    });
                                                }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                                                    style={{ borderColor: tpl.color, color: tpl.color, backgroundColor: tpl.bgColor }}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {tpl.name.split('(')[0].trim()}
                                                    <span className="text-gray-400 ml-1">{completedGoals}/{totalGoals}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Plan Summary */}
                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-[#1A73A8]" />
                                                <span className="text-sm font-semibold text-[#0E2235]">Plan Summary</span>
                                                {selectedPlan.plan_summary && (
                                                    <span className="text-xs text-gray-400 font-normal">AI-generated · grounded in SAMHSA recovery standards</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={generatePlanSummary}
                                                disabled={generatingSummary}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#1A73A8] text-[#1A73A8] hover:bg-blue-50 disabled:opacity-50 transition-colors"
                                            >
                                                {generatingSummary
                                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                                                    : <><Sparkles className="w-3.5 h-3.5" /> {selectedPlan.plan_summary ? 'Regenerate' : 'Generate Summary'}</>
                                                }
                                            </button>
                                        </div>

                                        {summaryError && (
                                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                {summaryError}
                                            </div>
                                        )}

                                        {selectedPlan.plan_summary ? (
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                {selectedPlan.plan_summary}
                                            </p>
                                        ) : !generatingSummary && (
                                            <p className="text-sm text-gray-400 italic">
                                                No summary yet. Click &ldquo;Generate Summary&rdquo; to create an AI-written narrative grounded in recovery best practices.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Domain cards */}
                                {selectedPlan.domains?.map(domain => {
                                    const tpl = getDomainTemplate(domain.domain_key);
                                    if (!tpl) return null;
                                    const Icon = tpl.icon;
                                    const isExpanded = expandedDomains.has(domain.id!);

                                    return (
                                        <div key={domain.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                            <button onClick={() => {
                                                setExpandedDomains(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(domain.id!)) next.delete(domain.id!); else next.add(domain.id!);
                                                    return next;
                                                });
                                            }}
                                                className="w-full p-5 flex items-center justify-between text-left"
                                                style={{ backgroundColor: `${tpl.color}08` }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: tpl.bgColor }}>
                                                        <Icon className="w-5 h-5" style={{ color: tpl.color }} />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-400">{tpl.number}</span>
                                                        <h3 className="font-semibold text-[#0E2235]">{tpl.name}</h3>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {domain.importance_rating !== null && (
                                                        <span className="text-xs text-gray-500">Imp: {domain.importance_rating}/10</span>
                                                    )}
                                                    {domain.confidence_rating !== null && (
                                                        <span className="text-xs text-gray-500">Conf: {domain.confidence_rating}/10</span>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="p-5 space-y-5">
                                                    {domain.goals?.map(goal => (
                                                        <div key={goal.id} className="border border-gray-100 rounded-xl overflow-hidden">
                                                            <div className="p-4 bg-gray-50 flex items-center justify-between">
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    <Target className="w-4 h-4 flex-shrink-0" style={{ color: tpl.color }} />
                                                                    <span className="font-medium text-[#0E2235] text-sm">{goal.goal_text}</span>
                                                                    {goal.is_custom && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">custom</span>}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <select value={goal.status}
                                                                        onChange={e => updateItem('goal', goal.id!, { status: e.target.value })}
                                                                        className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                                                                        style={{ color: statusColors[goal.status] }}
                                                                    >
                                                                        <option value="not_started">Not Started</option>
                                                                        <option value="in_progress">In Progress</option>
                                                                        <option value="completed">Completed</option>
                                                                        <option value="ongoing">Ongoing</option>
                                                                    </select>
                                                                    {goal.is_custom && (
                                                                        <button onClick={() => deleteItem('goal', goal.id!)} className="p-1 text-red-400 hover:text-red-600">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="divide-y divide-gray-50">
                                                                {goal.activities?.map(act => (
                                                                    <div key={act.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 group">
                                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                            <button onClick={() => {
                                                                                const nextStatus = act.status === 'completed' ? 'not_started' :
                                                                                    act.status === 'not_started' ? 'in_progress' : 'completed';
                                                                                updateItem('activity', act.id!, { status: nextStatus });
                                                                            }} className="flex-shrink-0">
                                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                                                    act.status === 'completed' ? 'border-green-500 bg-green-500' :
                                                                                    act.status === 'in_progress' ? 'border-blue-500 bg-blue-100' :
                                                                                    'border-gray-300'
                                                                                }`}>
                                                                                    {act.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                                                    {act.status === 'in_progress' && <Clock className="w-3 h-3 text-blue-500" />}
                                                                                </div>
                                                                            </button>
                                                                            <span className={`text-sm ${act.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                                                {act.activity_text}
                                                                            </span>
                                                                            {act.is_custom && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">custom</span>}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {/* Frequency display/edit */}
                                                                            {editingFrequency === act.id ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <input type="text" value={freqValue}
                                                                                        onChange={e => setFreqValue(e.target.value)}
                                                                                        placeholder="e.g. 3x/week"
                                                                                        className="w-24 text-xs border border-gray-300 rounded px-2 py-1"
                                                                                        onKeyDown={e => {
                                                                                            if (e.key === 'Enter') {
                                                                                                updateItem('activity', act.id!, { frequency: freqValue });
                                                                                                setEditingFrequency(null);
                                                                                            }
                                                                                        }}
                                                                                        autoFocus
                                                                                    />
                                                                                    <button onClick={() => { updateItem('activity', act.id!, { frequency: freqValue }); setEditingFrequency(null); }}
                                                                                        className="text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                                                                    <button onClick={() => setEditingFrequency(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <button onClick={() => { setEditingFrequency(act.id!); setFreqValue(act.frequency || ''); }}
                                                                                    className="text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                >
                                                                                    {act.frequency || 'Set freq.'}
                                                                                </button>
                                                                            )}
                                                                            {act.frequency && editingFrequency !== act.id && (
                                                                                <span className="text-xs text-gray-400">{act.frequency}</span>
                                                                            )}
                                                                            {act.is_custom && (
                                                                                <button onClick={() => deleteItem('activity', act.id!)}
                                                                                    className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Add activity */}
                                                                {addingActivityToGoal === goal.id ? (
                                                                    <div className="px-4 py-3 flex items-center gap-2">
                                                                        <input type="text" value={newActivityText}
                                                                            onChange={e => setNewActivityText(e.target.value)}
                                                                            placeholder="Enter custom activity..."
                                                                            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#1A73A8] focus:border-[#1A73A8]"
                                                                            onKeyDown={e => { if (e.key === 'Enter') addActivityToGoal(goal.id!); }}
                                                                            autoFocus
                                                                        />
                                                                        <button onClick={() => addActivityToGoal(goal.id!)} disabled={addItemLoading || !newActivityText.trim()}
                                                                            className="px-3 py-1.5 bg-[#1A73A8] text-white text-xs rounded-lg disabled:opacity-50 hover:bg-[#156090]">
                                                                            {addItemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                                                                        </button>
                                                                        <button onClick={() => { setAddingActivityToGoal(null); setNewActivityText(''); }}
                                                                            className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => { setAddingActivityToGoal(goal.id!); setNewActivityText(''); }}
                                                                        className="w-full px-4 py-2.5 text-xs text-gray-400 hover:text-[#1A73A8] hover:bg-blue-50/50 text-left flex items-center gap-2">
                                                                        <Plus className="w-3.5 h-3.5" /> Add Activity
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Add goal to domain */}
                                                    {addingGoalToDomain === domain.id ? (
                                                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                                                            <input type="text" value={newGoalText}
                                                                onChange={e => setNewGoalText(e.target.value)}
                                                                placeholder="Enter custom goal..."
                                                                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                                onKeyDown={e => { if (e.key === 'Enter') addGoalToDomain(domain.id!); }}
                                                                autoFocus
                                                            />
                                                            <button onClick={() => addGoalToDomain(domain.id!)} disabled={addItemLoading || !newGoalText.trim()}
                                                                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-50 hover:bg-green-700">
                                                                {addItemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Goal'}
                                                            </button>
                                                            <button onClick={() => { setAddingGoalToDomain(null); setNewGoalText(''); }}
                                                                className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setAddingGoalToDomain(domain.id!); setNewGoalText(''); }}
                                                            className="w-full py-3 text-sm text-gray-400 hover:text-[#30B27A] hover:bg-green-50/50 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#30B27A]/40 flex items-center justify-center gap-2 transition-colors">
                                                            <Plus className="w-4 h-4" /> Add Custom Goal
                                                        </button>
                                                    )}

                                                    {/* Linked instruments */}
                                                    {tpl.instruments.length > 0 && (
                                                        <div className="p-3 bg-gray-50 rounded-xl">
                                                            <p className="text-xs font-medium text-gray-500 mb-1.5">Linked Instruments</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {tpl.instruments.map(inst => (
                                                                    <span key={inst} className="text-xs px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-600">{inst}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ── Outcome Measures ── */}
                                                    {tpl.outcomes.length > 0 && (
                                                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
                                                            <div className="px-4 py-3 bg-amber-100/50 flex items-center gap-2">
                                                                <BarChart3 className="w-4 h-4 text-amber-600" />
                                                                <p className="text-sm font-semibold text-amber-800">Outcome Measures</p>
                                                            </div>
                                                            <div className="p-4 space-y-4">
                                                                {tpl.outcomes.map((measure: any) => {
                                                                    const recorded = domain.outcomes?.filter((o: PlanOutcome) => o.measure_key === measure.key) || [];
                                                                    const latestValue = recorded.length > 0 ? recorded[0].value : null;
                                                                    const isRecording = recordingOutcome === `${domain.id}_${measure.key}`;
                                                                    const inputKey = `${measure.key}`;

                                                                    return (
                                                                        <div key={measure.key} className="bg-white rounded-lg p-3 border border-amber-100">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                    {measure.type === 'boolean' && (
                                                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                                                            latestValue === 'true' || latestValue === 'yes' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                                                                                        }`}>
                                                                                            {(latestValue === 'true' || latestValue === 'yes') && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                                                        </div>
                                                                                    )}
                                                                                    {measure.type === 'assessment_link' && (
                                                                                        <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                                                                            <Activity className="w-3 h-3 text-indigo-600" />
                                                                                        </div>
                                                                                    )}
                                                                                    {(measure.type === 'number' || measure.type === 'rating_10') && (
                                                                                        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                                                            <BarChart3 className="w-3 h-3 text-amber-600" />
                                                                                        </div>
                                                                                    )}
                                                                                    <span className="text-sm font-medium text-gray-700">{measure.label}</span>
                                                                                </div>

                                                                                {/* Current value badge */}
                                                                                {latestValue && (
                                                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                                                        measure.type === 'boolean'
                                                                                            ? (latestValue === 'true' || latestValue === 'yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')
                                                                                            : 'bg-amber-100 text-amber-700'
                                                                                    }`}>
                                                                                        {measure.type === 'boolean'
                                                                                            ? (latestValue === 'true' || latestValue === 'yes' ? 'Yes' : 'No')
                                                                                            : measure.type === 'rating_10' ? `${latestValue}/10` : latestValue
                                                                                        }
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {/* Record new value */}
                                                                            {isRecording ? (
                                                                                <div className="flex items-center gap-2 mt-2">
                                                                                    {measure.type === 'boolean' ? (
                                                                                        <div className="flex gap-2">
                                                                                            <button onClick={() => recordOutcome(domain.id!, measure.key, measure.type, measure.label, 'yes')}
                                                                                                disabled={outcomeLoading}
                                                                                                className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:opacity-50">Yes</button>
                                                                                            <button onClick={() => recordOutcome(domain.id!, measure.key, measure.type, measure.label, 'no')}
                                                                                                disabled={outcomeLoading}
                                                                                                className="px-3 py-1.5 bg-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-400 disabled:opacity-50">No</button>
                                                                                        </div>
                                                                                    ) : measure.type === 'rating_10' ? (
                                                                                        <div className="flex items-center gap-1 flex-wrap">
                                                                                            {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                                                                                                <button key={n} onClick={() => recordOutcome(domain.id!, measure.key, measure.type, measure.label, String(n))}
                                                                                                    disabled={outcomeLoading}
                                                                                                    className="w-7 h-7 text-xs rounded-lg border border-gray-200 hover:bg-amber-100 hover:border-amber-300 disabled:opacity-50">{n}</button>
                                                                                            ))}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <>
                                                                                            <input type={measure.type === 'number' ? 'number' : 'text'}
                                                                                                value={outcomeValues[inputKey] || ''}
                                                                                                onChange={e => setOutcomeValues(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                                                                placeholder={measure.type === 'number' ? 'Enter value...' : 'Enter...'}
                                                                                                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                                                                onKeyDown={e => { if (e.key === 'Enter') recordOutcome(domain.id!, measure.key, measure.type, measure.label, outcomeValues[inputKey] || ''); }}
                                                                                                autoFocus
                                                                                            />
                                                                                            <button onClick={() => recordOutcome(domain.id!, measure.key, measure.type, measure.label, outcomeValues[inputKey] || '')}
                                                                                                disabled={outcomeLoading || !(outcomeValues[inputKey] || '').trim()}
                                                                                                className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg disabled:opacity-50 hover:bg-amber-600">
                                                                                                {outcomeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                                                                            </button>
                                                                                        </>
                                                                                    )}
                                                                                    <button onClick={() => setRecordingOutcome(null)}
                                                                                        className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <button onClick={() => setRecordingOutcome(`${domain.id}_${measure.key}`)}
                                                                                    className="text-xs text-amber-600 hover:text-amber-700 mt-1 flex items-center gap-1">
                                                                                    <Plus className="w-3 h-3" /> Record {latestValue ? 'new value' : 'value'}
                                                                                </button>
                                                                            )}

                                                                            {/* History of recorded values */}
                                                                            {recorded.length > 0 && (
                                                                                <div className="mt-2 border-t border-amber-100 pt-2">
                                                                                    <p className="text-xs text-gray-400 mb-1">History</p>
                                                                                    <div className="space-y-1">
                                                                                        {recorded.slice(0, 5).map((rec: PlanOutcome) => (
                                                                                            <div key={rec.id} className="flex items-center justify-between text-xs group">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="text-gray-500">{new Date(rec.recorded_at).toLocaleDateString()}</span>
                                                                                                    <span className="font-medium text-gray-700">
                                                                                                        {measure.type === 'boolean'
                                                                                                            ? (rec.value === 'true' || rec.value === 'yes' ? 'Yes' : 'No')
                                                                                                            : measure.type === 'rating_10' ? `${rec.value}/10` : rec.value
                                                                                                        }
                                                                                                    </span>
                                                                                                    {rec.recorded_by_first_name && (
                                                                                                        <span className="text-gray-400">by {rec.recorded_by_first_name} {rec.recorded_by_last_name?.charAt(0)}.</span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <button onClick={() => deleteOutcome(rec.id!)}
                                                                                                    className="p-0.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                    <Trash2 className="w-3 h-3" />
                                                                                                </button>
                                                                                            </div>
                                                                                        ))}
                                                                                        {recorded.length > 5 && (
                                                                                            <p className="text-xs text-gray-400">+{recorded.length - 5} more</p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Add domain to plan */}
                                {showAddDomain ? (
                                    <div className="bg-white rounded-2xl p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-[#0E2235]">Add Recovery Domain</h3>
                                            <button onClick={() => setShowAddDomain(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {DOMAIN_TEMPLATE
                                                .filter(tpl => !selectedPlan?.domains?.some(d => d.domain_key === tpl.key))
                                                .map(tpl => {
                                                    const Icon = tpl.icon;
                                                    return (
                                                        <button key={tpl.key} onClick={() => addDomainToPlan(tpl.key)} disabled={addItemLoading}
                                                            className="text-left rounded-xl p-4 border border-gray-200 hover:border-[#1A73A8]/40 hover:bg-blue-50/30 transition-all flex items-center gap-3 disabled:opacity-50"
                                                        >
                                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: tpl.bgColor }}>
                                                                <Icon className="w-4 h-4" style={{ color: tpl.color }} />
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-bold text-gray-400">{tpl.number}</span>
                                                                <p className="text-sm font-medium text-[#0E2235]">{tpl.name}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                        {selectedPlan?.domains?.length === DOMAIN_TEMPLATE.length && (
                                            <p className="text-sm text-gray-500 text-center py-4">All 10 domains are already included in this plan.</p>
                                        )}
                                    </div>
                                ) : (
                                    <button onClick={() => setShowAddDomain(true)}
                                        className="w-full py-4 text-sm text-gray-400 hover:text-[#1A73A8] hover:bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#1A73A8]/40 flex items-center justify-center gap-2 transition-colors">
                                        <Plus className="w-4 h-4" /> Add Recovery Domain
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
