'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, ChevronRight, Loader2, Copy, CheckCircle, RefreshCw, Tablet } from 'lucide-react';

interface Kiosk {
    id: string;
    token: string;
    label: string;
    active: boolean;
    last_used_at: string | null;
}

export default function KioskSettingsPage() {
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const role = (session as any)?.currentOrganization?.role || '';
    const canManage = role === 'admin' || role === 'owner';

    const [kiosk, setKiosk] = useState<Kiosk | null>(null);
    const [loading, setLoading] = useState(true);
    const [origin, setOrigin] = useState('');
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') setOrigin(window.location.origin);
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/org-kiosks');
            const data = await res.json();
            if (res.ok) setKiosk((data.kiosks || [])[0] || null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
            return;
        }
        if (authStatus === 'authenticated') load();
    }, [authStatus, load]);

    const url = kiosk ? `${origin}/kiosk/${kiosk.token}` : '';

    const copy = async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const rotate = async () => {
        if (!kiosk) return;
        if (!confirm('Rotate the kiosk link? The current URL/QR will stop working immediately and any tablet must be re-opened with the new link.')) return;
        setBusy(true);
        try {
            const res = await fetch('/api/org-kiosks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rotate', kioskId: kiosk.id }),
            });
            const data = await res.json();
            if (res.ok) setKiosk((k) => (k ? { ...k, token: data.kiosk.token } : k));
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async () => {
        if (!kiosk) return;
        setBusy(true);
        try {
            const res = await fetch('/api/org-kiosks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_active', kioskId: kiosk.id, active: !kiosk.active }),
            });
            const data = await res.json();
            if (res.ok) setKiosk((k) => (k ? { ...k, active: data.kiosk.active } : k));
        } finally {
            setBusy(false);
        }
    };

    if (authStatus === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    if (!canManage) {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center p-8 text-center">
                <p className="text-gray-500">Only organization admins can manage the kiosk.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <nav className="flex items-center gap-2 text-sm">
                        <button onClick={() => router.push('/')} className="text-[#1A73A8] hover:underline">
                            Dashboard
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 font-medium">Kiosk</span>
                    </nav>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#0E2235] flex items-center gap-2">
                        <Tablet className="w-6 h-6 text-[#1A73A8]" />
                        Self-Service Kiosk
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Open this link on a tablet at your front desk so participants can check into today's groups.
                    </p>
                </div>

                {!kiosk ? (
                    <div className="bg-white rounded-2xl border border-[#E7E9EC] p-8 text-center text-gray-500">
                        No kiosk configured.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-[#E7E9EC] p-8">
                        <div className="flex flex-col sm:flex-row gap-8 items-center">
                            <div className="bg-white p-3 rounded-xl border border-gray-100">
                                {url && <QRCodeSVG value={url} size={180} />}
                            </div>
                            <div className="flex-1 w-full">
                                <div className="flex items-center gap-2 mb-3">
                                    <span
                                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                                            kiosk.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                        }`}
                                    >
                                        {kiosk.active ? 'Active' : 'Disabled'}
                                    </span>
                                    {kiosk.last_used_at && (
                                        <span className="text-xs text-gray-400">
                                            Last used {new Date(kiosk.last_used_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>

                                <label className="block text-sm font-medium text-gray-700 mb-1">Kiosk link</label>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        readOnly
                                        value={url}
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                    />
                                    <button
                                        onClick={copy}
                                        className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#155d8a] flex items-center gap-2 text-sm"
                                    >
                                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={toggleActive}
                                        disabled={busy}
                                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {kiosk.active ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                        onClick={rotate}
                                        disabled={busy}
                                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Rotate link
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-500 space-y-2">
                            <p className="font-medium text-gray-700">Setup</p>
                            <p>1. Open the link (or scan the QR) on the tablet you'll use at the front desk.</p>
                            <p>2. Turn on iOS <strong>Guided Access</strong> (Settings → Accessibility) so the tablet stays locked to this page.</p>
                            <p>3. Participants check in with their name &amp; birthdate, or the personal code shown on their record.</p>
                            <p className="text-amber-600">
                                Treat this link like a password — anyone with it can reach your check-in screen. Rotate it if a device is lost.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
