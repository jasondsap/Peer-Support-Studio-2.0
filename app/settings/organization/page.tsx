'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Building2, Users, Key, Copy, Check,
    RefreshCw, Loader2, AlertCircle, Shield, Mail,
    UserPlus, Crown, UserCog, User
} from 'lucide-react';

interface Organization {
    id: string;
    name: string;
    slug: string;
    type: string;
    invite_code: string;
}

interface Member {
    id: string;
    user_id: string;
    role: string;
    status: string;
    user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
    };
}

export default function OrganizationSettingsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [organization, setOrganization] = useState<Organization | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [editName, setEditName] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Fetch organization data
    useEffect(() => {
        async function fetchOrganization() {
            try {
                const res = await fetch('/api/user/organizations');
                const data = await res.json();

                if (data.organizations && data.organizations.length > 0) {
                    const org = data.organizations[0];
                    setOrganization(org);
                    setEditName(org.name);

                    // Fetch members
                    const membersRes = await fetch(`/api/organizations/${org.id}/members`);
                    const membersData = await membersRes.json();
                    if (membersData.members) {
                        setMembers(membersData.members);
                    }
                } else {
                    setError('No organization found. Please create or join an organization.');
                }
            } catch (e) {
                console.error('Error fetching organization:', e);
                setError('Failed to load organization data');
            } finally {
                setLoading(false);
            }
        }

        if (status === 'authenticated') {
            fetchOrganization();
        }
    }, [status]);

    const copyInviteCode = async () => {
        if (!organization?.invite_code) return;

        await navigator.clipboard.writeText(organization.invite_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveName = async () => {
        if (!organization || !editName.trim()) return;

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/organizations/${organization.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim() }),
            });

            const data = await res.json();

            if (data.success) {
                setOrganization({ ...organization, name: editName.trim() });
                setIsEditing(false);
                setSuccess('Organization name updated');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(data.error || 'Failed to update name');
            }
        } catch (e) {
            setError('Failed to update organization');
        } finally {
            setSaving(false);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'owner':
            case 'admin':
                return <Crown className="w-4 h-4 text-amber-500" />;
            case 'supervisor':
                return <UserCog className="w-4 h-4 text-blue-500" />;
            default:
                return <User className="w-4 h-4 text-gray-400" />;
        }
    };

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            owner: 'bg-amber-100 text-amber-700',
            admin: 'bg-purple-100 text-purple-700',
            supervisor: 'bg-blue-100 text-blue-700',
            pss: 'bg-gray-100 text-gray-700',
        };
        return styles[role] || styles.pss;
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
                        <p className="text-gray-500">Manage your organization and team members</p>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <p className="text-green-700">{success}</p>
                    </div>
                )}

                {organization ? (
                    <div className="space-y-6">
                        {/* Organization Info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-teal-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Organization Details</h2>
                                    <p className="text-sm text-gray-500">Basic information about your organization</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Organization Name
                                    </label>
                                    {isEditing ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                            <button
                                                onClick={handleSaveName}
                                                disabled={saving}
                                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setEditName(organization.name);
                                                }}
                                                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-900 font-medium">{organization.name}</span>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-sm text-teal-600 hover:text-teal-700"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Organization Type
                                    </label>
                                    <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize">
                                        {organization.type?.replace(/_/g, ' ') || 'Peer Organization'}
                                    </span>
                                </div>

                                {/* Slug */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        URL Slug
                                    </label>
                                    <span className="text-gray-500 text-sm">{organization.slug}</span>
                                </div>
                            </div>
                        </div>

                        {/* Invite Code */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                                    <Key className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Invite Code</h2>
                                    <p className="text-sm text-gray-500">Share this code to invite team members</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-6 py-4">
                                    <span className="text-2xl font-mono font-bold text-gray-900 tracking-widest">
                                        {organization.invite_code || 'N/A'}
                                    </span>
                                </div>
                                <button
                                    onClick={copyInviteCode}
                                    className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-5 h-5" />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>

                            <p className="mt-4 text-sm text-gray-500">
                                New team members can use this code when signing up to automatically join your organization.
                            </p>
                        </div>

                        {/* Team Members */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
                                        <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                                    <UserPlus className="w-4 h-4" />
                                    Invite
                                </button>
                            </div>

                            {members.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {members.map((member) => (
                                        <div key={member.id} className="py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                                    {getRoleIcon(member.role)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">
                                                        {member.user?.first_name} {member.user?.last_name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">{member.user?.email}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadge(member.role)}`}>
                                                {member.role}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">
                                    No team members yet. Share your invite code to get started!
                                </p>
                            )}
                        </div>

                        {/* HIPAA Compliance */}
                        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-green-800">HIPAA Compliant</h2>
                                    <p className="text-sm text-green-600">
                                        Your organization data is protected with enterprise-grade security
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">No Organization</h2>
                        <p className="text-gray-500 mb-6">You need to create or join an organization first.</p>
                        <button
                            onClick={() => router.push('/onboarding')}
                            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                        >
                            Get Started
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
