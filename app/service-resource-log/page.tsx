'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    Plus,
    Download,
    X,
    Car,
    HandHeart,
    Package,
    Trash2,
    Settings,
} from 'lucide-react';

const CATEGORIES = ['clothing', 'food', 'harm_reduction', 'hygiene', 'other'];
const catLabel = (c: string) => (c === 'harm_reduction' ? 'Harm reduction' : c.charAt(0).toUpperCase() + c.slice(1));

type LogType = 'transportation' | 'volunteer' | 'supplies';

interface LogRow {
    id: string;
    log_type: LogType;
    service_date: string;
    participant_name: string | null;
    total_cost: string | null;
    total_hours: string | null;
    details: any;
    notes: string | null;
}

const TABS: { type: LogType; label: string; icon: any }[] = [
    { type: 'transportation', label: 'Transportation', icon: Car },
    { type: 'volunteer', label: 'Volunteer', icon: HandHeart },
    { type: 'supplies', label: 'Supplies', icon: Package },
];

const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function ServiceResourceLogPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const currentOrg = (session as any)?.currentOrganization;

    const [tab, setTab] = useState<LogType>('transportation');
    const [logs, setLogs] = useState<LogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const role = (session as any)?.currentOrganization?.role || '';
    const canManage = role === 'admin' || role === 'owner';

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/service-resource-log?log_type=${tab}&limit=200`);
            const data = await res.json();
            setLogs(data.logs || []);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') load();
    }, [authStatus, load]);

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
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <nav className="flex items-center gap-2 text-sm">
                        <button onClick={() => router.push('/')} className="text-[#1A73A8] hover:underline">
                            Dashboard
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 font-medium">Service &amp; Resource Log</span>
                    </nav>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">Service &amp; Resource Log</h1>
                        <p className="text-gray-600 mt-1">Transportation, volunteer hours, and supplies — for grant reporting.</p>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href={`/api/service-resource-log?log_type=${tab}&export=csv`}
                            className="px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </a>
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-5 py-2.5 text-white font-medium rounded-lg hover:opacity-90 flex items-center gap-2 text-sm"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            <Plus className="w-4 h-4" />
                            New entry
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center justify-between gap-2 mb-6">
                    <div className="flex gap-2">
                        {TABS.map((t) => {
                            const Icon = t.icon;
                            return (
                                <button
                                    key={t.type}
                                    onClick={() => setTab(t.type)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                                        tab === t.type ? 'bg-[#1A73A8] text-white' : 'text-gray-600 hover:bg-gray-100 bg-white border border-gray-200'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>
                    {tab === 'supplies' && canManage && (
                        <button
                            onClick={() => setShowCatalog(true)}
                            className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 bg-white border border-gray-200 flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Manage items
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-12 text-center text-gray-500">
                        No {tab} entries yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] overflow-hidden">
                        {logs.map((l) => (
                            <div key={l.id} className="flex items-center gap-4 px-6 py-4 border-b border-gray-50">
                                <div className="w-24 text-sm text-gray-500">{fmtDate(l.service_date)}</div>
                                <div className="flex-1 text-sm text-[#0E2235]">
                                    {l.participant_name || <span className="text-gray-400">No participant</span>}
                                    <div className="text-xs text-gray-500">{summarize(l)}</div>
                                </div>
                                <div className="text-sm text-right text-gray-600">
                                    {l.total_cost != null && Number(l.total_cost) > 0 && (
                                        <div className="font-medium text-[#0E2235]">${Number(l.total_cost).toFixed(2)}</div>
                                    )}
                                    {l.total_hours != null && Number(l.total_hours) > 0 && (
                                        <div className="text-xs">{Number(l.total_hours)} hrs</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showForm && (
                <EntryForm
                    type={tab}
                    orgId={currentOrg?.id}
                    onClose={() => setShowForm(false)}
                    onSaved={() => {
                        setShowForm(false);
                        load();
                    }}
                />
            )}

            {showCatalog && <CatalogManager onClose={() => setShowCatalog(false)} />}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
function CatalogManager({ onClose }: { onClose: () => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('other');
    const [unit, setUnit] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/resource-items');
            const data = await res.json();
            setItems(data.items || []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const addItem = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/resource-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), category, unit: unit.trim() || null }),
            });
            if (!res.ok) throw new Error();
            setName('');
            setUnit('');
            await load();
        } catch {
            alert('Could not add item.');
        } finally {
            setSaving(false);
        }
    };

    const removeItem = async (id: string) => {
        if (!confirm('Remove this item from the catalog? Past log entries are unaffected.')) return;
        setItems((arr) => arr.filter((i) => i.id !== id));
        await fetch(`/api/resource-items?id=${id}`, { method: 'DELETE' }).catch(() => {});
    };

    const grouped = CATEGORIES.map((c) => ({ category: c, items: items.filter((i) => i.category === c) })).filter(
        (g) => g.items.length > 0
    );

    const inputCls =
        'px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] text-sm';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-[#0E2235]">Manage supply items</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Add form */}
                <div className="p-5 border-b border-gray-100">
                    <div className="flex flex-wrap gap-2">
                        <input
                            className={`${inputCls} flex-1 min-w-[140px]`}
                            placeholder="New item name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addItem()}
                        />
                        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {catLabel(c)}
                                </option>
                            ))}
                        </select>
                        <input
                            className={`${inputCls} w-20`}
                            placeholder="unit"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                        />
                        <button
                            onClick={addItem}
                            disabled={saving || !name.trim()}
                            className="px-4 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                        >
                            Add
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="p-5 overflow-y-auto">
                    {loading ? (
                        <div className="py-6 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-[#1A73A8] mx-auto" />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No items yet. Add some above.</p>
                    ) : (
                        grouped.map((g) => (
                            <div key={g.category} className="mb-4">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                    {catLabel(g.category)}
                                </p>
                                {g.items.map((it) => (
                                    <div
                                        key={it.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                                    >
                                        <span className="text-sm text-[#0E2235]">
                                            {it.name}
                                            {it.unit && <span className="text-gray-400"> · {it.unit}</span>}
                                        </span>
                                        <button
                                            onClick={() => removeItem(it.id)}
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function summarize(l: LogRow): string {
    const d = l.details || {};
    if (l.log_type === 'transportation') {
        return [d.mode, d.start_point && d.end_point ? `${d.start_point} → ${d.end_point}` : null, d.mileage ? `${d.mileage} mi` : null]
            .filter(Boolean)
            .join(' · ');
    }
    if (l.log_type === 'volunteer') {
        return [d.activity, d.role].filter(Boolean).join(' · ');
    }
    if (l.log_type === 'supplies') {
        const items = Array.isArray(d.items) ? d.items : [];
        return items.map((i: any) => `${i.quantity || 1}× ${i.name}`).join(', ');
    }
    return '';
}

// ─────────────────────────────────────────────────────────────────────────────
function EntryForm({
    type,
    orgId,
    onClose,
    onSaved,
}: {
    type: LogType;
    orgId?: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [serviceDate, setServiceDate] = useState(today());
    const [notes, setNotes] = useState('');

    // Participant (optional)
    const [participantId, setParticipantId] = useState('');
    const [participantLabel, setParticipantLabel] = useState('');
    const [pSearch, setPSearch] = useState('');
    const [pResults, setPResults] = useState<any[]>([]);

    // Transportation
    const [mode, setMode] = useState('');
    const [mileage, setMileage] = useState('');
    const [startPoint, setStartPoint] = useState('');
    const [endPoint, setEndPoint] = useState('');
    const [cost, setCost] = useState('');
    const [purpose, setPurpose] = useState('');

    // Volunteer
    const [activity, setActivity] = useState('');
    const [role, setRole] = useState('');
    const [hours, setHours] = useState('');

    // Supplies
    const [catalog, setCatalog] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        if (type === 'supplies') {
            fetch('/api/resource-items')
                .then((r) => r.json())
                .then((d) => setCatalog(d.items || []))
                .catch(() => {});
        }
    }, [type]);

    useEffect(() => {
        if (!orgId || pSearch.trim().length < 2) {
            setPResults([]);
            return;
        }
        let active = true;
        const t = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/participants?organization_id=${orgId}&search=${encodeURIComponent(pSearch)}&status=active`
                );
                const data = await res.json();
                if (active) setPResults(data.participants || []);
            } catch {
                if (active) setPResults([]);
            }
        }, 250);
        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [pSearch, orgId]);

    const addItem = (it: any) =>
        setItems((arr) => [...arr, { item_id: it.id, name: it.name, category: it.category, quantity: 1, unit_cost: it.default_cost || 0 }]);
    const updItem = (idx: number, k: string, v: any) =>
        setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));
    const rmItem = (idx: number) => setItems((arr) => arr.filter((_, i) => i !== idx));
    const suppliesTotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0);

    const save = async () => {
        setSaving(true);
        let details: any = {};
        let total_cost: number | null = null;
        let total_hours: number | null = null;

        if (type === 'transportation') {
            details = { mode, mileage: mileage ? Number(mileage) : null, start_point: startPoint, end_point: endPoint, purpose };
            total_cost = cost ? Number(cost) : null;
        } else if (type === 'volunteer') {
            details = { activity, role };
            total_hours = hours ? Number(hours) : null;
        } else {
            details = { items };
        }

        try {
            const res = await fetch('/api/service-resource-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    log_type: type,
                    service_date: serviceDate,
                    participant_id: participantId || null,
                    details,
                    total_cost,
                    total_hours,
                    notes: notes || null,
                }),
            });
            if (!res.ok) throw new Error('save failed');
            onSaved();
        } catch {
            alert('Could not save the entry.');
            setSaving(false);
        }
    };

    const inputCls =
        'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] text-sm';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
                    <h3 className="font-semibold text-[#0E2235] capitalize">New {type} entry</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input type="date" className={inputCls} value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
                    </div>

                    {/* Participant picker (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Participant <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        {participantId ? (
                            <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm">
                                <span>{participantLabel}</span>
                                <button
                                    onClick={() => {
                                        setParticipantId('');
                                        setParticipantLabel('');
                                    }}
                                    className="text-gray-400 hover:text-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    className={inputCls}
                                    placeholder="Search participants..."
                                    value={pSearch}
                                    onChange={(e) => setPSearch(e.target.value)}
                                />
                                {pResults.length > 0 && (
                                    <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                                        {pResults.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setParticipantId(p.id);
                                                    setParticipantLabel(`${p.preferred_name || p.first_name} ${p.last_name}`);
                                                    setPSearch('');
                                                    setPResults([]);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                            >
                                                {(p.preferred_name || p.first_name)} {p.last_name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Type-specific fields */}
                    {type === 'transportation' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                                    <input className={inputCls} placeholder="Uber, agency van..." value={mode} onChange={(e) => setMode(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                                    <input type="number" className={inputCls} value={mileage} onChange={(e) => setMileage(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start point</label>
                                    <input className={inputCls} value={startPoint} onChange={(e) => setStartPoint(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End point</label>
                                    <input className={inputCls} value={endPoint} onChange={(e) => setEndPoint(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost ($)</label>
                                    <input type="number" step="0.01" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                                    <input className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}

                    {type === 'volunteer' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
                                <input className={inputCls} placeholder="e.g. Front desk, meal prep" value={activity} onChange={(e) => setActivity(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                                    <input type="number" step="0.25" className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}

                    {type === 'supplies' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                            {items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-2 mb-2">
                                    <span className="flex-1 text-sm">{it.name}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm"
                                        value={it.quantity}
                                        onChange={(e) => updItem(idx, 'quantity', e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-20 px-2 py-1 border border-gray-200 rounded text-sm"
                                        value={it.unit_cost}
                                        onChange={(e) => updItem(idx, 'unit_cost', e.target.value)}
                                    />
                                    <button onClick={() => rmItem(idx)} className="text-gray-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {catalog.length > 0 ? (
                                <select
                                    className={inputCls}
                                    value=""
                                    onChange={(e) => {
                                        const it = catalog.find((c) => c.id === e.target.value);
                                        if (it) addItem(it);
                                    }}
                                >
                                    <option value="">+ Add item from catalog...</option>
                                    {catalog.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.category ? `(${c.category})` : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-xs text-gray-400">
                                    No catalog items yet. An admin can add them under resource items.
                                </p>
                            )}
                            {items.length > 0 && (
                                <div className="text-right text-sm font-medium text-[#0E2235] mt-2">
                                    Total: ${suppliesTotal.toFixed(2)}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </div>

                <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-6 py-2.5 text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save entry'}
                    </button>
                    <button onClick={onClose} className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
