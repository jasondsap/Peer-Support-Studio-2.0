'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, ChevronRight, Loader2, Paperclip } from 'lucide-react';
import { todayLocal } from '@/lib/dateUtils';
import LessonPicker, { AttachableLesson } from '@/app/components/LessonPicker';

const TYPE_OPTIONS = [
    { value: 'recovery_group', label: 'Recovery Group' },
    { value: 'outreach', label: 'Outreach' },
    { value: 'community_event', label: 'Community Event' },
    { value: 'class', label: 'Class' },
    { value: 'other', label: 'Other' },
];

const AUDIENCE_OPTIONS = ['recoverees', 'family', 'community', 'youth', 'general'];

const today = () => todayLocal();

export default function NewActivityPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [locations, setLocations] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [lessonOpen, setLessonOpen] = useState(false);
    const [lesson, setLesson] = useState<{ id: string | null; source: string | null; title: string | null }>({
        id: null,
        source: null,
        title: null,
    });

    const [form, setForm] = useState({
        name: '',
        activity_type: 'recovery_group',
        primary_audience: 'recoverees',
        activity_date: today(),
        start_time: '',
        duration_minutes: '',
        location_id: '',
        facilitator_id: '',
        notes: '',
    });

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.push('/auth/signin');
    }, [authStatus]);

    useEffect(() => {
        if (!currentOrg?.id) return;
        fetch(`/api/locations?organization_id=${currentOrg.id}`)
            .then((r) => r.json())
            .then((d) => setLocations(d.locations || []))
            .catch(() => {});
        fetch(`/api/organizations/members?organization_id=${currentOrg.id}`)
            .then((r) => r.json())
            .then((d) => setMembers(d.members || d.users || []))
            .catch(() => {});
    }, [currentOrg?.id]);

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const memberName = (m: any) =>
        m.display_name || m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member';
    const memberId = (m: any) => m.user_id || m.id;

    const handleSubmit = async () => {
        if (!form.name || !form.activity_date) {
            alert('Name and date are required.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/group-activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
                    start_time: form.start_time || null,
                    location_id: form.location_id || null,
                    facilitator_id: form.facilitator_id || null,
                    lesson_id: lesson.id,
                    lesson_source: lesson.source,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.activity?.id) throw new Error(data.error || 'Failed to create');
            router.push(`/groups/${data.activity.id}`);
        } catch (error) {
            console.error('Error creating activity:', error);
            alert('Could not create the activity. Please try again.');
            setSaving(false);
        }
    };

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    const inputCls =
        'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent text-sm';

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.push('/groups')} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <nav className="flex items-center gap-2 text-sm">
                        <button onClick={() => router.push('/')} className="text-[#1A73A8] hover:underline">
                            Dashboard
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <button onClick={() => router.push('/groups')} className="text-[#1A73A8] hover:underline">
                            Group Activities
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 font-medium">New</span>
                    </nav>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8">
                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8">
                    <h1 className="text-2xl font-bold text-[#0E2235] mb-6">New Group Activity</h1>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Activity name *</label>
                            <input
                                className={inputCls}
                                placeholder="e.g. SMART Recovery"
                                value={form.name}
                                onChange={(e) => set('name', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select className={inputCls} value={form.activity_type} onChange={(e) => set('activity_type', e.target.value)}>
                                    {TYPE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Primary audience</label>
                                <select className={inputCls} value={form.primary_audience} onChange={(e) => set('primary_audience', e.target.value)}>
                                    {AUDIENCE_OPTIONS.map((o) => (
                                        <option key={o} value={o}>
                                            {o.charAt(0).toUpperCase() + o.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                                <input type="date" className={inputCls} value={form.activity_date} onChange={(e) => set('activity_date', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start time</label>
                                <input type="time" className={inputCls} value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                                <input type="number" min="0" className={inputCls} value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <select className={inputCls} value={form.location_id} onChange={(e) => set('location_id', e.target.value)}>
                                    <option value="">— None —</option>
                                    {locations.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Facilitator</label>
                                <select className={inputCls} value={form.facilitator_id} onChange={(e) => set('facilitator_id', e.target.value)}>
                                    <option value="">— None —</option>
                                    {members.map((m) => (
                                        <option key={memberId(m)} value={memberId(m)}>
                                            {memberName(m)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Attached lesson (optional)</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 truncate">
                                    {lesson.id ? lesson.title || 'Lesson attached' : <span className="text-gray-400">No lesson attached</span>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLessonOpen(true)}
                                    className="px-3 py-2 text-sm font-medium text-[#1A73A8] border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    {lesson.id ? 'Change' : 'Attach'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <LessonPicker
                        open={lessonOpen}
                        onClose={() => setLessonOpen(false)}
                        onSelect={(l: AttachableLesson | null) => {
                            setLesson({ id: l?.id ?? null, source: l?.source ?? null, title: l?.title ?? null });
                            setLessonOpen(false);
                        }}
                        currentLesson={{ id: lesson.id, title: lesson.title }}
                    />

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="px-6 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Activity'
                            )}
                        </button>
                        <button
                            onClick={() => router.push('/groups')}
                            className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
