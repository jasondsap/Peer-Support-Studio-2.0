'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    Target,
    Heart,
    Home,
    Briefcase,
    GraduationCap,
    Users,
    Scale,
    Activity,
    Wallet,
    Car,
    Lightbulb,
    Search,
    Trash2,
    Eye,
    Calendar,
    Plus,
    Filter,
    Grid,
    List,
    ListChecks,
} from 'lucide-react';

const goalAreas = [
    { id: 'substance-use', label: 'Substance Use Recovery', icon: Heart, color: '#E74C3C' },
    { id: 'mental-health', label: 'Mental Health', icon: Activity, color: '#9B59B6' },
    { id: 'housing', label: 'Housing', icon: Home, color: '#3498DB' },
    { id: 'employment', label: 'Employment', icon: Briefcase, color: '#27AE60' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: '#F39C12' },
    { id: 'family', label: 'Family Relationships', icon: Users, color: '#E91E63' },
    { id: 'legal', label: 'Legal', icon: Scale, color: '#607D8B' },
    { id: 'physical-health', label: 'Physical Health', icon: Activity, color: '#00BCD4' },
    { id: 'life-skills', label: 'Life Skills', icon: Lightbulb, color: '#FF9800' },
    { id: 'social-support', label: 'Social Support', icon: Users, color: '#8E44AD' },
    { id: 'transportation', label: 'Transportation', icon: Car, color: '#34495E' },
    { id: 'financial', label: 'Financial Stability', icon: Wallet, color: '#16A085' },
];

interface SavedGoal {
    id: string;
    participant_id?: string;
    participant_name: string;
    participant_first_name?: string;
    participant_last_name?: string;
    participant_preferred_name?: string;
    goal_area: string;
    desired_outcome: string;
    smart_goal: string;
    timeframe: string;
    status: string;
    progress: number;
    created_at: string;
    goal_data: string;
}

interface MilestoneInfo {
    total: number;
    completed: number;
}

function getMilestoneCount(goalDataStr: string): MilestoneInfo | null {
    try {
        let data = typeof goalDataStr === 'string' ? JSON.parse(goalDataStr) : goalDataStr;
        // Handle legacy double-stringified data
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        if (data?.milestones && Array.isArray(data.milestones)) {
            return {
                total: data.milestones.length,
                completed: data.milestones.filter((m: any) => m.completed).length,
            };
        }
    } catch {
        // ignore parse errors
    }
    return null;
}

