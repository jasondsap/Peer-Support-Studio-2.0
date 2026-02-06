'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Users, Target, FileText, Activity,
    ArrowRight, Loader2, Sparkles,
    BookOpen, ClipboardList, MessageSquare,
    Building2, ClipboardCheck, Search,
    TrendingUp, Mail, Plus,
} from 'lucide-react';
import AllyIntelligenceChat from './components/AllyIntelligenceChat';

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
                        You need to be part of an organization to use Continuum Care Studio.
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

// Section Header Component
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
    );
}

export default function HomePage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    // Organization state
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [orgLoading, setOrgLoading] = useState(true);
    const [hasOrganization, setHasOrganization] = useState(false);

    const userName = session?.user?.name?.split(' ')[0] || 'there';

    // Redirect to login if not authenticated
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

    // Show loading while checking auth and org
    if (status === 'loading' || orgLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #F2F0EF 90%, #F5F5F5 100%)' }}>
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    // Don't render anything if unauthenticated (will redirect)
    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #F2F0EF 90%, #F5F5F5 100%)' }}>
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    // Hero cards - Primary actions
    const heroCards = [
        {
            title: 'Participants',
            description: 'View and manage all participants in your care',
            icon: Users,
            href: '/participants',
            gradient: 'from-[#1A73A8] to-[#2B8FBF]',
            stat: null, // Could add "12 active" etc.
            action: {
                label: 'Add New',
                href: '/participants/new',
                icon: Plus,
            },
        },
        {
            title: 'Journey Tracker',
            description: 'Track recovery progress across life domains',
            icon: TrendingUp,
            href: '/journey-tracker',
            gradient: 'from-[#30B27A] to-[#4AC490]',
            stat: null,
            action: null,
        },
    ];

    // Documentation & Compliance tools
    const documentationTools = [
        {
            title: 'Session Notes',
            description: 'Document sessions from audio or text',
            icon: FileText,
            href: '/session-notes',
            badge: null,
            color: 'bg-amber-500',
        },
        {
            title: 'Note Reviewer',
            description: 'Check if notes meet billing requirements',
            icon: ClipboardCheck,
            href: '/note-reviewer',
            badge: 'AI',
            color: 'bg-amber-400',
        },
        {
            title: 'Service Planner',
            description: 'Plan and track service delivery',
            icon: ClipboardList,
            href: '/service-log',
            badge: null,
            color: 'bg-amber-600',
        },
    ];

    // Assessment & Goals tools
    const assessmentTools = [
        {
            title: 'Recovery Capital',
            description: 'BARC-10 & MIRC-28 assessments',
            icon: Activity,
            href: '/recovery-capital',
            badge: null,
            color: 'bg-purple-500',
        },
        {
            title: 'Goal Generator',
            description: 'Create SMART recovery goals',
            icon: Target,
            href: '/goals/new',
            badge: 'AI',
            color: 'bg-green-500',
        },
    ];

    // Connect & Support tools
    const connectTools = [
        {
            title: 'Messages',
            description: 'Communicate with participants',
            icon: Mail,
            href: '/messages',
            badge: null,
            color: 'bg-blue-500',
        },
        {
            title: 'Peer Advisor',
            description: 'AI coaching and guidance',
            icon: MessageSquare,
            href: '/peer-advisor',
            badge: 'AI',
            color: 'bg-blue-400',
        },
        {
            title: 'Treatment Locator',
            description: 'SAMHSA verified resources',
            icon: Search,
            href: '/resource-navigator',
            badge: null,
            color: 'bg-teal-500',
        },
        {
            title: 'Lesson Builder',
            description: 'Create educational content',
            icon: BookOpen,
            href: '/lesson-builder',
            badge: 'AI',
            color: 'bg-indigo-500',
        },
    ];

    // Tool Card Component
    const ToolCard = ({ tool }: { tool: typeof documentationTools[0] }) => (
        <Link
            href={tool.href}
            className="group bg-white rounded-xl p-4 border border-gray-200 hover:shadow-lg hover:border-gray-300 hover:scale-[1.02] transition-all"
        >
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${tool.color} flex items-center justify-center flex-shrink-0`}>
                    <tool.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 group-hover:text-[#1A73A8] transition-colors truncate">
                            {tool.title}
                        </h3>
                        {tool.badge && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium flex-shrink-0">
                                {tool.badge}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{tool.description}</p>
                </div>
            </div>
        </Link>
    );

    return (
        <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at center, #F2F0EF 90%, #F5F5F5 100%)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {/* Show modal if user has no organization */}
                {!hasOrganization && <NoOrganizationModal userName={userName} />}

                {/* Welcome Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Welcome back, {userName}!
                    </h1>
                    <p className="text-gray-600">
                        {organization ? organization.name : 'Here\'s your dashboard overview'}
                    </p>
                </div>

                {/* Hero Cards - Primary Actions */}
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    {heroCards.map((card) => (
                        <Link
                            key={card.title}
                            href={card.href}
                            className="group relative bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-xl hover:scale-[1.01] transition-all overflow-hidden"
                        >
                            {/* Gradient accent bar */}
                            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
                            
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                        <card.icon className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#1A73A8] transition-colors">
                                            {card.title}
                                        </h3>
                                        <p className="text-gray-500 mt-1">{card.description}</p>
                                        {card.stat && (
                                            <p className="text-sm font-medium text-[#1A73A8] mt-2">{card.stat}</p>
                                        )}
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#1A73A8] group-hover:translate-x-1 transition-all flex-shrink-0" />
                            </div>

                            {/* Quick action button */}
                            {card.action && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            router.push(card.action!.href);
                                        }}
                                        className="flex items-center gap-2 text-sm font-medium text-[#1A73A8] hover:text-[#156a9a] transition-colors"
                                    >
                                        <card.action.icon className="w-4 h-4" />
                                        {card.action.label}
                                    </button>
                                </div>
                            )}
                        </Link>
                    ))}
                </div>

                {/* Documentation & Compliance */}
                <div className="mb-8">
                    <SectionHeader 
                        title="Documentation & Compliance" 
                        subtitle="Daily documentation and billing tools"
                    />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documentationTools.map((tool) => (
                            <ToolCard key={tool.title} tool={tool} />
                        ))}
                    </div>
                </div>

                {/* Assessment & Goals */}
                <div className="mb-8">
                    <SectionHeader 
                        title="Assessment & Goals" 
                        subtitle="Measure progress and set objectives"
                    />
                    <div className="grid sm:grid-cols-2 gap-4">
                        {assessmentTools.map((tool) => (
                            <ToolCard key={tool.title} tool={tool} />
                        ))}
                    </div>
                </div>

                {/* Connect & Support */}
                <div className="mb-8">
                    <SectionHeader 
                        title="Connect & Support" 
                        subtitle="Communication and resources"
                    />
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {connectTools.map((tool) => (
                            <ToolCard key={tool.title} tool={tool} />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-gray-400 text-sm">
                        Journey Care Studio by MADe180 • Louisville, KY
                    </p>
                </div>
            </div>

            {/* Ally Intelligence Chat - Floating Assistant */}
            {organization?.id && (
                <AllyIntelligenceChat organizationId={organization.id} />
            )}
        </div>
    );
}
