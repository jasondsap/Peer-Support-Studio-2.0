'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';
import { 
    User, 
    Settings, 
    LogOut, 
    ChevronDown,
    Building2,
    Shield,
    HelpCircle
} from 'lucide-react';

export default function UserButton() {
    const { data: session, status } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);
    
    if (status === 'loading') {
        return (
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        );
    }
    
    if (!session) {
        return (
            <button
                onClick={() => signIn('cognito')}
                className="px-4 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#156090] transition-colors text-sm font-medium"
            >
                Sign In
            </button>
        );
    }
    
    const initials = session.user?.name
        ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
        : session.user?.email?.[0].toUpperCase() || 'U';
    
    return (
        <div className="relative">
            <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center text-white text-sm font-medium">
                    {initials}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform hidden sm:block ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {menuOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                        {/* User Info */}
                        <div className="px-4 py-3 border-b border-gray-100">
                            <p className="font-medium text-[#0E2235] truncate">
                                {session.user?.name || 'User'}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                                {session.user?.email}
                            </p>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="py-2">
                            <Link
                                href="/settings/profile"
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50"
                            >
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">My Profile</span>
                            </Link>
                            <Link
                                href="/settings/organization"
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50"
                            >
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Organization Settings</span>
                            </Link>
                            <Link
                                href="/settings/profile"
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50"
                            >
                                <Settings className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Settings</span>
                            </Link>
                        </div>
                        
                        <div className="border-t border-gray-100 py-2">
                            <Link
                                href="/help"
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50"
                            >
                                <HelpCircle className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">Help & Support</span>
                            </Link>
                            <div className="flex items-center gap-3 px-4 py-2 text-green-700">
                                <Shield className="w-4 h-4 text-green-500" />
                                <span className="text-sm">HIPAA Compliant</span>
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-100 pt-2">
                            <button
                                onClick={() => signOut({ callbackUrl: '/' })}
                                className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 w-full"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-sm">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
