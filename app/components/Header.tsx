'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { 
    Building2, 
    Users, 
    Target, 
    FileText, 
    LayoutDashboard,
    ChevronDown,
    Settings,
    Plus
} from 'lucide-react';
import UserButton from './UserButton';

export default function Header() {
    const { data: session, status } = useSession();
    const [orgMenuOpen, setOrgMenuOpen] = useState(false);
    
    const organizations = (session as any)?.organizations || [];
    const currentOrg = (session as any)?.currentOrganization;
    
    if (status === 'loading') {
        return (
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <div className="h-10 w-40 bg-gray-200 animate-pulse rounded" />
                </div>
            </header>
        );
    }
    
    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo & Org Switcher */}
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center">
                                <span className="text-white font-bold text-lg">PS</span>
                            </div>
                            <div className="hidden sm:block">
                                <h1 className="font-bold text-[#0E2235]">Peer Support Studio</h1>
                                {currentOrg && (
                                    <p className="text-xs text-gray-500">{currentOrg.name}</p>
                                )}
                            </div>
                        </Link>
                        
                        {/* Organization Switcher */}
                        {session && organizations.length > 0 && (
                            <div className="relative ml-4">
                                <button
                                    onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                                >
                                    <Building2 className="w-4 h-4 text-gray-500" />
                                    <span className="hidden md:inline text-gray-700 max-w-[150px] truncate">
                                        {currentOrg?.name || 'Select Organization'}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {orgMenuOpen && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setOrgMenuOpen(false)}
                                        />
                                        <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                                            <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                                                Your Organizations
                                            </div>
                                            {organizations.map((org: any) => (
                                                <button
                                                    key={org.id}
                                                    onClick={() => {
                                                        // TODO: Switch organization context
                                                        setOrgMenuOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 ${
                                                        currentOrg?.id === org.id ? 'bg-blue-50' : ''
                                                    }`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-xs font-bold">
                                                        {org.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-[#0E2235] truncate">{org.name}</p>
                                                        <p className="text-xs text-gray-500 capitalize">{org.role}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            <div className="border-t border-gray-100 mt-2 pt-2">
                                                <Link
                                                    href="/organizations/new"
                                                    onClick={() => setOrgMenuOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2 text-[#1A73A8] hover:bg-blue-50"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span className="text-sm font-medium">Create Organization</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Navigation */}
                    {session && currentOrg && (
                        <nav className="hidden md:flex items-center gap-1">
                            <Link
                                href="/"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-[#1A73A8] hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link
                                href="/participants"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-[#1A73A8] hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Users className="w-4 h-4" />
                                Participants
                            </Link>                      
                            <Link
                                href="/help"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-[#1A73A8] hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                Help
                            </Link>
                        </nav>
                    )}
                    
                    {/* User Menu */}
                    <UserButton />
                </div>
            </div>
        </header>
    );
}
