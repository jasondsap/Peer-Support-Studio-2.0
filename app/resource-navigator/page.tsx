'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';  // CHANGED: from useAuth
import {
    Search, MapPin, Phone, Globe, Navigation, Building2,
    Loader2, ArrowLeft, Filter, ChevronDown, ChevronUp,
    Heart, Brain, ExternalLink, Clock, AlertCircle, CheckCircle2,
    Sparkles, Info, LocateFixed
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

    useEffect(() => {
        // CHANGED: auth check for NextAuth
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

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