export default function GoalLibrary() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [goals, setGoals] = useState<SavedGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterArea, setFilterArea] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (currentOrg?.id) {
            fetchGoals();
        }
    }, [status, currentOrg?.id]);

    const fetchGoals = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                organization_id: currentOrg.id,
                status: filterStatus,
            });
            if (searchQuery) {
                params.append('search', searchQuery);
            }

            const res = await fetch(`/api/saved-goals?${params}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);
            setGoals(data.goals || []);
        } catch (error) {
            console.error('Error fetching goals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentOrg?.id) {
            const debounce = setTimeout(fetchGoals, 300);
            return () => clearTimeout(debounce);
        }
    }, [searchQuery, filterStatus]);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/saved-goals?id=${id}&organization_id=${currentOrg.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setGoals(goals.filter(g => g.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting goal:', error);
            alert('Failed to delete goal.');
        }
    };

    const getAreaInfo = (areaId: string) => {
        return goalAreas.find(a => a.id === areaId) || { label: areaId, icon: Target, color: '#1A73A8' };
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const getParticipantDisplay = (goal: SavedGoal) => {
        if (goal.participant_first_name) {
            const name = goal.participant_preferred_name || goal.participant_first_name;
            return `${name} ${goal.participant_last_name}`;
        }
        return goal.participant_name;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'completed': return 'bg-blue-100 text-blue-700';
            case 'abandoned': return 'bg-gray-100 text-gray-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const filteredGoals = goals.filter(goal => !filterArea || goal.goal_area === filterArea);

    if (status === 'loading' || !currentOrg) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <div className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <Link href="/" className="text-[#1A73A8] hover:underline">Dashboard</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Goal Library</span>
                        </nav>
                        <div className="ml-auto">
                            <Link href="/goals/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90">
                                <Plus className="w-4 h-4" />Create Goal
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[#0E2235]">Goal Library</h1>
                        <p className="text-gray-600">{filteredGoals.length} goals saved</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search goals..."
                                className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                            />
                        </div>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="abandoned">Abandoned</option>
                        </select>

                        <div className="relative">
                            <button
                                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${filterArea ? 'border-[#1A73A8] bg-[#1A73A8]/5' : 'border-gray-200'}`}
                            >
                                <Filter className="w-4 h-4" />
                                {filterArea ? getAreaInfo(filterArea).label : 'All Areas'}
                            </button>
                            {showFilterDropdown && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10 max-h-80 overflow-y-auto">
                                    <button onClick={() => { setFilterArea(null); setShowFilterDropdown(false); }} className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${!filterArea ? 'bg-[#1A73A8]/10 text-[#1A73A8]' : ''}`}>
                                        All Areas
                                    </button>
                                    {goalAreas.map(area => (
                                        <button key={area.id} onClick={() => { setFilterArea(area.id); setShowFilterDropdown(false); }} className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${filterArea === area.id ? 'bg-[#1A73A8]/10 text-[#1A73A8]' : ''}`}>
                                            <area.icon className="w-4 h-4" style={{ color: area.color }} />
                                            {area.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-[#1A73A8] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <Grid className="w-5 h-5" />
                            </button>
                            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-[#1A73A8] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : filteredGoals.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <Target className="w-10 h-10 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2">
                            {searchQuery || filterArea || filterStatus !== 'all' ? 'No matching goals' : 'No goals saved yet'}
                        </h2>
                        <p className="text-gray-500 mb-6">
                            {searchQuery || filterArea || filterStatus !== 'all' ? 'Try adjusting your search or filters' : 'Create your first recovery goal to get started'}
                        </p>
                        {!searchQuery && !filterArea && filterStatus === 'all' && (
                            <Link href="/goals/new" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-lg hover:opacity-90">
                                <Plus className="w-5 h-5" />Create Your First Goal
                            </Link>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredGoals.map((goal) => {
                            const areaInfo = getAreaInfo(goal.goal_area);
                            const AreaIcon = areaInfo.icon;
                            const msInfo = goal.goal_data ? getMilestoneCount(goal.goal_data) : null;
                            return (
                                <div key={goal.id} className="bg-white rounded-xl shadow-sm border border-[#E7E9EC] overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="p-4 border-b border-gray-100" style={{ backgroundColor: `${areaInfo.color}10` }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${areaInfo.color}20` }}>
                                                <AreaIcon className="w-5 h-5" style={{ color: areaInfo.color }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-[#0E2235] truncate">{getParticipantDisplay(goal)}</h3>
                                                <p className="text-sm text-gray-500">{areaInfo.label}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(goal.status)}`}>{goal.status}</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-gray-700 line-clamp-3 mb-4">{goal.smart_goal}</p>
                                        {goal.status === 'active' && (
                                            <div className="mb-4">
                                                <div className="flex items-center justify-between text-sm mb-1">
                                                    <span className="text-gray-500 flex items-center gap-1">
                                                        {msInfo ? (
                                                            <>
                                                                <ListChecks className="w-3.5 h-3.5" />
                                                                {msInfo.completed}/{msInfo.total} milestones
                                                            </>
                                                        ) : (
                                                            'Progress'
                                                        )}
                                                    </span>
                                                    <span className="font-medium text-[#1A73A8]">{goal.progress || 0}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-[#1A73A8] to-[#30B27A] rounded-full transition-all" style={{ width: `${goal.progress || 0}%` }} />
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{goal.timeframe} days</span>
                                            <span>{formatDate(goal.created_at)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => router.push(`/goals/${goal.id}`)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#1A73A8] text-white rounded-lg text-sm font-medium hover:bg-[#156090]">
                                                <Eye className="w-4 h-4" />View
                                            </button>
                                            {deleteConfirm === goal.id ? (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleDelete(goal.id)} className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm">Confirm</button>
                                                    <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Cancel</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeleteConfirm(goal.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-[#E7E9EC]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Goal / Participant</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Goal Area</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden md:table-cell">SMART Goal</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Progress</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Created</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGoals.map((goal) => {
                                    const areaInfo = getAreaInfo(goal.goal_area);
                                    const AreaIcon = areaInfo.icon;
                                    const msInfo = goal.goal_data ? getMilestoneCount(goal.goal_data) : null;
                                    return (
                                        <tr key={goal.id} className="border-b border-[#E7E9EC] hover:bg-gray-50">
                                            <td className="px-4 py-3"><span className="font-medium text-[#0E2235]">{getParticipantDisplay(goal)}</span></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <AreaIcon className="w-4 h-4" style={{ color: areaInfo.color }} />
                                                    <span className="text-sm text-gray-600">{areaInfo.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell"><span className="text-sm text-gray-600 line-clamp-2">{goal.smart_goal}</span></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-[#1A73A8] rounded-full" style={{ width: `${goal.progress || 0}%` }} />
                                                    </div>
                                                    <span className="text-sm text-gray-600 whitespace-nowrap">
                                                        {msInfo ? `${msInfo.completed}/${msInfo.total}` : `${goal.progress || 0}%`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(goal.status)}`}>{goal.status}</span></td>
                                            <td className="px-4 py-3"><span className="text-sm text-gray-500">{formatDate(goal.created_at)}</span></td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => router.push(`/goals/${goal.id}`)} className="p-2 text-[#1A73A8] hover:bg-[#1A73A8]/10 rounded-lg" title="View">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {deleteConfirm === goal.id ? (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleDelete(goal.id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs">Yes</button>
                                                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">No</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setDeleteConfirm(goal.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
