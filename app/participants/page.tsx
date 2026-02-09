'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Users, Plus, Search, Filter, Loader2,
    User, Phone, Mail, Calendar, Target,
    FileText, ChevronRight, AlertCircle, UserCheck
} from 'lucide-react';

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email?: string;
    phone?: string;
    status: string;
    intake_date: string;
    primary_pss_name?: string;
    goals_count?: number;
    notes_count?: number;
    last_assessment?: string;
}

interface OrgMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function ParticipantsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [pssFilter, setPssFilter] = useState('all');
    const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
    
    const currentOrg = (session as any)?.currentOrganization;
    
    // Auth check
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Fetch org members for PSS filter dropdown
    useEffect(() => {
        async function fetchOrgMembers() {
            if (!currentOrg?.id) return;
            try {
                const res = await fetch(`/api/organizations/members?organization_id=${currentOrg.id}`);
                const data = await res.json();
                if (data.members) {
                    setOrgMembers(data.members);
                }
            } catch (e) {
                console.error('Error fetching org members:', e);
            }
        }

        if (status === 'authenticated' && currentOrg?.id) {
            fetchOrgMembers();
        }
    }, [status, currentOrg?.id]);
    
    // Fetch participants
    useEffect(() => {
        async function fetchParticipants() {
            if (!currentOrg?.id) return;
            
            try {
                setLoading(true);
                const params = new URLSearchParams({
                    organization_id: currentOrg.id,
                    status: statusFilter,
                    pss_filter: pssFilter,
                });
                if (searchTerm) {
                    params.append('search', searchTerm);
                }
                
                const res = await fetch(`/api/participants?${params}`);
                const data = await res.json();
                
                if (data.error) throw new Error(data.error);
                setParticipants(data.participants || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch participants');
            } finally {
                setLoading(false);
            }
        }
        
        const debounce = setTimeout(fetchParticipants, 300);
        return () => clearTimeout(debounce);
    }, [currentOrg?.id, statusFilter, searchTerm, pssFilter]);
    
    if (status === 'loading' || !currentOrg) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }
    
    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: 'bg-green-100 text-green-700',
            inactive: 'bg-gray-100 text-gray-600',
            discharged: 'bg-orange-100 text-orange-700',
            waitlist: 'bg-blue-100 text-blue-700',
        };
        return styles[status] || styles.active;
    };
    
    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#0E2235]">Participants</h1>
                    <p className="text-gray-600">Manage the individuals you support</p>
                </div>
                <Link
                    href="/participants/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090] transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Participant
                </Link>
            </div>
            
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="discharged">Discharged</option>
                                <option value="all">All Statuses</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-gray-400" />
                            <select
                                value={pssFilter}
                                onChange={(e) => setPssFilter(e.target.value)}
                                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                            >
                                <option value="all">All PSS</option>
                                <option value="mine">My Participants</option>
                                <option value="unassigned">Unassigned</option>
                                {orgMembers.length > 1 && (
                                    <optgroup label="Filter by PSS">
                                        {orgMembers.map(member => (
                                            <option key={member.id} value={member.id}>
                                                {member.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">
                                {participants.filter(p => p.status === 'active').length}
                            </p>
                            <p className="text-sm text-gray-500">Active</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">
                                {participants.reduce((sum, p) => sum + Number(p.goals_count || 0), 0)}
                            </p>
                            <p className="text-sm text-gray-500">Active Goals</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">
                                {participants.reduce((sum, p) => sum + Number(p.notes_count || 0), 0)}
                            </p>
                            <p className="text-sm text-gray-500">Session Notes</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[#0E2235]">
                                {participants.filter(p => {
                                    const intake = new Date(p.intake_date);
                                    const thirtyDaysAgo = new Date();
                                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                    return intake > thirtyDaysAgo;
                                }).length}
                            </p>
                            <p className="text-sm text-gray-500">New (30 days)</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}
            
            {/* Participants List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                </div>
            ) : participants.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-[#0E2235] mb-2">
                        {searchTerm || statusFilter !== 'active' || pssFilter !== 'all'
                            ? 'No matching participants' 
                            : 'No participants yet'}
                    </h2>
                    <p className="text-gray-500 mb-6">
                        {searchTerm || statusFilter !== 'active' || pssFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Add your first participant to get started'}
                    </p>
                    {!searchTerm && statusFilter === 'active' && pssFilter === 'all' && (
                        <Link
                            href="/participants/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add First Participant
                        </Link>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Contact</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Primary PSS</th>
                                    <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Goals</th>
                                    <th className="px-6 py-3 text-center text-sm font-medium text-gray-600">Notes</th>
                                    <th className="px-6 py-3 text-right text-sm font-medium text-gray-600"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {participants.map((participant) => (
                                    <tr 
                                        key={participant.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/participants/${participant.id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white font-medium">
                                                    {participant.first_name[0]}{participant.last_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[#0E2235]">
                                                        {participant.preferred_name || participant.first_name} {participant.last_name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        Since {new Date(participant.intake_date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {participant.email && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Mail className="w-3.5 h-3.5" />
                                                        <span className="truncate max-w-[180px]">{participant.email}</span>
                                                    </div>
                                                )}
                                                {participant.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Phone className="w-3.5 h-3.5" />
                                                        {participant.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(participant.status)}`}>
                                                {participant.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-600">
                                                {participant.primary_pss_name || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                                                {participant.goals_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                                                {participant.notes_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
