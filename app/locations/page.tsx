'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Plus, Loader2, MapPin, Users, Edit3, Trash2,
    Save, X, Home, Building
} from 'lucide-react';

interface Location {
    id: string;
    name: string;
    short_name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    capacity?: number;
    status: string;
    notes?: string;
    active_participants?: number;
    total_participants?: number;
    created_at: string;
}

export default function LocationsPage() {
    const router = useRouter();
    const { data: session } = useSession();

    const [currentOrg, setCurrentOrg] = useState<{ id: string; name: string } | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Location | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '', short_name: '', address: '', city: '', state: '', zip: '',
        capacity: '', notes: '', status: 'active'
    });

    // Init org
    useEffect(() => {
        async function init() {
            try {
                const orgRes = await fetch('/api/user/organizations');
                const orgData = await orgRes.json();
                if (orgData.organizations?.length > 0) setCurrentOrg(orgData.organizations[0]);
            } catch (e) { console.error(e); }
            finally { setAuthLoading(false); }
        }
        init();
    }, []);

    // Fetch locations
    useEffect(() => {
        if (!currentOrg?.id) return;
        fetchLocations();
    }, [currentOrg?.id]);

    const fetchLocations = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/locations?organization_id=${currentOrg!.id}&status=all&include_count=true`);
            const data = await res.json();
            setLocations(data.locations || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const resetForm = () => {
        setFormData({ name: '', short_name: '', address: '', city: '', state: '', zip: '', capacity: '', notes: '', status: 'active' });
        setEditing(null);
        setShowForm(false);
        setError('');
    };

    const openEdit = (loc: Location) => {
        setFormData({
            name: loc.name || '',
            short_name: loc.short_name || '',
            address: loc.address || '',
            city: loc.city || '',
            state: loc.state || '',
            zip: loc.zip || '',
            capacity: loc.capacity?.toString() || '',
            notes: loc.notes || '',
            status: loc.status || 'active',
        });
        setEditing(loc);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            setError('Location name is required');
            return;
        }
        setSaving(true);
        setError('');

        try {
            const payload = {
                ...formData,
                organization_id: currentOrg!.id,
                capacity: formData.capacity ? parseInt(formData.capacity) : null,
                ...(editing ? { id: editing.id } : {}),
            };

            const res = await fetch('/api/locations', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (data.success || data.location) {
                await fetchLocations();
                resetForm();
            } else {
                setError(data.error || 'Failed to save');
            }
        } catch (e) {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (loc: Location) => {
        const participantWarning = loc.total_participants && loc.total_participants > 0
            ? `\n\n${loc.total_participants} participant(s) will have their location unassigned.`
            : '';

        if (!confirm(`Delete "${loc.name}"?${participantWarning}\n\nThis cannot be undone.`)) return;

        try {
            await fetch(`/api/locations?id=${loc.id}&organization_id=${currentOrg!.id}`, { method: 'DELETE' });
            await fetchLocations();
        } catch (e) {
            console.error(e);
        }
    };

    const statusColors: Record<string, string> = {
        active: '#10B981',
        inactive: '#F59E0B',
        closed: '#EF4444',
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#F2F0EF' }}>
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: '#F2F0EF' }}>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-[#0E2235]">Locations</h1>
                                <p className="text-sm text-gray-500">Manage houses and program sites</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { resetForm(); setShowForm(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-medium hover:opacity-90"
                        >
                            <Plus className="w-4 h-4" /> Add Location
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-[#0E2235]">
                                    {editing ? 'Edit Location' : 'Add New Location'}
                                </h2>
                                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Downtown Recovery Center"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Short Name (for filters)</label>
                                    <input
                                        type="text"
                                        value={formData.short_name}
                                        onChange={e => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
                                        placeholder="e.g. Downtown"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="123 Main Street"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input type="text" value={formData.city}
                                            onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <input type="text" value={formData.state}
                                            onChange={e => setFormData(prev => ({ ...prev, state: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                                        <input type="text" value={formData.zip}
                                            onChange={e => setFormData(prev => ({ ...prev, zip: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                                        <input type="number" value={formData.capacity}
                                            onChange={e => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                                            placeholder="Max participants"
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                        <select value={formData.status}
                                            onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        rows={3}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
                                )}
                            </div>

                            <div className="p-6 border-t border-gray-100 flex gap-3">
                                <button onClick={resetForm}
                                    className="flex-1 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
                                >Cancel</button>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-medium disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Location Cards */}
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : locations.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Locations Yet</h3>
                        <p className="text-gray-500 mb-6">
                            Add your program sites and service locations to organize participants by location.
                        </p>
                        <button onClick={() => { resetForm(); setShowForm(true); }}
                            className="px-6 py-3 bg-gradient-to-r from-[#1A73A8] to-[#30B27A] text-white rounded-xl font-medium hover:opacity-90"
                        >
                            <Plus className="w-4 h-4 inline mr-2" /> Add First Location
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {locations.map(loc => {
                            const occupancy = loc.capacity
                                ? Math.round(((loc.active_participants || 0) / loc.capacity) * 100)
                                : null;

                            return (
                                <div key={loc.id} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <Home className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-[#0E2235]">{loc.name}</h3>
                                                    {loc.short_name && loc.short_name !== loc.name && (
                                                        <span className="text-xs text-gray-400">({loc.short_name})</span>
                                                    )}
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: `${statusColors[loc.status]}15`,
                                                            color: statusColors[loc.status]
                                                        }}
                                                    >
                                                        {loc.status}
                                                    </span>
                                                </div>

                                                {(loc.address || loc.city) && (
                                                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5" />
                                                        {[loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(', ')}
                                                    </p>
                                                )}

                                                <div className="flex items-center gap-4 mt-2">
                                                    <span className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Users className="w-3.5 h-3.5" />
                                                        {loc.active_participants || 0} active
                                                        {loc.capacity ? ` / ${loc.capacity} capacity` : ''}
                                                    </span>
                                                    {occupancy !== null && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${Math.min(occupancy, 100)}%`,
                                                                        backgroundColor: occupancy >= 90 ? '#EF4444' : occupancy >= 70 ? '#F59E0B' : '#10B981'
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-gray-400">{occupancy}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEdit(loc)}
                                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                                                title="Edit"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(loc)}
                                                className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {loc.notes && (
                                        <p className="text-sm text-gray-500 mt-3 pl-16 italic">{loc.notes}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
