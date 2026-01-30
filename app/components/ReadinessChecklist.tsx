'use client';

// ============================================================================
// Peer Support Studio - Readiness Checklist Component
// File: /app/components/ReadinessChecklist.tsx
// ============================================================================

import { useState, useEffect } from 'react';
import {
    Fingerprint, CreditCard, Heart, Home, Scale,
    Check, X, Clock, AlertTriangle, Minus,
    ChevronDown, ChevronUp, Loader2, Plus,
    Calendar, FileText, RefreshCw
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ReadinessCategory = 'identity' | 'financial' | 'healthcare' | 'housing' | 'legal';
type ReadinessStatus = 'not_needed' | 'missing' | 'in_progress' | 'obtained' | 'expired';

interface ReadinessItem {
    id: string;
    participant_id: string;
    item_key: string;
    status: ReadinessStatus;
    obtained_date?: string;
    expiration_date?: string;
    notes?: string;
    category: ReadinessCategory;
    item_label: string;
    description?: string;
    display_order: number;
}

interface ReadinessSummary {
    obtained_count: number;
    in_progress_count: number;
    missing_count: number;
    expired_count: number;
    not_needed_count: number;
    total_items: number;
    completion_percentage: number;
}

interface ReadinessChecklistProps {
    participantId: string;
    organizationId: string;
    participantName: string;
    isReentryParticipant?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<ReadinessCategory, {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
}> = {
    identity: {
        label: 'Identity Documents',
        icon: Fingerprint,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
    },
    financial: {
        label: 'Financial Access',
        icon: CreditCard,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
    },
    healthcare: {
        label: 'Healthcare',
        icon: Heart,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
    },
    housing: {
        label: 'Housing',
        icon: Home,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
    },
    legal: {
        label: 'Legal / Reentry',
        icon: Scale,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200'
    }
};

const STATUS_CONFIG: Record<ReadinessStatus, {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
}> = {
    not_needed: { label: 'N/A', icon: Minus, color: 'text-gray-400', bgColor: 'bg-gray-100' },
    missing: { label: 'Missing', icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
    in_progress: { label: 'In Progress', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    obtained: { label: 'Obtained', icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
    expired: { label: 'Expired', icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' }
};

const CATEGORY_ORDER: ReadinessCategory[] = ['identity', 'financial', 'healthcare', 'housing', 'legal'];

// ============================================================================
// Main Component
// ============================================================================

export default function ReadinessChecklist({
    participantId,
    organizationId,
    participantName,
    isReentryParticipant: initialIsReentry = false
}: ReadinessChecklistProps) {
    const [items, setItems] = useState<ReadinessItem[]>([]);
    const [summary, setSummary] = useState<ReadinessSummary | null>(null);
    const [isReentry, setIsReentry] = useState(initialIsReentry);
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
    const [editingItem, setEditingItem] = useState<string | null>(null);
    const [savingItem, setSavingItem] = useState<string | null>(null);

    // ========================================================================
    // Data Fetching
    // ========================================================================

    useEffect(() => {
        fetchReadinessItems();
    }, [participantId, organizationId]);

    async function fetchReadinessItems() {
        try {
            setLoading(true);
            const res = await fetch(
                `/api/participants/${participantId}/readiness?organization_id=${organizationId}`
            );
            const data = await res.json();

            if (data.success) {
                setItems(data.items || []);
                setSummary(data.summary);
                setIsReentry(data.is_reentry_participant);
            }
        } catch (error) {
            console.error('Error fetching readiness items:', error);
        } finally {
            setLoading(false);
        }
    }

    // ========================================================================
    // Actions
    // ========================================================================

    async function initializeChecklist() {
        try {
            setInitializing(true);
            const res = await fetch(`/api/participants/${participantId}/readiness`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organization_id: organizationId })
            });
            const data = await res.json();

            if (data.success) {
                setItems(data.items || []);
                setIsReentry(true);
                await fetchReadinessItems(); // Refresh to get summary
            }
        } catch (error) {
            console.error('Error initializing checklist:', error);
        } finally {
            setInitializing(false);
        }
    }

    async function updateItem(itemKey: string, updates: Partial<ReadinessItem>) {
        try {
            setSavingItem(itemKey);
            const res = await fetch(`/api/participants/${participantId}/readiness`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: organizationId,
                    item_key: itemKey,
                    ...updates
                })
            });
            const data = await res.json();

            if (data.success) {
                setItems(prev => prev.map(item =>
                    item.item_key === itemKey ? { ...item, ...data.item } : item
                ));
                // Refresh summary
                await fetchReadinessItems();
            }
        } catch (error) {
            console.error('Error updating item:', error);
        } finally {
            setSavingItem(null);
            setEditingItem(null);
        }
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    function toggleCategory(category: string) {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    }

    function groupItemsByCategory(): Record<ReadinessCategory, ReadinessItem[]> {
        const grouped: Record<ReadinessCategory, ReadinessItem[]> = {
            identity: [], financial: [], healthcare: [], housing: [], legal: []
        };
        items.forEach(item => {
            if (grouped[item.category]) {
                grouped[item.category].push(item);
            }
        });
        return grouped;
    }

    function getCategoryStats(categoryItems: ReadinessItem[]) {
        const obtained = categoryItems.filter(i => i.status === 'obtained').length;
        const total = categoryItems.filter(i => i.status !== 'not_needed').length;
        return { obtained, total };
    }

    // ========================================================================
    // Render: Empty State (Not a reentry participant yet)
    // ========================================================================

    if (!loading && !isReentry && items.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                    <Scale className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold text-[#0E2235] mb-2">
                    Reentry Readiness Checklist
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Track essential documents and resources for {participantName}'s successful reentry.
                    This checklist helps ensure they have what they need for stability.
                </p>
                <button
                    onClick={initializeChecklist}
                    disabled={initializing}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A73A8] text-white rounded-lg hover:bg-[#15608a] disabled:opacity-50 transition-colors"
                >
                    {initializing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        <>
                            <Plus className="w-5 h-5" />
                            Enable Reentry Tracking
                        </>
                    )}
                </button>
            </div>
        );
    }

    // ========================================================================
    // Render: Loading State
    // ========================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    // ========================================================================
    // Render: Main Checklist
    // ========================================================================

    const grouped = groupItemsByCategory();

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            {summary && (
                <div className="bg-gradient-to-r from-[#1A73A8] to-[#30B27A] rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Readiness Progress</h3>
                        <button
                            onClick={fetchReadinessItems}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span>{summary.obtained_count} of {summary.total_items - summary.not_needed_count} items obtained</span>
                            <span className="font-bold">{summary.completion_percentage}%</span>
                        </div>
                        <div className="h-3 bg-white/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-500"
                                style={{ width: `${summary.completion_percentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 text-center text-sm">
                        <div>
                            <p className="text-2xl font-bold">{summary.obtained_count}</p>
                            <p className="opacity-80">Obtained</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.in_progress_count}</p>
                            <p className="opacity-80">In Progress</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.missing_count}</p>
                            <p className="opacity-80">Missing</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{summary.expired_count}</p>
                            <p className="opacity-80">Expired</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Sections */}
            {CATEGORY_ORDER.map(category => {
                const config = CATEGORY_CONFIG[category];
                const categoryItems = grouped[category];
                const stats = getCategoryStats(categoryItems);
                const isExpanded = expandedCategories.has(category);
                const Icon = config.icon;

                if (categoryItems.length === 0) return null;

                return (
                    <div
                        key={category}
                        className={`bg-white rounded-xl border ${config.borderColor} overflow-hidden`}
                    >
                        {/* Category Header */}
                        <button
                            onClick={() => toggleCategory(category)}
                            className={`w-full flex items-center justify-between p-4 ${config.bgColor} hover:opacity-90 transition-opacity`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center ${config.color}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-semibold text-[#0E2235]">{config.label}</h4>
                                    <p className="text-sm text-gray-600">
                                        {stats.obtained} of {stats.total} obtained
                                    </p>
                                </div>
                            </div>
                            {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                        </button>

                        {/* Category Items */}
                        {isExpanded && (
                            <div className="divide-y divide-gray-100">
                                {categoryItems.map(item => (
                                    <ReadinessItemRow
                                        key={item.id}
                                        item={item}
                                        isEditing={editingItem === item.item_key}
                                        isSaving={savingItem === item.item_key}
                                        onEdit={() => setEditingItem(item.item_key)}
                                        onCancel={() => setEditingItem(null)}
                                        onSave={(updates) => updateItem(item.item_key, updates)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================================
// Readiness Item Row Component
// ============================================================================

interface ReadinessItemRowProps {
    item: ReadinessItem;
    isEditing: boolean;
    isSaving: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: (updates: Partial<ReadinessItem>) => void;
}

function ReadinessItemRow({
    item,
    isEditing,
    isSaving,
    onEdit,
    onCancel,
    onSave
}: ReadinessItemRowProps) {
    const [status, setStatus] = useState(item.status);
    const [obtainedDate, setObtainedDate] = useState(item.obtained_date || '');
    const [expirationDate, setExpirationDate] = useState(item.expiration_date || '');
    const [notes, setNotes] = useState(item.notes || '');

    const statusConfig = STATUS_CONFIG[item.status];
    const StatusIcon = statusConfig.icon;

    function handleSave() {
        onSave({
            status,
            obtained_date: obtainedDate || null,
            expiration_date: expirationDate || null,
            notes: notes || null
        } as any);
    }

    // Reset form when item changes
    useEffect(() => {
        setStatus(item.status);
        setObtainedDate(item.obtained_date || '');
        setExpirationDate(item.expiration_date || '');
        setNotes(item.notes || '');
    }, [item]);

    if (isEditing) {
        return (
            <div className="p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h5 className="font-medium text-[#0E2235]">{item.item_label}</h5>
                        {item.description && (
                            <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {/* Status Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as ReadinessStatus)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        >
                            <option value="missing">Missing</option>
                            <option value="in_progress">In Progress</option>
                            <option value="obtained">Obtained</option>
                            <option value="expired">Expired</option>
                            <option value="not_needed">Not Needed (N/A)</option>
                        </select>
                    </div>

                    {/* Obtained Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date Obtained
                        </label>
                        <input
                            type="date"
                            value={obtainedDate}
                            onChange={(e) => setObtainedDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                    </div>

                    {/* Expiration Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expiration Date
                        </label>
                        <input
                            type="date"
                            value={expirationDate}
                            onChange={(e) => setExpirationDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g., Applied at DMV, waiting for appointment"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1A73A8]/20 focus:border-[#1A73A8]"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#15608a] disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onEdit}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-full ${statusConfig.bgColor} flex items-center justify-center`}>
                        <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                    </div>

                    {/* Item Info */}
                    <div>
                        <h5 className="font-medium text-[#0E2235]">{item.item_label}</h5>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className={statusConfig.color}>{statusConfig.label}</span>
                            {item.obtained_date && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(item.obtained_date).toLocaleDateString()}
                                </span>
                            )}
                            {item.notes && (
                                <span className="flex items-center gap-1 truncate max-w-[200px]">
                                    <FileText className="w-3 h-3" />
                                    {item.notes}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Expiration Warning */}
                {item.expiration_date && new Date(item.expiration_date) < new Date() && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                        Expired
                    </span>
                )}
            </div>
        </div>
    );
}
