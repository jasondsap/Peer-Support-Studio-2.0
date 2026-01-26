import { NextRequest, NextResponse } from 'next/server';

interface SAMHSAFacility {
    name1: string;
    name2: string | null;
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    phone: string;
    website: string | null;
    latitude: string;
    longitude: string;
    miles: number;
    type_facility: string;
    services: Array<{ f1: string; f2: string; f3: string }>;
}

interface FormattedFacility {
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

// Extract service types from SAMHSA services array
function getServiceTypes(services: Array<{ f1: string; f2: string; f3: string }>): string[] {
    const serviceList: string[] = [];
    
    services.forEach(service => {
        if (service.f3 && service.f3.trim()) {
            serviceList.push(service.f3);
        }
    });
    
    return [...new Set(serviceList)]; // Remove duplicates
}

// Get primary service category
function getPrimaryCategory(services: Array<{ f1: string; f2: string; f3: string }>, facilityType: string): string {
    if (facilityType === 'MH') return 'Mental Health';
    if (facilityType === 'SA') return 'Substance Use Treatment';
    
    // Check services for hints
    const serviceText = services.map(s => s.f3).join(' ').toLowerCase();
    if (serviceText.includes('mental health') || serviceText.includes('psychiatric')) {
        return 'Mental Health';
    }
    return 'Substance Use Treatment';
}

// Get service description
function getServiceDescription(services: Array<{ f1: string; f2: string; f3: string }>): string {
    const typeOfCare = services.find(s => s.f2 === 'TC');
    const setting = services.find(s => s.f2 === 'SET');
    const parts = [typeOfCare?.f3, setting?.f3].filter(Boolean);
    return parts.join(' • ') || 'Treatment services available';
}

// Geocode a ZIP code using free zippopotam.us API
async function geocodeZip(zip: string): Promise<{ lat: number; lng: number; city: string; state: string } | null> {
    try {
        const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
            next: { revalidate: 86400 } // Cache for 24 hours
        });

        if (!response.ok) {
            console.error('ZIP geocoding failed:', response.status);
            return null;
        }

        const data = await response.json();
        
        if (data.places && data.places.length > 0) {
            const place = data.places[0];
            return {
                lat: parseFloat(place.latitude),
                lng: parseFloat(place.longitude),
                city: place['place name'],
                state: place['state abbreviation']
            };
        }

        return null;
    } catch (error) {
        console.error('ZIP geocoding error:', error);
        return null;
    }
}

// Search SAMHSA Treatment Locator API
async function searchSAMHSA(
    serviceType: string,
    lat: number,
    lng: number,
    radiusMiles: number
): Promise<FormattedFacility[]> {
    try {
        const radiusMeters = radiusMiles * 1609.34;
        
        // Map service type to SAMHSA sType parameter
        let sType = 'both';
        if (serviceType === 'mental-health') {
            sType = 'mh';
        } else if (serviceType === 'substance-use') {
            sType = 'sa';
        }

        const url = `https://findtreatment.gov/locator/exportsAsJson/v2?sAddr=${lat},${lng}&limitType=2&limitValue=${radiusMeters}&sType=${sType}&pageSize=50&page=1&sort=0`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            console.error('SAMHSA API error:', response.status);
            return [];
        }

        const data = await response.json();
        
        return (data.rows || []).map((facility: SAMHSAFacility, index: number) => ({
            id: `samhsa-${index}-${facility.zip}-${Date.now()}`,
            name: facility.name1,
            program: facility.name2,
            category: getPrimaryCategory(facility.services, facility.type_facility),
            subcategory: facility.type_facility === 'MH' ? 'Mental Health Services' : 'Substance Use Services',
            description: getServiceDescription(facility.services),
            address: [facility.street1, facility.street2].filter(Boolean).join(', '),
            city: facility.city,
            state: facility.state,
            zip: facility.zip,
            phone: facility.phone,
            website: facility.website,
            distance: Math.round(facility.miles * 10) / 10,
            latitude: facility.latitude,
            longitude: facility.longitude,
            services: getServiceTypes(facility.services)
        }));
    } catch (error) {
        console.error('SAMHSA search error:', error);
        return [];
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('type') || 'all';
    const radius = parseInt(searchParams.get('radius') || '50');
    
    // Get location from either ZIP code or lat/lng coordinates
    const zip = searchParams.get('zip');
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    try {
        let lat: number | null = null;
        let lng: number | null = null;
        let locationName = '';

        // Priority 1: Direct coordinates (from browser geolocation)
        if (latParam && lngParam) {
            lat = parseFloat(latParam);
            lng = parseFloat(lngParam);
            locationName = 'Your Location';
        }
        // Priority 2: ZIP code
        else if (zip && zip.length === 5) {
            const geoResult = await geocodeZip(zip);
            if (geoResult) {
                lat = geoResult.lat;
                lng = geoResult.lng;
                locationName = `${geoResult.city}, ${geoResult.state}`;
            } else {
                return NextResponse.json(
                    { error: 'Invalid ZIP code or unable to find location' },
                    { status: 400 }
                );
            }
        }
        // No valid location provided
        else {
            return NextResponse.json(
                { error: 'Please provide a valid 5-digit ZIP code' },
                { status: 400 }
            );
        }

        // Search SAMHSA
        const facilities = await searchSAMHSA(serviceType, lat, lng, radius);

        return NextResponse.json({
            success: true,
            location: locationName,
            coordinates: { lat, lng },
            radius,
            count: facilities.length,
            facilities
        });

    } catch (error) {
        console.error('Resource search error:', error);
        return NextResponse.json(
            { error: 'Failed to search resources' },
            { status: 500 }
        );
    }
}
