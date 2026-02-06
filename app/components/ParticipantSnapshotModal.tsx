'use client';

import { useState } from 'react';
import {
    X, Loader2, Download, RefreshCw, Sparkles,
    TrendingUp, Target, AlertCircle, Lightbulb,
    Calendar, CheckCircle, Clock, FileText,
    Heart, Home, Briefcase, Scale, Flag, Brain, Activity
} from 'lucide-react';
import jsPDF from 'jspdf';

// ============================================================================
// Types
// ============================================================================

interface Snapshot {
    generatedAt: string;
    participant: {
        id: string;
        name: string;
        status: string;
        intakeDate: string;
        daysInProgram: number | null;
        referralSource: string;
        isReentryParticipant: boolean;
    };
    journey: {
        domains: any[];
        totalMilestones: number;
        recentEntries: any[];
    };
    goals: {
        active: any[];
        completed: any[];
        totalCount: number;
    };
    sessions: {
        recentCount: number;
        notes: any[];
    };
    assessments: {
        latest: any;
        previous: any;
        totalCount: number;
    };
    aiSummary: {
        overallStatus: string;
        strengthsAndWins: string[];
        areasOfFocus: string[];
        sessionThemes: string;
        recommendedNextSteps: string[];
        notablePattern: string;
    };
}

interface Props {
    participantId: string;
    participantName: string;
    organizationId: string;
    onClose: () => void;
}

// ============================================================================
// Icon Map
// ============================================================================

const DOMAIN_ICONS: Record<string, any> = {
    substance_use: Heart,
    housing: Home,
    employment: Briefcase,
    legal: Scale,
    program_phase: Flag,
    mental_health: Brain,
    default: Activity
};

// ============================================================================
// Component
// ============================================================================

