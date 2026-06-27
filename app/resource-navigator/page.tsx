'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';  // CHANGED: from useAuth
import {
    Search, MapPin, Phone, Globe, Navigation, Building2,
    Loader2, ArrowLeft, Filter, ChevronDown, ChevronUp,
    Heart, Brain, ExternalLink, Clock, AlertCircle, CheckCircle2,
    Sparkles, Info, LocateFixed, UserPlus, X, Check, ClipboardList
} from 'lucide-react';

interface Facility {
    id: string;
    name: string;
    program: string | null;
    category: string;
    subcategory: string;
    description: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    website: string | null;
    distance: number;
    latitude: string;
    longitude: string;
    services: string[];
}

export default function ResourceNavigator() {
    const router = useRouter();
    const { data: session, status } = useSession();  // CHANGED: from useAuth

    // Search state
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Filter state
    const [serviceType, setServiceType] = useState('all');
    const [zipCode, setZipCode] = useState('');
    const [searchRadius, setSearchRadius] = useState(50);

    // UI state
    const [expandedFacility, setExpandedFacility] = useState<string | null>(null);
    const [searchInfo, setSearchInfo] = useState({ location: '', count: 0 });
    const [isGeolocating, setIsGeolocating] = useState(false);
    const [geoError, setGeoError] = useState<string | null>(null);

    // ── Referral state ──
    const currentOrg = (session as any)?.currentOrganization as { id: string; name: string } | null;
    const [participants, setParticipants] = useState<{ id: string; first_name: string; last_name: string; preferred_name?: string | null }[]>([]);
    const [referFor, setReferFor] = useState<string | null>(null); // facility.id currently being referred
    const [participantSearch, setParticipantSearch] = useState('');
    const [referLoading, setReferLoading] = useState(false);
    const [referError, setReferError] = useState<string | null>(null);
    const [referredFacilities, setReferredFacilities] = useState<Record<string, string>>({}); // facility.id -> participant name

    useEffect(() => {
        // CHANGED: auth check for NextAuth
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // Load this user's participants for the referral picker (their caseload first).
    useEffect(() => {
        if (!currentOrg?.id) return;
        (async () => {
            try {
                const res = await fetch(`/api/participants?organization_id=${currentOrg.id}&pss_filter=mine`);
                const data = await res.json();
                if (data.participants) setParticipants(data.participants);
            } catch (e) {
                console.error('Failed to load participants:', e);
            }
        })();
    }, [currentOrg?.id]);

    const openRefer = (facilityId: string) => {
        setReferError(null);
        setParticipantSearch('');
        setReferFor(prev => (prev === facilityId ? null : facilityId));
    };

    const handleRefer = async (facility: Facility, participant: { id: string; first_name: string; last_name: string; preferred_name?: string | null }) => {
        if (!currentOrg?.id) { setReferError('No organization selected.'); return; }
        setReferLoading(true);
        setReferError(null);
        try {
            const res = await fetch('/api/referrals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_id: currentOrg.id,
                    participant_id: participant.id,
                    referred_to: facility.name,
                    referral_type: 'treatment',
                    contact_info: {
                        phone: facility.phone || null,
                        website: facility.website || null,
                        address: [facility.address, facility.city, facility.state, facility.zip].filter(Boolean).join(', '),
                    },
                    reason: facility.program || facility.category || null,
                    source: facility,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                setReferError(d.error || 'Could not create referral.');
                return;
            }
            const name = `${participant.preferred_name || participant.first_name} ${participant.last_name}`;
            setReferredFacilities(prev => ({ ...prev, [facility.id]: name }));
            setReferFor(null);
        } catch (e) {
            console.error('Referral error:', e);
            setReferError('Could not create referral. Please try again.');
        } finally {
            setReferLoading(false);
        }
    };

    const filteredParticipants = participants.filter(p => {
        const name = `${p.first_name} ${p.last_name} ${p.preferred_name || ''}`.toLowerCase();
        return name.includes(participantSearch.toLowerCase());
    });

    const handleSearch = async () => {
        if (!zipCode.trim()) {
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        setGeoError(null);

        try {
            const params = new URLSearchParams({
                type: serviceType,
                radius: searchRadius.toString(),
                zip: zipCode.trim(),
            });

            const response = await fetch(`/api/resource-search?${params}`);
            const data = await response.json();

            if (data.error) {
                setGeoError(data.error);
                setFacilities([]);
            } else {
                setFacilities(data.facilities || []);
                setSearchInfo({
                    location: data.location || zipCode,
                    count: data.count || 0
                });
            }
        } catch (error) {
            console.error('Search error:', error);
            setFacilities([]);
            setGeoError('Failed to search. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            setGeoError('Geolocation is not supported by your browser');
            return;
        }

        setIsGeolocating(true);
        setGeoError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    
                    setIsLoading(true);
                    setHasSearched(true);

                    const params = new URLSearchParams({
                        type: serviceType,
                        radius: searchRadius.toString(),
                        lat: latitude.toString(),
                        lng: longitude.toString(),
                    });

                    const response = await fetch(`/api/resource-search?${params}`);
                    const data = await response.json();

                    setFacilities(data.facilities || []);
                    setSearchInfo({
                        location: data.location || 'Your Location',
                        count: data.count || 0
                    });
                } catch (error) {
                    console.error('Location search error:', error);
                    setGeoError('Failed to search your location');
                } finally {
                    setIsLoading(false);
                    setIsGeolocating(false);
                }
            },
            (error) => {
                setIsGeolocating(false);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setGeoError('Location permission denied. Please enter a ZIP code instead.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setGeoError('Location unavailable. Please enter a ZIP code instead.');
                        break;
                    case error.TIMEOUT:
                        setGeoError('Location request timed out. Please enter a ZIP code instead.');
                        break;
                    default:
                        setGeoError('Unable to get location. Please enter a ZIP code instead.');
                }
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    };

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    const getCategoryIcon = (category: string) => {
        if (category === 'Mental Health') {
            return <Brain className="w-5 h-5 text-purple-600" />;
        }
        return <Heart className="w-5 h-5 text-rose-600" />;
    };

    const getCategoryColor = (category: string) => {
        if (category === 'Mental Health') {
            return 'bg-purple-100 text-purple-700 border-purple-200';
        }
        return 'bg-rose-100 text-rose-700 border-rose-200';
    };

    // CHANGED: loading check for NextAuth
    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-[#E8F4F8] to-[#E0F2F1]">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9B59B6] to-[#8E44AD] flex items-center justify-center shadow-lg">
                                    <Search className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-[#0E2235]">Treatment Locator</h1>
                                    <p className="text-xs text-gray-500">Powered by SAMHSA</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/referrals')}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            <ClipboardList className="w-4 h-4" />
                            Manage Referrals
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Intro Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9B59B6] to-[#8E44AD] flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[#0E2235] mb-1">
                                Find Treatment Facilities
                            </h2>
                            <p className="text-gray-600 text-sm">
                                Search SAMHSA's national database of verified treatment facilities for mental health 
                                and substance use services. All facilities are licensed and regularly updated.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search Controls */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                    <div className="space-y-4">
                        {/* Service Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Service Type
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setServiceType('all')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                        serviceType === 'all'
                                            ? 'bg-[#9B59B6] text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    All Services
                                </button>
                                <button
                                    onClick={() => setServiceType('mental-health')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                        serviceType === 'mental-health'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <Brain className="w-4 h-4" />
                                    Mental Health
                                </button>
                                <button
                                    onClick={() => setServiceType('substance-use')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                                        serviceType === 'substance-use'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    <Heart className="w-4 h-4" />
                                    Substance Use
                                </button>
                            </div>
                        </div>

                        {/* Location - ZIP Code */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location
                            </label>
                            <div className="flex gap-3 flex-wrap">
                                <div className="flex-1 min-w-[200px]">
                                    <input
                                        type="text"
                                        value={zipCode}
                                        onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && zipCode.length === 5) {
                                                handleSearch();
                                            }
                                        }}
                                        placeholder="Enter 5-digit ZIP code"
                                        maxLength={5}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#9B59B6] focus:border-transparent text-lg tracking-wider"
                                    />
                                </div>
                                <span className="text-gray-400 self-center">or</span>
                                <button
                                    onClick={handleUseMyLocation}
                                    disabled={isGeolocating}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isGeolocating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <LocateFixed className="w-4 h-4" />
                                    )}
                                    Use My Location
                                </button>
                            </div>
                            {geoError && (
                                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    {geoError}
                                </p>
                            )}
                        </div>

                        {/* Radius */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Search Radius
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {[10, 25, 50, 100].map((miles) => (
                                    <button
                                        key={miles}
                                        onClick={() => setSearchRadius(miles)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            searchRadius === miles
                                                ? 'bg-[#1A73A8] text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {miles} miles
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Button */}
                        <button
                            onClick={handleSearch}
                            disabled={isLoading || zipCode.length !== 5}
                            className="w-full py-3 bg-gradient-to-r from-[#9B59B6] to-[#8E44AD] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Searching SAMHSA...
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5" />
                                    Find Treatment Facilities
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Results */}
                {hasSearched && (
                    <div className="space-y-4">
                        {/* Results Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-[#0E2235]">
                                    {searchInfo.count} Facilities Found
                                </h3>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                    near {searchInfo.location}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                SAMHSA Verified
                            </div>
                        </div>

                        {/* No Results */}
                        {facilities.length === 0 && !isLoading && (
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                    No facilities found
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    Try expanding your search radius or trying a different ZIP code.
                                </p>
                                <button
                                    onClick={() => {
                                        setSearchRadius(100);
                                        handleSearch();
                                    }}
                                    className="px-4 py-2 bg-[#9B59B6] text-white rounded-lg hover:bg-[#8E44AD] transition-colors"
                                >
                                    Search 100 mile radius
                                </button>
                            </div>
                        )}

                        {/* Facility Cards */}
                        {facilities.map((facility) => (
                            <div
                                key={facility.id}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                {getCategoryIcon(facility.category)}
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(facility.category)}`}>
                                                    {facility.category}
                                                </span>
                                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Navigation className="w-3 h-3" />
                                                    {facility.distance} mi
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-[#0E2235] mb-1">
                                                {facility.name}
                                            </h3>
                                            {facility.program && (
                                                <p className="text-sm text-gray-600 mb-2">{facility.program}</p>
                                            )}
                                            <p className="text-sm text-gray-500 mb-3">
                                                {facility.description}
                                            </p>
                                            
                                            {/* Contact Info */}
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                <a
                                                    href={`tel:${facility.phone}`}
                                                    className="flex items-center gap-2 text-[#1A73A8] hover:underline"
                                                >
                                                    <Phone className="w-4 h-4" />
                                                    {formatPhone(facility.phone)}
                                                </a>
                                                <span className="flex items-center gap-2 text-gray-600">
                                                    <MapPin className="w-4 h-4" />
                                                    {facility.city}, {facility.state} {facility.zip}
                                                </span>
                                                {facility.website && (
                                                    <a
                                                        href={facility.website.startsWith('http') ? facility.website : `https://${facility.website}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-[#1A73A8] hover:underline"
                                                    >
                                                        <Globe className="w-4 h-4" />
                                                        Website
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>

                                            {/* ── Refer a participant ── */}
                                            <div className="mt-4">
                                                {referredFacilities[facility.id] ? (
                                                    <div className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                                                        <Check className="w-4 h-4" />
                                                        Referred {referredFacilities[facility.id]} here
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => openRefer(facility.id)}
                                                        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-[#1A73A8] text-[#1A73A8] hover:bg-blue-50 transition-colors"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                        Refer a participant
                                                    </button>
                                                )}

                                                {referFor === facility.id && (
                                                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium text-gray-700">
                                                                Refer to {facility.name}
                                                            </span>
                                                            <button
                                                                onClick={() => setReferFor(null)}
                                                                className="p-1 hover:bg-gray-200 rounded"
                                                            >
                                                                <X className="w-4 h-4 text-gray-500" />
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={participantSearch}
                                                            onChange={(e) => setParticipantSearch(e.target.value)}
                                                            placeholder="Search participants..."
                                                            autoFocus
                                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent mb-2"
                                                        />
                                                        {referError && (
                                                            <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" /> {referError}
                                                            </p>
                                                        )}
                                                        <div className="max-h-48 overflow-y-auto space-y-1">
                                                            {filteredParticipants.length === 0 ? (
                                                                <p className="text-xs text-gray-400 py-2 text-center">
                                                                    {participants.length === 0 ? 'No participants found for your caseload.' : 'No matches.'}
                                                                </p>
                                                            ) : (
                                                                filteredParticipants.map((p) => (
                                                                    <button
                                                                        key={p.id}
                                                                        disabled={referLoading}
                                                                        onClick={() => handleRefer(facility, p)}
                                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-sm text-gray-700 flex items-center justify-between disabled:opacity-50"
                                                                    >
                                                                        <span>
                                                                            {p.preferred_name || p.first_name} {p.last_name}
                                                                        </span>
                                                                        {referLoading ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                                        ) : (
                                                                            <UserPlus className="w-4 h-4 text-[#1A73A8]" />
                                                                        )}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setExpandedFacility(
                                                expandedFacility === facility.id ? null : facility.id
                                            )}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                        >
                                            {expandedFacility === facility.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-600" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-600" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedFacility === facility.id && (
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                {/* Full Address */}
                                                <div>
                                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Full Address</h4>
                                                    <p className="text-sm text-gray-600">
                                                        {facility.address}<br />
                                                        {facility.city}, {facility.state} {facility.zip}
                                                    </p>
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                                            `${facility.address}, ${facility.city}, ${facility.state} ${facility.zip}`
                                                        )}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-[#1A73A8] hover:underline mt-2"
                                                    >
                                                        <MapPin className="w-3 h-3" />
                                                        Get Directions
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>

                                                {/* Services */}
                                                {facility.services.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Services Offered</h4>
                                                        <div className="flex flex-wrap gap-1">
                                                            {facility.services.slice(0, 6).map((service, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                                                >
                                                                    {service}
                                                                </span>
                                                            ))}
                                                            {facility.services.length > 6 && (
                                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                                                                    +{facility.services.length - 6} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* SAMHSA Info Footer */}
                <div className="mt-8 p-4 bg-white/50 rounded-xl border border-gray-200">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-gray-500">
                            <p className="mb-1">
                                <strong>About SAMHSA:</strong> The Substance Abuse and Mental Health Services Administration 
                                maintains a national database of treatment facilities that provide mental health and 
                                substance use services.
                            </p>
                            <p>
                                Data is updated regularly. Always call ahead to verify services, hours, and availability.
                                For immediate help, call the SAMHSA National Helpline: <strong>1-800-662-4357</strong> (free, 24/7).
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
