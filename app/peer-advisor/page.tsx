// app/peer-advisor/page.tsx
// Peer Advisor Module — RAG-powered evidence-based chat
// Replaces previous Hume voice integration

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import PeerAdvisorChat from '@/app/components/PeerAdvisorChat';

export default function PeerAdvisorPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <div className="w-8 h-8 border-4 border-[#30B27A] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) return null;

    // Extract first name for greeting
    const userName = session.user?.name?.split(' ')[0] || '';

    return (
        <div className="h-[calc(100vh-64px)]">
            <PeerAdvisorChat userName={userName} />
        </div>
    );
}
