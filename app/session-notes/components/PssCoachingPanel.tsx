'use client';

import { 
    Sparkles, ThumbsUp, TrendingUp, Target, 
    MessageCircle, AlertTriangle, Lightbulb,
    CheckCircle, ArrowRight, Award
} from 'lucide-react';

interface PssCoaching {
    whatWentWell: string[];
    growthOpportunities: string[];
    suggestedFollowUpActions: string[];
    skillSpotlight: {
        demonstrated: string;
        toDevelop: string;
    };
    conversationBalance: string;
}

interface ConversationAnalysis {
    engagementLevel: string;
    rapportQuality: string;
    keyMoments: string[];
    riskFactors: string[];
}

interface PssCoachingPanelProps {
    coaching: PssCoaching | null;
    analysis: ConversationAnalysis | null;
}

export default function PssCoachingPanel({ coaching, analysis }: PssCoachingPanelProps) {
    if (!coaching && !analysis) {
        return (
            <div className="text-center py-12 text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>PSS Coaching insights will appear here after generating notes.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold text-[#0E2235]">PSS Coaching Insights</h3>
                    <p className="text-sm text-gray-500">AI-powered feedback to support your growth</p>
                </div>
            </div>

            {coaching && (
                <>
                    {/* What Went Well */}
                    <div className="bg-green-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <ThumbsUp className="w-5 h-5 text-green-600" />
                            <h4 className="font-semibold text-green-800">What Went Well</h4>
                        </div>
                        <ul className="space-y-2">
                            {coaching.whatWentWell.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Growth Opportunities */}
                    <div className="bg-amber-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-5 h-5 text-amber-600" />
                            <h4 className="font-semibold text-amber-800">Growth Opportunities</h4>
                        </div>
                        <ul className="space-y-2">
                            {coaching.growthOpportunities.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Suggested Follow-Up Actions */}
                    <div className="bg-blue-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Target className="w-5 h-5 text-blue-600" />
                            <h4 className="font-semibold text-blue-800">Suggested Follow-Up Actions</h4>
                        </div>
                        <ul className="space-y-2">
                            {coaching.suggestedFollowUpActions.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                                    <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Skill Spotlight */}
                    <div className="bg-purple-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Award className="w-5 h-5 text-purple-600" />
                            <h4 className="font-semibold text-purple-800">Skill Spotlight</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3">
                                <div className="text-xs uppercase tracking-wide text-purple-500 mb-1">Strength Demonstrated</div>
                                <p className="text-sm text-purple-800">{coaching.skillSpotlight.demonstrated}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3">
                                <div className="text-xs uppercase tracking-wide text-purple-500 mb-1">Area to Develop</div>
                                <p className="text-sm text-purple-800">{coaching.skillSpotlight.toDevelop}</p>
                            </div>
                        </div>
                    </div>

                    {/* Conversation Balance */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="w-5 h-5 text-gray-600" />
                            <h4 className="font-semibold text-gray-800">Conversation Balance</h4>
                        </div>
                        <p className="text-sm text-gray-600">{coaching.conversationBalance}</p>
                    </div>
                </>
            )}

            {analysis && (
                <>
                    {/* Divider */}
                    <div className="border-t border-gray-200 pt-4">
                        <h3 className="font-semibold text-[#0E2235] mb-4">Session Analysis</h3>
                    </div>

                    {/* Analysis Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Engagement Level</div>
                            <p className="text-sm text-[#0E2235] font-medium">{analysis.engagementLevel}</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Rapport Quality</div>
                            <p className="text-sm text-[#0E2235] font-medium">{analysis.rapportQuality}</p>
                        </div>
                    </div>

                    {/* Key Moments */}
                    {analysis.keyMoments && analysis.keyMoments.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Key Moments</div>
                            <ul className="space-y-2">
                                {analysis.keyMoments.map((moment, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                        <span className="w-5 h-5 rounded-full bg-[#1A73A8]/10 text-[#1A73A8] flex items-center justify-center text-xs flex-shrink-0">
                                            {i + 1}
                                        </span>
                                        <span>{moment}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Risk Factors */}
                    {analysis.riskFactors && analysis.riskFactors.length > 0 && (
                        <div className="bg-red-50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <h4 className="font-semibold text-red-800">Items to Monitor</h4>
                            </div>
                            <ul className="space-y-2">
                                {analysis.riskFactors.map((item, i) => (
                                    <li key={i} className="text-sm text-red-700">• {item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

            {/* Disclaimer */}
            <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100">
                These insights are AI-generated suggestions to support your professional development. 
                Always use your professional judgment and consult with your supervisor.
            </div>
        </div>
    );
}
