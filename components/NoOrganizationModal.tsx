'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, ArrowRight, Sparkles, X } from 'lucide-react';

interface NoOrganizationModalProps {
    isOpen: boolean;
    userName?: string;
}

export default function NoOrganizationModal({ isOpen, userName }: NoOrganizationModalProps) {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(isOpen);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 px-6 py-8 text-center relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Welcome{userName ? `, ${userName}` : ''}! 🎉
                        </h2>
                        <p className="text-purple-100">
                            One more step to get started
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 text-center mb-6">
                        You need to be part of an organization to use Peer Support Studio. 
                        Create your own or join an existing one.
                    </p>

                    {/* Options */}
                    <div className="space-y-3">
                        <button
                            onClick={() => router.push('/onboarding')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                <Building2 className="w-6 h-6 text-purple-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">Create Organization</p>
                                <p className="text-sm text-gray-500">Start fresh as an admin</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                            onClick={() => router.push('/onboarding')}
                            className="w-full flex items-center gap-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">Join with Invite Code</p>
                                <p className="text-sm text-gray-500">Your admin shared a code</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    {/* Footer note */}
                    <p className="text-xs text-gray-400 text-center mt-6">
                        Organizations keep your data secure and let you collaborate with your team.
                    </p>
                </div>
            </div>
        </div>
    );
}
