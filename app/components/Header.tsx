'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { 
    Menu, X, User, LogOut, Settings, 
    LayoutDashboard, Users, Sparkles 
} from 'lucide-react';

export default function Header() {
    const { data: session, status } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const isLoading = status === 'loading';

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-gray-900 hidden sm:block">
                            Continuum Care Studio
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    {session && (
                        <nav className="hidden md:flex items-center gap-6">
                            <Link 
                                href="/dashboard" 
                                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link 
                                href="/participants" 
                                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
                            >
                                <Users className="w-4 h-4" />
                                Participants
                            </Link>
                        </nav>
                    )}

                    {/* Right side */}
                    <div className="flex items-center gap-4">
                        {isLoading ? (
                            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                        ) : session ? (
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100"
                                >
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                        <User className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <span className="hidden sm:block text-sm text-gray-700">
                                        {session.user?.name || session.user?.email?.split('@')[0]}
                                    </span>
                                </button>

                                {/* User dropdown */}
                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <p className="text-sm font-medium text-gray-900">
                                                {session.user?.name || 'User'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {session.user?.email}
                                            </p>
                                        </div>
                                        <Link
                                            href="/settings"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                            onClick={() => setUserMenuOpen(false)}
                                        >
                                            <Settings className="w-4 h-4" />
                                            Settings
                                        </Link>
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/' })}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => signIn('cognito')}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                            >
                                Sign In
                            </button>
                        )}

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                        >
                            {mobileMenuOpen ? (
                                <X className="w-5 h-5" />
                            ) : (
                                <Menu className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && session && (
                    <div className="md:hidden py-4 border-t border-gray-200">
                        <nav className="flex flex-col gap-2">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link
                                href="/participants"
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <Users className="w-4 h-4" />
                                Participants
                            </Link>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}
