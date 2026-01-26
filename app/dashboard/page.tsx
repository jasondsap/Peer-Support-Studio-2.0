'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Users, Target, FileText, Activity, Plus,
    ArrowRight, Loader2, Calendar, TrendingUp,
    Clock, CheckCircle, AlertCircle, Sparkles,
    BookOpen, ClipboardList, MessageSquare,
    Building2, ClipboardCheck, X
} from 'lucide-react';

interface DashboardStats {
    participants: { active: number; total: number };
    goals: { active: number; completed: number };
    sessions: { thisWeek: number; total: number };
    assessments: { thisMonth: number; total: number };
}

interface RecentActivity {
    id: string;
    type: 'participant' | 'goal' | 'session' | 'assessment';
    title: string;
    description: string;
    timestamp: string;
}

interface Organization {
    id: string;
    name: string;
    slug: string;
    type: string;
    role: string;
}

// No Organization Modal Component
function NoOrganizationModal({ userName }: { userName: string }) {
    const router = useRouter();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-br from-[#1A73A8] via-[#156a9a] to-[#0E4D6F] px-6 py-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Welcome{userName ? `, ${userName}` : ''}! 🎉
                        </h2>
                        <p className="text-blue-100">
                            One more step to get started
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 text-center mb-6">
                        You need to be part of an organization to use Peer Support Studio. 
                        Create your own or join an existing one.
                    </p>

                    {/* Options */}
                    <div className="space-y-3">
                        <button
                            onClick={() => router.push('/onboarding')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-teal-50 border-2 border-[#1A73A8]/30 rounded-xl hover:border-[#1A73A8] hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#1A73A8]/10 flex items-center justify-center group-hover:bg-[#1A73A8]/20 transition-colors">
                                <Building2 className="w-6 h-6 text-[#1A73A8]" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">Create Organization</p>
                                <p className="text-sm text-gray-500">Start fresh as an admin</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-[#1A73A8]/50 group-hover:translate-x-1 group-hover:text-[#1A73A8] transition-all" />
                        </button>

                        <button
                            onClick={() => router.push('/onboarding')}
                            className="w-full flex items-center gap-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                <Users className="w-6 h-6 text-gray-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">Join with Invite Code</p>
                                <p className="text-sm text-gray-500">Your admin shared a code</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <p className="text-xs text-gray-400 text-center mt-6">
                        Organizations keep your data secure and let you collaborate with your team.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        participants: { active: 0, total: 0 },
        goals: { active: 0, completed: 0 },
        sessions: { thisWeek: 0, total: 0 },
        assessments: { thisMonth: 0, total: 0 },
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    
    // Organization state
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgLoading, setOrgLoading] = useState(true);
    const [hasOrganization, setHasOrganization] = useState(false);

    const userName = session?.user?.name?.split(' ')[0] || 'there';

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Fetch organization
    useEffect(() => {
        async function fetchOrganization() {
            if (status !== 'authenticated') {
                setOrgLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/user/organizations');
                const data = await res.json();

                if (data.organizations && data.organizations.length > 0) {
                    setOrganization(data.organizations[0]);
                    setHasOrganization(true);
                } else {
                    setOrganization(null);
                    setHasOrganization(false);
                }
            } catch (e) {
                console.error('Error fetching organization:', e);
                setHasOrganization(false);
            } finally {
                setOrgLoading(false);
            }
        }

        fetchOrganization();
    }, [status]);

    useEffect(() => {
        async function fetchDashboardData() {
            if (!hasOrganization || !organization?.id) {
                setLoading(false);
                return;
            }

            try {
                // Fetch stats - for now using placeholder
                // In production, you'd fetch from /api/dashboard/stats
                setStats({
                    participants: { active: 12, total: 15 },
                    goals: { active: 8, completed: 24 },
                    sessions: { thisWeek: 6, total: 89 },
                    assessments: { thisMonth: 4, total: 31 },
                });

                setRecentActivity([
                    {
                        id: '1',
                        type: 'session',
                        title: 'Session Note Created',
                        description: 'Individual session with participant',
                        timestamp: new Date().toISOString(),
                    },
                    {
                        id: '2',
                        type: 'goal',
                        title: 'Goal Completed',
                        description: 'Housing goal marked as complete',
                        timestamp: new Date(Date.now() - 3600000).toISOString(),
                    },
                    {
                        id: '3',
                        type: 'participant',
                        title: 'New Participant Added',
                        description: 'Added to active caseload',
                        timestamp: new Date(Date.now() - 86400000).toISOString(),
                    },
                ]);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        if (status === 'authenticated' && !orgLoading) {
            fetchDashboardData();
        }
    }, [organization?.id, status, hasOrganization, orgLoading]);

    // Show loading while checking auth and org
    if (status === 'loading' || orgLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    const quickActions = [
        {
            title: 'Add Participant',
            description: 'Register a new person',
            icon: Users,
            href: '/participants/new',
            color: 'bg-blue-500',
        },
        {
            title: 'Create Goal',
            description: 'AI-powered goal generator',
            icon: Target,
            href: '/goals/new',
            color: 'bg-green-500',
        },
        {
            title: 'Session Note',
            description: 'Document a session',
            icon: FileText,
            href: '/session-notes',
            color: 'bg-amber-500',
        },
        {
            title: 'Assessment',
            description: 'Recovery Capital (BARC-10)',
            icon: Activity,
            href: '/recovery-capital',
            color: 'bg-purple-500',
        },
    ];

    const tools = [
        {
            title: 'Goal Generator',
            description: 'Create SMART recovery goals with AI assistance',
            icon: Sparkles,
            href: '/goals/new',
            badge: 'AI Powered',
        },
        {
            title: 'Session Notes',
            description: 'Document sessions from audio or text',
            icon: FileText,
            href: '/session-notes',
            badge: null,
        },
        {
            title: 'Note Reviewer',
            description: 'Check if notes meet billing requirements',
            icon: ClipboardCheck,
            href: '/note-reviewer',
            badge: 'AI Powered',
        },
        {
            title: 'Lesson Builder',
            description: 'Create educational content for groups',
            icon: BookOpen,
            href: '/lesson-builder',
            badge: 'AI Powered',
        },
        {
            title: 'Service Planner',
            description: 'Plan and track service delivery',
            icon: ClipboardList,
            href: '/service-log',
            badge: null,
        },
        {
            title: 'Peer Advisor',
            description: 'AI coaching and guidance',
            icon: MessageSquare,
            href: '/peer-advisor',
            badge: 'AI Powered',
        },
        {
            title: 'Recovery Capital',
            description: 'BARC-10 & MIRC-28 assessments',
            icon: Activity,
            href: '/recovery-capital',
            badge: null,
        },
        {
            title: 'Treatment Locator',
            description: 'SAMSHA verfied Treatment Locator',
            icon: Activity,
            href: '/resource-navigator',
            badge: null,
        },
    ];

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'participant': return Users;
            case 'goal': return Target;
            case 'session': return FileText;
            case 'assessment': return Activity;
            default: return Clock;
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'participant': return 'bg-blue-100 text-blue-600';
            case 'goal': return 'bg-green-100 text-green-600';
            case 'session': return 'bg-amber-100 text-amber-600';
            case 'assessment': return 'bg-purple-100 text-purple-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Show modal if user has no organization */}
            {!hasOrganization && <NoOrganizationModal userName={userName} />}

            {/* Welcome Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#0E2235]">
                    Welcome back, {userName}!
                </h1>
                <p className="text-gray-500">
                    {organization ? organization.name : 'Here\'s your dashboard overview'}
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {quickActions.map((action) => (
                    <Link
                        key={action.title}
                        href={action.href}
                        className="group bg-white rounded-xl p-4 border border-gray-200 hover:shadow-lg hover:border-[#1A73A8]/30 transition-all"
                    >
                        <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                            <action.icon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-semibold text-[#0E2235] group-hover:text-[#1A73A8] transition-colors">
                            {action.title}
                        </h3>
                        <p className="text-sm text-gray-500">{action.description}</p>
                    </Link>
                ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Active
                        </span>
                    </div>
                    <p className="text-3xl font-bold text-[#0E2235]">{stats.participants.active}</p>
                    <p className="text-sm text-gray-500">Active Participants</p>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Target className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                            {stats.goals.completed} completed
                        </span>
                    </div>
                    <p className="text-3xl font-bold text-[#0E2235]">{stats.goals.active}</p>
                    <p className="text-sm text-gray-500">Active Goals</p>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                            This week
                        </span>
                    </div>
                    <p className="text-3xl font-bold text-[#0E2235]">{stats.sessions.thisWeek}</p>
                    <p className="text-sm text-gray-500">Session Notes</p>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                            This month
                        </span>
                    </div>
                    <p className="text-3xl font-bold text-[#0E2235]">{stats.assessments.thisMonth}</p>
                    <p className="text-sm text-gray-500">Assessments</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Tools Section */}
                <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-[#0E2235]">Tools</h2>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {tools.map((tool) => (
                            <Link
                                key={tool.title}
                                href={tool.href}
                                className="group bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md hover:border-[#1A73A8]/30 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-[#1A73A8]/10 flex items-center justify-center transition-colors">
                                        <tool.icon className="w-5 h-5 text-gray-600 group-hover:text-[#1A73A8] transition-colors" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-[#0E2235] group-hover:text-[#1A73A8] transition-colors">
                                                {tool.title}
                                            </h3>
                                            {tool.badge && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                                    {tool.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">{tool.description}</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1A73A8] transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Recent Activity */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-[#0E2235]">Recent Activity</h2>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                        {recentActivity.length === 0 ? (
                            <div className="p-8 text-center">
                                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No recent activity</p>
                            </div>
                        ) : (
                            recentActivity.map((activity) => {
                                const Icon = getActivityIcon(activity.type);
                                return (
                                    <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActivityColor(activity.type)}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-[#0E2235] text-sm">{activity.title}</p>
                                                <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                                            </div>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {formatTimestamp(activity.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* View All Participants Link */}
                    <Link
                        href="/participants"
                        className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-600 hover:text-[#1A73A8] transition-colors"
                    >
                        <Users className="w-4 h-4" />
                        View All Participants
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
