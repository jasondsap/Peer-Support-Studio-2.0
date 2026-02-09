'use client';

// ============================================================================
// Peer Support Studio - Add New Participant Page (Updated)
// File: /app/participants/new/page.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, User, Phone, Mail, Calendar, MapPin,
    AlertCircle, Save, Loader2, Users, Heart, Building2,
    ChevronRight, Scale, CheckCircle
} from 'lucide-react';

interface Organization {
    id: string;
    name: string;
    slug: string;
}

interface OrgMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function AddParticipantPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    const sessionOrg = (session as any)?.currentOrganization;

    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(sessionOrg || null);
    const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        preferred_name: '',
        date_of_birth: '',
        gender: '',
        email: '',
        phone: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: 'KY',
        zip: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
        referral_source: '',
        internal_notes: '',
        is_reentry_participant: false,
        primary_pss_id: '',
    });

    // Redirect if not authenticated
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    // Fetch user's organizations
    useEffect(() => {
        async function fetchOrganizations() {
            if (!session?.user) return;

            try {
                const res = await fetch('/api/user/organizations');
                const data = await res.json();

                if (data.organizations && data.organizations.length > 0) {
                    setUserOrganizations(data.organizations);
                    if (!selectedOrg) {
                        setSelectedOrg(data.organizations[0]);
                    }
                } else {
                    setError('You need to be part of an organization to add participants.');
                }
            } catch (e) {
                console.error('Failed to fetch organizations:', e);
                if (sessionOrg) {
                    setUserOrganizations([sessionOrg]);
                    setSelectedOrg(sessionOrg);
                }
            } finally {
                setLoadingOrgs(false);
            }
        }

        if (status === 'authenticated') {
            fetchOrganizations();
        }
    }, [session, status, sessionOrg, selectedOrg]);

    // Fetch organization members for PSS assignment
    useEffect(() => {
        async function fetchOrgMembers() {
            const orgId = selectedOrg?.id;
            if (!orgId) return;
            try {
                const res = await fetch(`/api/organizations/members?organization_id=${orgId}`);
                const data = await res.json();
                if (data.members) {
                    setOrgMembers(data.members);
                    // Default to current user if no PSS selected yet
                    if (!formData.primary_pss_id && session?.user?.email) {
                        const currentUser = data.members.find(
                            (m: OrgMember) => m.email === session.user?.email
                        );
                        if (currentUser) {
                            setFormData(prev => ({ ...prev, primary_pss_id: currentUser.id }));
                        }
                    }
                }
            } catch (e) {
                console.error('Error fetching org members:', e);
            }
        }

        if (status === 'authenticated' && selectedOrg?.id) {
            fetchOrgMembers();
        }
    }, [status, selectedOrg?.id]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedOrg) {
            setError('Please select an organization');
            return;
        }

        if (!formData.first_name || !formData.last_name) {
            setError('First name and last name are required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    organization_id: selectedOrg.id,
                }),
            });

            const data = await res.json();

            if (data.success || data.participant) {
                setSuccess(true);
                // If reentry participant, redirect to their page to show readiness
                const participantId = data.participant?.id;
                setTimeout(() => {
                    if (formData.is_reentry_participant && participantId) {
                        router.push(`/participants/${participantId}?tab=readiness`);
                    } else {
                        router.push('/participants');
                    }
                }, 1500);
            } else {
                setError(data.error || 'Failed to create participant');
            }
        } catch (e) {
            console.error('Error creating participant:', e);
            setError('Failed to create participant. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (status === 'loading' || loadingOrgs) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <Link href="/" className="text-[#1A73A8] hover:underline">Dashboard</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <Link href="/participants" className="text-[#1A73A8] hover:underline">Participants</Link>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Add New Participant</span>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-3xl mx-auto px-6 py-8">
                {/* Page Title */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[#0E2235]">Add New Participant</h1>
                    <p className="text-gray-600">Enter the participant's information to add them to your program</p>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-700">Participant created successfully! Redirecting...</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Organization Selector */}
                    {userOrganizations.length > 1 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-[#0E2235]">Organization</h2>
                                    <p className="text-sm text-gray-500">Select which organization this participant belongs to</p>
                                </div>
                            </div>
                            <select
                                value={selectedOrg?.id || ''}
                                onChange={(e) => {
                                    const org = userOrganizations.find(o => o.id === e.target.value);
                                    setSelectedOrg(org || null);
                                }}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {userOrganizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Reentry Participant Option */}
                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Scale className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="is_reentry_participant"
                                        checked={formData.is_reentry_participant}
                                        onChange={handleChange}
                                        className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                                    />
                                    <div>
                                        <span className="font-semibold text-[#0E2235]">Reentry Participant</span>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Enable document readiness tracking to help this person obtain essential IDs,
                                            benefits, and resources for successful reentry. A checklist will be created
                                            automatically.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Basic Information */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-[#0E2235]">Basic Information</h2>
                                <p className="text-sm text-gray-500">Name and personal details</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="First name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Last name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Preferred Name
                                </label>
                                <input
                                    type="text"
                                    name="preferred_name"
                                    value={formData.preferred_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="What do they like to be called?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={formData.date_of_birth}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Gender
                                </label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="non-binary">Non-binary</option>
                                    <option value="other">Other</option>
                                    <option value="prefer-not-to-say">Prefer not to say</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <Phone className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-[#0E2235]">Contact Information</h2>
                                <p className="text-sm text-gray-500">Phone, email, and address</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>

                        {/* Address Fields */}
                        <div className="space-y-4">
                            <input
                                type="text"
                                name="address_line1"
                                value={formData.address_line1}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Street address"
                            />
                            <input
                                type="text"
                                name="address_line2"
                                value={formData.address_line2}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Apt, suite, unit, etc. (optional)"
                            />
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="City"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="State"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="text"
                                        name="zip"
                                        value={formData.zip}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="ZIP"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                <Heart className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-[#0E2235]">Emergency Contact</h2>
                                <p className="text-sm text-gray-500">Someone to contact in case of emergency</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    name="emergency_contact_name"
                                    value={formData.emergency_contact_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Contact name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    name="emergency_contact_phone"
                                    value={formData.emergency_contact_phone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                <input
                                    type="text"
                                    name="emergency_contact_relationship"
                                    value={formData.emergency_contact_relationship}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Spouse, Parent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-[#0E2235]">Additional Information</h2>
                                <p className="text-sm text-gray-500">Referral source and internal notes</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assigned Peer Support Specialist
                                </label>
                                <select
                                    name="primary_pss_id"
                                    value={formData.primary_pss_id}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Unassigned</option>
                                    {orgMembers.map(member => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}{member.role === 'admin' ? ' (Admin)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    Defaults to you. Select a different team member if needed.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Referral Source
                                </label>
                                <input
                                    type="text"
                                    name="referral_source"
                                    value={formData.referral_source}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="How did they find your services?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Internal Notes
                                </label>
                                <textarea
                                    name="internal_notes"
                                    value={formData.internal_notes}
                                    onChange={handleChange}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Any additional notes (not shared with participant)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 py-4 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !selectedOrg || userOrganizations.length === 0}
                            className="flex-1 py-4 bg-[#1A73A8] text-white rounded-xl font-semibold hover:bg-[#15608a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Participant
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
