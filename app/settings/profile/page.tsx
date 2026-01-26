'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    ArrowLeft, User, Mail, Phone, Save, Loader2,
    Key, Link2, Trash2, AlertTriangle, Check,
    Shield, Eye, EyeOff
} from 'lucide-react';

interface UserProfile {
    id: string;
    email: string;
    display_name: string;
    phone: string | null;
}

export default function ProfileSettingsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    // Profile state
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Password change state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // Delete account state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Auth check
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // Fetch profile on mount
    useEffect(() => {
        if (status === 'authenticated') {
            fetchProfile();
        }
    }, [status]);

    const fetchProfile = async () => {
        setIsLoadingProfile(true);
        try {
            const response = await fetch('/api/user/profile');
            if (response.ok) {
                const data = await response.json();
                setProfile(data.profile);
                setDisplayName(data.profile.display_name || '');
                setPhone(data.profile.phone || '');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setProfileError('Failed to load profile');
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        setProfileError(null);
        setProfileSaved(false);

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_name: displayName,
                    phone: phone || null,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save profile');
            }

            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
        } catch (error: any) {
            setProfileError(error.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        setPasswordError(null);
        setPasswordSuccess(false);

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All fields are required');
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        setIsChangingPassword(true);

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to change password');
            }

            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordForm(false);
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (error: any) {
            setPasswordError(error.message);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            return;
        }

        setIsDeleting(true);

        try {
            const response = await fetch('/api/user/delete-account', {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete account');
            }

            // Sign out and redirect to home
            await signOut({ callbackUrl: '/' });
        } catch (error: any) {
            console.error('Error deleting account:', error);
            setIsDeleting(false);
        }
    };

    const formatPhone = (value: string) => {
        // Remove non-digits
        const digits = value.replace(/\D/g, '');
        
        // Format as (XXX) XXX-XXXX
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    };

    if (status === 'loading' || isLoadingProfile) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>
                        <h1 className="text-xl font-bold text-[#0E2235]">My Profile</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                {/* User Profile Section */}
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-[#1A73A8] to-[#30B27A] p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Profile Information</h2>
                                <p className="text-white/80 text-sm">Manage your personal details</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Display Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <User className="w-4 h-4 inline mr-1" />
                                Display Name
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your name"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            />
                        </div>

                        {/* Email (read-only) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Mail className="w-4 h-4 inline mr-1" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={session?.user?.email || ''}
                                disabled
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Phone className="w-4 h-4 inline mr-1" />
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(formatPhone(e.target.value))}
                                placeholder="(555) 555-5555"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                            />
                        </div>

                        {/* Error/Success Messages */}
                        {profileError && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {profileError}
                            </div>
                        )}

                        {profileSaved && (
                            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                Profile saved successfully!
                            </div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            className="w-full py-2.5 bg-[#1A73A8] text-white rounded-lg hover:bg-[#155a8a] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSavingProfile ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Profile
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Account Management Section */}
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[#0E2235]">Account Management</h2>
                                <p className="text-gray-500 text-sm">Security and account settings</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Change Password */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setShowPasswordForm(!showPasswordForm)}
                                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Key className="w-5 h-5 text-gray-500" />
                                    <div className="text-left">
                                        <div className="font-medium text-[#0E2235]">Change Password</div>
                                        <div className="text-sm text-gray-500">Update your password</div>
                                    </div>
                                </div>
                                <div className={`transform transition-transform ${showPasswordForm ? 'rotate-180' : ''}`}>
                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {showPasswordForm && (
                                <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
                                    {/* Current Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Current Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* New Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent"
                                        />
                                    </div>

                                    {passwordError && (
                                        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            {passwordError}
                                        </div>
                                    )}

                                    {passwordSuccess && (
                                        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                                            <Check className="w-4 h-4" />
                                            Password changed successfully!
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowPasswordForm(false);
                                                setCurrentPassword('');
                                                setNewPassword('');
                                                setConfirmPassword('');
                                                setPasswordError(null);
                                            }}
                                            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleChangePassword}
                                            disabled={isChangingPassword}
                                            className="flex-1 py-2 bg-[#1A73A8] text-white rounded-lg hover:bg-[#155a8a] disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isChangingPassword ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Changing...
                                                </>
                                            ) : (
                                                'Change Password'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Connected Accounts */}
                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <Link2 className="w-5 h-5 text-gray-500" />
                                <div>
                                    <div className="font-medium text-[#0E2235]">Connected Accounts</div>
                                    <div className="text-sm text-gray-500">Manage linked services</div>
                                </div>
                            </div>
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
                                No connected accounts
                            </div>
                        </div>

                        {/* Delete Account */}
                        <div className="border border-red-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                                className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                    <div className="text-left">
                                        <div className="font-medium text-red-600">Delete Account</div>
                                        <div className="text-sm text-gray-500">Permanently delete your account and data</div>
                                    </div>
                                </div>
                            </button>

                            {showDeleteConfirm && (
                                <div className="p-4 border-t border-red-200 bg-red-50 space-y-4">
                                    <div className="flex items-start gap-3 p-3 bg-red-100 rounded-lg">
                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-red-800">
                                            <strong>Warning:</strong> This action cannot be undone. All your data, including 
                                            session notes, participants, and settings will be permanently deleted.
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Type <strong>DELETE</strong> to confirm
                                        </label>
                                        <input
                                            type="text"
                                            value={deleteConfirmText}
                                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                                            placeholder="DELETE"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowDeleteConfirm(false);
                                                setDeleteConfirmText('');
                                            }}
                                            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeleteAccount}
                                            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                            className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Deleting...
                                                </>
                                            ) : (
                                                'Delete Account'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
