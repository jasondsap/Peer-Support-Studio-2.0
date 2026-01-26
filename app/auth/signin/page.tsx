'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Loader2, Shield, Users, Target, FileText } from 'lucide-react';

function SignInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const error = searchParams.get('error');
    
    useEffect(() => {
        if (session) {
            router.push(callbackUrl);
        }
    }, [session, router, callbackUrl]);
    
    const handleSignIn = async () => {
        setIsLoading(true);
        await signIn('cognito', { callbackUrl });
    };
    
    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex">
            {/* Left Side - Form */}
            <div className="flex-1 flex items-center justify-center px-8 py-12">
                <div className="max-w-md w-full">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1A73A8] to-[#30B27A] flex items-center justify-center mx-auto mb-4">
                            <span className="text-white font-bold text-2xl">PS</span>
                        </div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">Welcome to Peer Support Studio</h1>
                        <p className="text-gray-600 mt-2">Sign in to manage your peer support documentation</p>
                    </div>
                    
                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error === 'OAuthSignin' && 'Error starting sign in process.'}
                            {error === 'OAuthCallback' && 'Error during sign in callback.'}
                            {error === 'OAuthCreateAccount' && 'Error creating account.'}
                            {error === 'Callback' && 'Error during callback.'}
                            {error === 'AccessDenied' && 'Access denied.'}
                            {error === 'Configuration' && 'Server configuration error.'}
                            {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'Callback', 'AccessDenied', 'Configuration'].includes(error) && 'An error occurred during sign in.'}
                        </div>
                    )}
                    
                    {/* Sign In Button */}
                    <button
                        onClick={handleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#1A73A8] text-white rounded-xl hover:bg-[#156090] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                                </svg>
                                Sign in with SSO
                            </>
                        )}
                    </button>
                    
                    {/* Divider */}
                    <div className="my-8 flex items-center gap-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-sm text-gray-500">Secure Authentication</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    
                    {/* HIPAA Badge */}
                    <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 rounded-lg py-3">
                        <Shield className="w-5 h-5" />
                        <span className="font-medium">HIPAA Compliant Platform</span>
                    </div>
                    
                    {/* Footer Links */}
                    <div className="mt-8 text-center text-sm text-gray-500">
                        <p>
                            By signing in, you agree to our{' '}
                            <a href="/terms" className="text-[#1A73A8] hover:underline">Terms of Service</a>
                            {' '}and{' '}
                            <a href="/privacy" className="text-[#1A73A8] hover:underline">Privacy Policy</a>
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Right Side - Features */}
            <div className="hidden lg:flex flex-1 bg-gradient-to-br from-[#1A73A8] to-[#30B27A] items-center justify-center px-12">
                <div className="max-w-md text-white">
                    <h2 className="text-3xl font-bold mb-8">
                        Everything you need for peer support documentation
                    </h2>
                    
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Participant Management</h3>
                                <p className="text-white/80">Track and manage all the individuals you support in one secure place.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Target className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Recovery Goals</h3>
                                <p className="text-white/80">Create SMART goals and track progress with AI-powered assistance.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Session Documentation</h3>
                                <p className="text-white/80">Generate professional session notes from audio or text with AI.</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">HIPAA Compliant</h3>
                                <p className="text-white/80">All data encrypted at rest and in transit with full audit logging.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        }>
            <SignInContent />
        </Suspense>
    );
}
