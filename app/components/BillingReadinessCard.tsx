'use client';

// ============================================================================
// Billing Readiness Card
// File: app/components/BillingReadinessCard.tsx
//
// Displays billing readiness status on the participant detail page.
// Shows a compact badge in the quick stats area, expandable to full
// hold details. Drives staff to complete billing-critical fields.
// ============================================================================

import { useState } from 'react';
import Link from 'next/link';
import {
    FileCheck, AlertTriangle, ChevronDown, ChevronUp,
    Shield, CircleDot, ExternalLink, CheckCircle2, X
} from 'lucide-react';
import { computeBillingReadiness, type BillingReadinessResult, type BillingHold } from '@/lib/billingReadiness';

interface BillingReadinessCardProps {
    intake: Record<string, any> | null;
    participantId: string;
}

// Section labels for hold items
const SECTION_LABELS: Record<string, string> = {
    consent: 'Consent & Authorization',
    insurance: 'Insurance & Eligibility',
    clinical: 'Clinical Reference',
};

export default function BillingReadinessCard({ intake, participantId }: BillingReadinessCardProps) {
    const [expanded, setExpanded] = useState(false);

    // No intake at all
    if (!intake) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-500">Billing Status</p>
                            <p className="text-sm text-gray-400">No intake on file</p>
                        </div>
                    </div>
                    <Link
                        href={`/intake?participant_id=${participantId}`}
                        className="text-xs text-[#1A73A8] hover:underline flex items-center gap-1"
                    >
                        Start Intake <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </div>
        );
    }

    // Compute readiness (use pre-computed holds if available, else compute)
    let result: BillingReadinessResult;
    if (intake.billing_readiness_holds && Array.isArray(intake.billing_readiness_holds)) {
        const holds = intake.billing_readiness_holds as BillingHold[];
        const blockers = holds.filter(h => h.severity === 'blocker');
        const warnings = holds.filter(h => h.severity === 'warning');
        const ready = blockers.length === 0;
        let summary: string;
        if (ready && warnings.length === 0) {
            summary = 'Billing ready — all required information is on file';
        } else if (ready) {
            summary = `Billing ready with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`;
        } else {
            summary = `Not billing ready — ${blockers.length} issue${blockers.length === 1 ? '' : 's'} must be resolved`;
        }
        result = { ready, blockers, warnings, holds, summary };
    } else {
        result = computeBillingReadiness(intake);
    }

    const { ready, blockers, warnings, holds, summary } = result;

    // Status colors and icons
    const statusConfig = ready
        ? warnings.length === 0
            ? { bg: 'bg-green-50', border: 'border-green-200', iconBg: 'bg-green-100', iconColor: 'text-green-600', textColor: 'text-green-700', label: 'Billing Ready', Icon: CheckCircle2 }
            : { bg: 'bg-green-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', textColor: 'text-amber-700', label: 'Ready (Warnings)', Icon: AlertTriangle }
        : { bg: 'bg-red-50', border: 'border-red-200', iconBg: 'bg-red-100', iconColor: 'text-red-600', textColor: 'text-red-700', label: 'Not Billing Ready', Icon: AlertTriangle };

    // Group holds by section
    const holdsBySection: Record<string, BillingHold[]> = {};
    holds.forEach(h => {
        const key = h.section || 'other';
        if (!holdsBySection[key]) holdsBySection[key] = [];
        holdsBySection[key].push(h);
    });

    return (
        <div className={`rounded-xl border ${statusConfig.border} overflow-hidden`}>
            {/* Compact header — always visible */}
            <button
                onClick={() => holds.length > 0 && setExpanded(!expanded)}
                className={`w-full ${statusConfig.bg} p-5 flex items-center justify-between ${holds.length > 0 ? 'cursor-pointer hover:opacity-90' : 'cursor-default'} transition-opacity`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${statusConfig.iconBg} flex items-center justify-center`}>
                        <statusConfig.Icon className={`w-5 h-5 ${statusConfig.iconColor}`} />
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold ${statusConfig.textColor}`}>
                                {statusConfig.label}
                            </p>
                            {blockers.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-200 text-red-800 text-[10px] font-bold rounded-full">
                                    {blockers.length}
                                </span>
                            )}
                            {warnings.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full">
                                    {warnings.length}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{summary}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {holds.length > 0 && (
                        expanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </button>

            {/* Expanded hold details */}
            {expanded && holds.length > 0 && (
                <div className="bg-white border-t border-gray-100 divide-y divide-gray-50">
                    {Object.entries(holdsBySection).map(([section, sectionHolds]) => (
                        <div key={section} className="px-5 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                                {SECTION_LABELS[section] || section}
                            </p>
                            <div className="space-y-2">
                                {sectionHolds.map((hold, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <CircleDot className={`w-3 h-3 mt-0.5 flex-shrink-0 ${
                                            hold.severity === 'blocker' ? 'text-red-500' : 'text-amber-400'
                                        }`} />
                                        <div>
                                            <p className="text-sm text-gray-700">{hold.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Action link */}
                    <div className="px-5 py-3 bg-gray-50">
                        <Link
                            href={`/intake?participant_id=${participantId}&edit=true&intake_id=${intake.id}`}
                            className="text-sm text-[#1A73A8] hover:underline flex items-center gap-1"
                        >
                            Edit intake to resolve <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Compact badge version for the Quick Stats grid
// ============================================================================

export function BillingStatusBadge({ intake }: { intake: Record<string, any> | null }) {
    if (!intake) {
        return (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-400">—</p>
                        <p className="text-sm text-gray-500">Billing Status</p>
                    </div>
                </div>
            </div>
        );
    }

    let blockerCount = 0;
    let warningCount = 0;

    if (intake.billing_readiness_holds && Array.isArray(intake.billing_readiness_holds)) {
        blockerCount = intake.billing_readiness_holds.filter((h: any) => h.severity === 'blocker').length;
        warningCount = intake.billing_readiness_holds.filter((h: any) => h.severity === 'warning').length;
    } else {
        const result = computeBillingReadiness(intake);
        blockerCount = result.blockers.length;
        warningCount = result.warnings.length;
    }

    const isReady = blockerCount === 0;
    const hasWarnings = warningCount > 0;

    return (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isReady
                        ? hasWarnings ? 'bg-amber-100' : 'bg-green-100'
                        : 'bg-red-100'
                }`}>
                    {isReady
                        ? hasWarnings
                            ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                            : <FileCheck className="w-5 h-5 text-green-600" />
                        : <AlertTriangle className="w-5 h-5 text-red-600" />
                    }
                </div>
                <div>
                    <p className={`text-sm font-bold ${
                        isReady
                            ? hasWarnings ? 'text-amber-700' : 'text-green-700'
                            : 'text-red-700'
                    }`}>
                        {isReady ? (hasWarnings ? 'Warnings' : 'Ready') : `${blockerCount} Hold${blockerCount !== 1 ? 's' : ''}`}
                    </p>
                    <p className="text-sm text-gray-500">Billing Status</p>
                </div>
            </div>
        </div>
    );
}
