'use client';

import { useState } from 'react';
import { Users, Check, ChevronDown, Mic, User, UserCircle } from 'lucide-react';

interface Speaker {
    id: string;
    label: string;
    talkTimePercent: number;
    wordCount: number;
    utteranceCount: number;
}

interface SpeakerAssignmentProps {
    speakers: Speaker[];
    onMappingChange: (mapping: { [key: string]: string }) => void;
    sessionType?: 'individual' | 'group' | 'check-in' | 'crisis';
}

const ROLE_PRESETS = [
    { value: 'PSS', label: 'Peer Support Specialist', icon: Mic },
    { value: 'Participant', label: 'Participant', icon: User },
    { value: 'Participant 2', label: 'Participant 2', icon: User },
    { value: 'Participant 3', label: 'Participant 3', icon: User },
    { value: 'Supervisor', label: 'Supervisor', icon: UserCircle },
    { value: 'Family Member', label: 'Family Member', icon: Users },
    { value: 'Other', label: 'Other', icon: User },
];

export default function SpeakerAssignment({ 
    speakers, 
    onMappingChange,
    sessionType = 'individual'
}: SpeakerAssignmentProps) {
    const [mapping, setMapping] = useState<{ [key: string]: string }>(() => {
        // Auto-assign defaults based on session type and talk time
        const initial: { [key: string]: string } = {};
        
        if (speakers.length >= 2) {
            // Sort by talk time - PSS typically talks less in good peer support
            const sorted = [...speakers].sort((a, b) => a.talkTimePercent - b.talkTimePercent);
            
            if (sessionType === 'individual' || sessionType === 'check-in' || sessionType === 'crisis') {
                // In individual sessions, the one talking less is likely the PSS
                initial[sorted[0].id] = 'PSS';
                initial[sorted[1].id] = 'Participant';
            } else {
                // Group session - assign PSS to least talker, others as participants
                initial[sorted[0].id] = 'PSS';
                sorted.slice(1).forEach((s, i) => {
                    initial[s.id] = i === 0 ? 'Participant' : `Participant ${i + 1}`;
                });
            }
        } else if (speakers.length === 1) {
            initial[speakers[0].id] = 'PSS';
        }
        
        return initial;
    });

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const handleRoleChange = (speakerId: string, role: string) => {
        const newMapping = { ...mapping, [speakerId]: role };
        setMapping(newMapping);
        onMappingChange(newMapping);
        setOpenDropdown(null);
    };

    const formatTime = (percent: number, totalWords: number) => {
        return `${percent}% of conversation • ${totalWords} words`;
    };

    if (speakers.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#1A73A8]" />
                <h3 className="font-semibold text-[#0E2235]">Identify Speakers</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
                We detected {speakers.length} speaker{speakers.length > 1 ? 's' : ''} in your recording. 
                Assign roles to improve note accuracy.
            </p>

            <div className="space-y-3">
                {speakers.map((speaker) => (
                    <div 
                        key={speaker.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                                mapping[speaker.id] === 'PSS' 
                                    ? 'bg-[#1A73A8]' 
                                    : 'bg-[#30B27A]'
                            }`}>
                                {speaker.id}
                            </div>
                            <div>
                                <div className="font-medium text-[#0E2235]">
                                    Speaker {speaker.id}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {formatTime(speaker.talkTimePercent, speaker.wordCount)}
                                </div>
                            </div>
                        </div>

                        {/* Role Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenDropdown(openDropdown === speaker.id ? null : speaker.id)}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-[#1A73A8] transition-colors min-w-[160px] justify-between"
                            >
                                <span className={`font-medium ${
                                    mapping[speaker.id] === 'PSS' ? 'text-[#1A73A8]' : 'text-[#30B27A]'
                                }`}>
                                    {mapping[speaker.id] || 'Select role'}
                                </span>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>

                            {openDropdown === speaker.id && (
                                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                    {ROLE_PRESETS.map((role) => {
                                        const Icon = role.icon;
                                        const isSelected = mapping[speaker.id] === role.value;
                                        return (
                                            <button
                                                key={role.value}
                                                onClick={() => handleRoleChange(speaker.id, role.value)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                                                    isSelected ? 'bg-blue-50' : ''
                                                }`}
                                            >
                                                <Icon className={`w-4 h-4 ${
                                                    isSelected ? 'text-[#1A73A8]' : 'text-gray-400'
                                                }`} />
                                                <span className={`flex-1 ${
                                                    isSelected ? 'text-[#1A73A8] font-medium' : 'text-gray-700'
                                                }`}>
                                                    {role.label}
                                                </span>
                                                {isSelected && (
                                                    <Check className="w-4 h-4 text-[#1A73A8]" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Talk Time Insight */}
            {speakers.length >= 2 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>💡 Tip:</strong> In effective peer support, the participant typically talks more than the PSS. 
                        {speakers.find(s => mapping[s.id] === 'PSS')?.talkTimePercent || 0 > 50 
                            ? " Consider if talk-time balance reflects your session goals."
                            : " Great job creating space for the participant to share!"
                        }
                    </p>
                </div>
            )}
        </div>
    );
}
