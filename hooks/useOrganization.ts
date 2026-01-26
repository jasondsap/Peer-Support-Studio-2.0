'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Organization {
    id: string;
    name: string;
    slug: string;
    type: string;
    role: string;
    invite_code?: string;
}

interface UseOrganizationReturn {
    organization: Organization | null;
    organizations: Organization[];
    isLoading: boolean;
    hasOrganization: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useOrganization(): UseOrganizationReturn {
    const { data: session, status } = useSession();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrganizations = async () => {
        if (status !== 'authenticated') {
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/user/organizations');
            const data = await res.json();

            if (data.organizations && data.organizations.length > 0) {
                setOrganizations(data.organizations);
                setOrganization(data.organizations[0]); // Set first as current
            } else {
                setOrganizations([]);
                setOrganization(null);
            }
        } catch (e) {
            console.error('Error fetching organizations:', e);
            setError('Failed to load organization');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchOrganizations();
        } else if (status === 'unauthenticated') {
            setIsLoading(false);
        }
    }, [status]);

    return {
        organization,
        organizations,
        isLoading,
        hasOrganization: organizations.length > 0,
        error,
        refetch: fetchOrganizations,
    };
}
