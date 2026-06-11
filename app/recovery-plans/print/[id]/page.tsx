'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { formatDateOnly } from '@/lib/dateUtils';

// Domain headings for the printed document (mirrors DOMAIN_TEMPLATE keys).
const DOMAIN_NAMES: Record<string, string> = {
    substance_use: 'I. Alcohol/Substance Use and Sobriety',
    emotional_wellbeing: 'II. Emotional Wellbeing',
    physical_health: 'III. Physical Health Wellbeing',
    civic_engagement: 'IV. Civic and Community Engagement',
    functional_wellbeing: 'V. Functional Wellbeing (Coping and Life Functioning)',
    meaning_purpose: 'VI. Meaning & Purpose',
    housing: 'VII. Housing Status',
    risk_taking: 'VIII. Risk Taking',
    recovery_experience: 'IX. Recovery Experience',
    social_support: 'X. Social Support',
};

const STATUS_LABELS: Record<string, string> = {
    not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', ongoing: 'Ongoing',
    active: 'Active', on_hold: 'On Hold', archived: 'Archived',
};

export default function RecoveryPlanPrintPage() {
    const router = useRouter();
    const params = useParams();
    const planId = params.id as string;
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/auth/signin');
    }, [authStatus, router]);

    useEffect(() => {
        if (!currentOrg?.id || !planId) return;
        (async () => {
            try {
                const res = await fetch(`/api/rc-plans?organization_id=${currentOrg.id}&id=${planId}`);
                const data = await res.json();
                if (!res.ok || !data.plan) throw new Error(data.error || 'Plan not found');
                setPlan(data.plan);
            } catch (e: any) {
                setError(e.message || 'Failed to load plan');
            } finally {
                setLoading(false);
            }
        })();
    }, [currentOrg?.id, planId]);

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
                <p className="text-gray-600">{error || 'Plan not found'}</p>
                <button onClick={() => router.push('/recovery-plans')} className="text-[#1A73A8] hover:underline">
                    Back to Recovery Plans
                </button>
            </div>
        );
    }

    const participantName = `${plan.participant_preferred_name || plan.participant_first_name || ''} ${plan.participant_last_name || ''}`.trim();
    const staffSig = plan.signatures?.find((s: any) => s.signer_role === 'staff');
    const residentSig = plan.signatures?.find((s: any) => s.signer_role === 'resident');

    return (
        <div className="min-h-screen bg-white text-[#111827]">
            {/* Toolbar — hidden when printing */}
            <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10">
                <button onClick={() => router.push(`/recovery-plans?view=${plan.id}`)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4" /> Back to plan
                </button>
                <button onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg font-medium hover:bg-[#156090]">
                    <Printer className="w-4 h-4" /> Print / Save as PDF
                </button>
            </div>

            <main className="max-w-[760px] mx-auto px-8 py-10 print:px-0 print:py-0 text-sm leading-relaxed">
                {/* Document header */}
                <header className="border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 className="text-2xl font-bold">Recovery Plan</h1>
                    <p className="text-gray-600 mt-1">{currentOrg?.name}</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4">
                        <p><span className="font-semibold">Resident:</span> {participantName}</p>
                        <p><span className="font-semibold">Plan:</span> {plan.plan_name}</p>
                        <p><span className="font-semibold">Created:</span> {new Date(plan.created_at).toLocaleDateString()}</p>
                        <p><span className="font-semibold">Status:</span> {STATUS_LABELS[plan.status] || plan.status}</p>
                        {plan.next_review_date && (
                            <p><span className="font-semibold">Next review:</span> {formatDateOnly(plan.next_review_date)}</p>
                        )}
                        <p><span className="font-semibold">Printed:</span> {new Date().toLocaleDateString()}</p>
                    </div>
                </header>

                {/* Narrative summary */}
                {plan.plan_summary && (
                    <section className="mb-6">
                        <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-2">Plan Summary</h2>
                        <p className="whitespace-pre-wrap text-gray-800">{plan.plan_summary}</p>
                    </section>
                )}

                {/* Domains */}
                {plan.domains?.map((domain: any) => (
                    <section key={domain.id} className="mb-6 break-inside-avoid">
                        <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-2">
                            {DOMAIN_NAMES[domain.domain_key] || domain.domain_key}
                        </h2>
                        {(domain.importance_rating !== null || domain.confidence_rating !== null) && (
                            <p className="text-gray-600 mb-2">
                                {domain.importance_rating !== null && <>Importance: {domain.importance_rating}/10</>}
                                {domain.importance_rating !== null && domain.confidence_rating !== null && ' · '}
                                {domain.confidence_rating !== null && <>Confidence: {domain.confidence_rating}/10</>}
                            </p>
                        )}

                        {domain.goals?.map((goal: any) => (
                            <div key={goal.id} className="mb-3 ml-1">
                                <p className="font-semibold">
                                    ◦ {goal.goal_text}
                                    <span className="font-normal text-gray-600">
                                        {' '}— {STATUS_LABELS[goal.status] || goal.status}
                                        {goal.target_date && ` · Target: ${formatDateOnly(goal.target_date)}`}
                                    </span>
                                </p>
                                {goal.activities?.length > 0 && (
                                    <ul className="ml-5 mt-1 space-y-0.5">
                                        {goal.activities.map((act: any) => (
                                            <li key={act.id} className="text-gray-800">
                                                {act.status === 'completed' ? '☑' : '☐'} {act.activity_text}
                                                {(act.frequency || act.duration) && (
                                                    <span className="text-gray-500">
                                                        {' '}({[act.frequency, act.duration].filter(Boolean).join(', ')})
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}

                        {/* Latest outcome values */}
                        {domain.outcomes?.length > 0 && (() => {
                            const latestByKey = new Map<string, any>();
                            for (const o of domain.outcomes) {
                                if (!latestByKey.has(o.measure_key)) latestByKey.set(o.measure_key, o);
                            }
                            return (
                                <div className="mt-2 ml-1">
                                    <p className="font-semibold text-gray-700">Outcome measures:</p>
                                    <ul className="ml-5 space-y-0.5">
                                        {Array.from(latestByKey.values()).map((o: any) => (
                                            <li key={o.id} className="text-gray-800">
                                                {o.label}: <span className="font-medium">{o.measure_type === 'boolean' ? (o.value === 'true' || o.value === 'yes' ? 'Yes' : 'No') : o.value}</span>
                                                <span className="text-gray-500"> ({new Date(o.recorded_at).toLocaleDateString()})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })()}
                    </section>
                ))}

                {/* Signatures */}
                <section className="mt-10 break-inside-avoid">
                    <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-4">Acknowledgment</h2>
                    <p className="text-gray-600 mb-6">
                        This recovery plan was developed collaboratively. The signatures below acknowledge
                        the goals and action steps described in this document.
                    </p>
                    <div className="grid grid-cols-2 gap-10">
                        <div>
                            {staffSig ? (
                                <p className="font-medium italic border-b border-gray-400 pb-1">{staffSig.signer_name}</p>
                            ) : (
                                <div className="border-b border-gray-400 h-8" />
                            )}
                            <p className="text-gray-600 mt-1">Peer Support Specialist</p>
                            <p className="text-gray-500 text-xs">
                                {staffSig ? `Signed ${new Date(staffSig.signed_at).toLocaleDateString()}` : 'Date: ____________'}
                            </p>
                        </div>
                        <div>
                            {residentSig ? (
                                <p className="font-medium italic border-b border-gray-400 pb-1">{residentSig.signer_name}</p>
                            ) : (
                                <div className="border-b border-gray-400 h-8" />
                            )}
                            <p className="text-gray-600 mt-1">Resident</p>
                            <p className="text-gray-500 text-xs">
                                {residentSig ? `Signed ${new Date(residentSig.signed_at).toLocaleDateString()}` : 'Date: ____________'}
                            </p>
                        </div>
                    </div>
                </section>

                <footer className="mt-10 pt-3 border-t border-gray-200 text-xs text-gray-400 print:fixed print:bottom-0 print:left-0 print:right-0 print:px-8">
                    Confidential — contains protected health information. {currentOrg?.name} · Peer Support Studio
                </footer>
            </main>
        </div>
    );
}