export default function ParticipantSnapshotModal({
    participantId,
    participantName,
    organizationId,
    onClose
}: Props) {
    const [loading, setLoading] = useState(false);
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ========================================================================
    // Generate Snapshot
    // ========================================================================

    const generateSnapshot = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/participants/${participantId}/snapshot?organization_id=${organizationId}`
            );

            if (!res.ok) {
                throw new Error('Failed to generate snapshot');
            }

            const data = await res.json();
            if (data.success) {
                setSnapshot(data.snapshot);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate snapshot');
        } finally {
            setLoading(false);
        }
    };

    // ========================================================================
    // PDF Generation
    // ========================================================================

    const downloadPDF = () => {
        if (!snapshot) return;

        const doc = new jsPDF();
        let y = 20;
        const margin = 20;
        const pageHeight = doc.internal.pageSize.height;
        const maxWidth = 170;
        const lineHeight = 6;

        // Brand colors
        const primaryColor = { r: 26, g: 115, b: 168 }; // #1A73A8
        const successColor = { r: 34, g: 197, b: 94 }; // #22C55E
        const warningColor = { r: 245, g: 158, b: 11 }; // #F59E0B

        const checkNewPage = (neededSpace: number) => {
            if (y + neededSpace > pageHeight - 20) {
                doc.addPage();
                y = 20;
            }
        };

        const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color?: { r: number; g: number; b: number }) => {
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            if (color) {
                doc.setTextColor(color.r, color.g, color.b);
            } else {
                doc.setTextColor(0, 0, 0);
            }

            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line: string) => {
                checkNewPage(lineHeight);
                doc.text(line, margin, y);
                y += lineHeight;
            });
        };

        const addBullet = (text: string, indent: number = 5) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            const lines = doc.splitTextToSize(text, maxWidth - indent);
            lines.forEach((line: string, i: number) => {
                checkNewPage(lineHeight);
                if (i === 0) {
                    doc.text('•', margin + indent - 4, y);
                }
                doc.text(line, margin + indent, y);
                y += lineHeight;
            });
        };

        const addSection = (title: string) => {
            y += 4;
            checkNewPage(15);
            doc.setFillColor(245, 247, 250);
            doc.rect(margin - 2, y - 4, maxWidth + 4, 10, 'F');
            addText(title, 12, true, primaryColor);
            y += 2;
        };

        // ====================================================================
        // Header
        // ====================================================================
        doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Participant Snapshot', margin, 18);

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(snapshot.participant.name, margin, 28);

        doc.setFontSize(10);
        const genDate = new Date(snapshot.generatedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        doc.text(`Generated: ${genDate}`, margin, 36);

        doc.setTextColor(0, 0, 0);
        y = 50;

        // ====================================================================
        // At a Glance
        // ====================================================================
        addSection('AT A GLANCE');

        const glanceItems = [
            `${snapshot.participant.daysInProgram || '—'} days in program`,
            `${snapshot.journey.domains.length} domains tracked`,
            `${snapshot.journey.totalMilestones} milestones achieved`,
            `${snapshot.goals.active.length} active goals`,
            `${snapshot.sessions.recentCount} recent sessions`
        ];
        addText(glanceItems.join('  •  '), 10);
        y += 2;

        // ====================================================================
        // Overall Status
        // ====================================================================
        addSection('CURRENT STATUS');
        addText(snapshot.aiSummary.overallStatus, 11);
        y += 2;

        // ====================================================================
        // Strengths & Recent Wins
        // ====================================================================
        addSection('STRENGTHS & RECENT WINS');
        snapshot.aiSummary.strengthsAndWins.forEach(item => {
            addBullet(item);
        });

        // ====================================================================
        // Areas of Focus
        // ====================================================================
        addSection('AREAS OF FOCUS');
        snapshot.aiSummary.areasOfFocus.forEach(item => {
            addBullet(item);
        });

        // ====================================================================
        // Journey Status
        // ====================================================================
        if (snapshot.journey.domains.length > 0) {
            addSection('JOURNEY TRACKER STATUS');
            snapshot.journey.domains.forEach((domain: any) => {
                const status = domain.current_status?.status_label || 'Unknown';
                addBullet(`${domain.domain_label}: ${status}`);
            });
        }

        // ====================================================================
        // Goals
        // ====================================================================
        if (snapshot.goals.active.length > 0) {
            addSection('ACTIVE GOALS');
            snapshot.goals.active.forEach((goal: any) => {
                const goalText = goal.smart_goal || goal.desired_outcome;
                addBullet(`${goalText} (${goal.progress}% complete)`);
            });
        }

        // ====================================================================
        // Session Themes
        // ====================================================================
        if (snapshot.aiSummary.sessionThemes) {
            addSection('RECENT SESSION THEMES');
            addText(snapshot.aiSummary.sessionThemes, 10);
        }

        // ====================================================================
        // Recovery Capital
        // ====================================================================
        if (snapshot.assessments.latest) {
            addSection('RECOVERY CAPITAL');
            const latest = snapshot.assessments.latest;
            const maxScore = latest.assessment_type === 'mirc28' ? 140 : 60;
            const percentage = Math.round((latest.total_score / maxScore) * 100);
            
            addText(`Latest Score: ${latest.total_score}/${maxScore} (${percentage}%)`, 11, true);
            
            if (snapshot.assessments.previous) {
                const diff = latest.total_score - snapshot.assessments.previous.total_score;
                const trend = diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '→ No change';
                addText(`Trend: ${trend} from previous assessment`, 10);
            }
        }

        // ====================================================================
        // Recommended Next Steps
        // ====================================================================
        addSection('RECOMMENDED NEXT STEPS');
        snapshot.aiSummary.recommendedNextSteps.forEach((item, i) => {
            addBullet(`${item}`);
        });

        // ====================================================================
        // Notable Pattern
        // ====================================================================
        if (snapshot.aiSummary.notablePattern) {
            addSection('PATTERN INSIGHT');
            checkNewPage(20);
            doc.setFillColor(237, 233, 254);
            const patternLines = doc.splitTextToSize(snapshot.aiSummary.notablePattern, maxWidth - 10);
            const boxHeight = patternLines.length * lineHeight + 8;
            doc.rect(margin - 2, y - 4, maxWidth + 4, boxHeight, 'F');
            patternLines.forEach((line: string) => {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(88, 28, 135);
                doc.text(line, margin + 3, y);
                y += lineHeight;
            });
        }

        // ====================================================================
        // Footer
        // ====================================================================
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Continuum Care Studio • Participant Snapshot • Page ${i} of ${totalPages}`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }

        // Save
        const fileName = `${participantName.replace(/[^a-z0-9]/gi, '_')}_Snapshot_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#0E2235]">Participant Snapshot</h2>
                            <p className="text-sm text-gray-500">{participantName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Initial State - Generate Button */}
                    {!loading && !snapshot && !error && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-6">
                                <Sparkles className="w-10 h-10 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-[#0E2235] mb-2">
                                Generate AI-Powered Snapshot
                            </h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">
                                Create a comprehensive summary of {participantName}'s recovery journey, 
                                including insights from session notes, goals, assessments, and journey tracking.
                            </p>
                            <button
                                onClick={generateSnapshot}
                                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 mx-auto"
                            >
                                <Sparkles className="w-5 h-5" />
                                Generate Snapshot
                            </button>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-12">
                            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                            <p className="text-gray-600 font-medium">Analyzing participant data...</p>
                            <p className="text-sm text-gray-400 mt-1">This may take a few moments</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <p className="text-red-600 font-medium mb-4">{error}</p>
                            <button
                                onClick={generateSnapshot}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Snapshot Content */}
                    {snapshot && (
                        <div className="space-y-6">
                            {/* Generated timestamp */}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    Generated {new Date(snapshot.generatedAt).toLocaleString()}
                                </span>
                                <button
                                    onClick={generateSnapshot}
                                    className="flex items-center gap-1 text-purple-600 hover:text-purple-700"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Regenerate
                                </button>
                            </div>

                            {/* At a Glance */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-purple-50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-purple-700">
                                        {snapshot.participant.daysInProgram || '—'}
                                    </p>
                                    <p className="text-xs text-purple-600">Days in Program</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-blue-700">
                                        {snapshot.journey.totalMilestones}
                                    </p>
                                    <p className="text-xs text-blue-600">Milestones</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-green-700">
                                        {snapshot.goals.completed.length}
                                    </p>
                                    <p className="text-xs text-green-600">Goals Completed</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-amber-700">
                                        {snapshot.sessions.recentCount}
                                    </p>
                                    <p className="text-xs text-amber-600">Recent Sessions</p>
                                </div>
                            </div>

                            {/* Overall Status */}
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
                                <h3 className="font-semibold text-[#0E2235] mb-2 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-purple-600" />
                                    Current Status
                                </h3>
                                <p className="text-gray-700 leading-relaxed">
                                    {snapshot.aiSummary.overallStatus}
                                </p>
                            </div>

                            {/* Two Column Layout */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Strengths & Wins */}
                                <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" />
                                        Strengths & Recent Wins
                                    </h3>
                                    <ul className="space-y-2">
                                        {snapshot.aiSummary.strengthsAndWins.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                                                <span className="text-green-500 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Areas of Focus */}
                                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                                    <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        Areas of Focus
                                    </h3>
                                    <ul className="space-y-2">
                                        {snapshot.aiSummary.areasOfFocus.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                                                <span className="text-amber-500 mt-1">•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Journey Status */}
                            {snapshot.journey.domains.length > 0 && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200">
                                    <h3 className="font-semibold text-[#0E2235] mb-4 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-purple-600" />
                                        Journey Tracker Status
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {snapshot.journey.domains.map((domain: any) => {
                                            const Icon = DOMAIN_ICONS[domain.domain_key] || DOMAIN_ICONS.default;
                                            return (
                                                <div
                                                    key={domain.domain_id}
                                                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                                                >
                                                    <Icon
                                                        className="w-4 h-4 flex-shrink-0"
                                                        style={{ color: domain.color }}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {domain.domain_label}
                                                        </p>
                                                        <p
                                                            className="text-sm font-medium truncate"
                                                            style={{ color: domain.color }}
                                                        >
                                                            {domain.current_status?.status_label || 'Unknown'}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Recovery Capital */}
                            {snapshot.assessments.latest && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200">
                                    <h3 className="font-semibold text-[#0E2235] mb-3 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-purple-600" />
                                        Recovery Capital
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-3xl font-bold text-[#1A73A8]">
                                                {snapshot.assessments.latest.total_score}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                / {snapshot.assessments.latest.assessment_type === 'mirc28' ? 140 : 60}
                                            </p>
                                        </div>
                                        {snapshot.assessments.previous && (
                                            <div className="flex-1">
                                                {(() => {
                                                    const diff = snapshot.assessments.latest.total_score - snapshot.assessments.previous.total_score;
                                                    return (
                                                        <div className={`flex items-center gap-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {diff >= 0 ? (
                                                                <TrendingUp className="w-4 h-4" />
                                                            ) : (
                                                                <TrendingUp className="w-4 h-4 rotate-180" />
                                                            )}
                                                            <span className="font-medium">
                                                                {diff >= 0 ? '+' : ''}{diff} from previous
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Session Themes */}
                            {snapshot.aiSummary.sessionThemes && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200">
                                    <h3 className="font-semibold text-[#0E2235] mb-2 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-purple-600" />
                                        Recent Session Themes
                                    </h3>
                                    <p className="text-gray-600 text-sm">
                                        {snapshot.aiSummary.sessionThemes}
                                    </p>
                                </div>
                            )}

                            {/* Recommended Next Steps */}
                            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                    <Lightbulb className="w-5 h-5" />
                                    Recommended Next Steps
                                </h3>
                                <ul className="space-y-2">
                                    {snapshot.aiSummary.recommendedNextSteps.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                                            <span className="bg-blue-200 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium mt-0.5">
                                                {i + 1}
                                            </span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Notable Pattern */}
                            {snapshot.aiSummary.notablePattern && (
                                <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
                                    <h3 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5" />
                                        Pattern Insight
                                    </h3>
                                    <p className="text-purple-700 text-sm italic">
                                        "{snapshot.aiSummary.notablePattern}"
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {snapshot && (
                    <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={downloadPDF}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
