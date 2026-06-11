'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Search,
    Loader2,
    Users,
    Clock,
    MapPin,
    CalendarDays,
    Plus,
} from 'lucide-react';
import { formatDateOnly } from '@/lib/dateUtils';

interface Activity {
    id: string;
    name: string;
    activity_type: string;
    primary_audience: string | null;
    activity_date: string;
    start_time: string | null;
    duration_minutes: number | null;
    location_name: string | null;
    facilitator_name: string | null;
    headcount_total: number | null;
    attendee_count: number;
}

const TYPE_LABELS: Record<string, string> = {
    recovery_group: 'Recovery Group',
    outreach: 'Outreach',
    community_event: 'Community Event',
    class: 'Class',
    other: 'Other',
};

const formatDate = (d: string) =>
    formatDateOnly(d, { month: 'short', day: 'numeric', year: 'numeric' });

export default function GroupActivitiesPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') {
            fetchActivities();
        }
    }, [authStatus]);

    const fetchActivities = async () => {
        try {
            const res = await fetch('/api/group-activities?limit=300');
            if (!res.ok) throw new Error('Failed to fetch activities');
            const data = await res.json();
            setActivities(data.activities || []);
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const filtered = activities.filter((a) => {
        if (typeFilter !== 'all' && a.activity_type !== typeFilter) return false;
        if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <button onClick={() => router.push('/')} className="text-[#1A73A8] hover:underline">
                                Dashboard
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Group Activities</span>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">Group Activities</h1>
                        <p className="text-gray-600 mt-1">Track group meetings and individual attendance.</p>
                    </div>
                    <button
                        onClick={() => router.push('/groups/new')}
                        className="px-6 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                    >
                        <Plus className="w-4 h-4" />
                        New Activity
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A73A8] bg-white"
                        aria-label="Filter by type"
                    >
                        <option value="all">All types</option>
                        {Object.entries(TYPE_LABELS).map(([v, label]) => (
                            <option key={v} value={v}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search activities..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 w-64 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                        <CalendarDays className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No activities yet</h3>
                        <p className="text-gray-500 mb-6">Create a group activity to start tracking attendance.</p>
                        <button
                            onClick={() => router.push('/groups/new')}
                            className="px-6 py-2.5 text-white font-medium rounded-lg"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            Create Activity
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                            <div className="col-span-4">Activity</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-2">Location</div>
                            <div className="col-span-2 text-right">Attendance</div>
                        </div>
                        {filtered.map((a) => (
                            <button
                                key={a.id}
                                onClick={() => router.push(`/groups/${a.id}`)}
                                className="w-full grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors items-center text-left"
                            >
                                <div className="col-span-4">
                                    <div className="text-sm font-medium text-[#0E2235]">{a.name}</div>
                                    {a.facilitator_name && (
                                        <div className="text-xs text-gray-400">{a.facilitator_name}</div>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <span className="inline-flex items-center text-xs font-medium text-[#1A73A8] bg-[#1A73A8]/10 px-2 py-1 rounded-full">
                                        {TYPE_LABELS[a.activity_type] || a.activity_type}
                                    </span>
                                </div>
                                <div className="col-span-2 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                        <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                                        {formatDate(a.activity_date)}
                                    </div>
                                    {a.start_time && (
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <Clock className="w-3 h-3" />
                                            {a.start_time.slice(0, 5)}
                                        </div>
                                    )}
                                </div>
                                <div className="col-span-2 text-sm text-gray-600">
                                    {a.location_name ? (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                            {a.location_name}
                                        </span>
                                    ) : (
                                        <span className="text-gray-300">—</span>
                                    )}
                                </div>
                                <div className="col-span-2 flex items-center justify-end gap-1 text-sm font-medium text-[#30B27A]">
                                    <Users className="w-4 h-4" />
                                    {a.attendee_count > 0 || !a.headcount_total
                                        ? `${a.attendee_count} attendee${a.attendee_count !== 1 ? 's' : ''}`
                                        : `${a.headcount_total} (headcount)`}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
