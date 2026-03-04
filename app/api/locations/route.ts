import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

// ============================================================================
// Helper: verify org membership
// ============================================================================
async function verifyOrgAccess(organizationId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const userSub = (session.user as any).sub || session.user.id;
    const result = await query(
        `SELECT om.role FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE u.cognito_sub = $1 AND om.organization_id = $2`,
        [userSub, organizationId]
    ) as any[];

    if (result.length === 0) return null;
    return { userSub, role: result[0].role };
}

// ============================================================================
// GET /api/locations — List locations for an organization
// ============================================================================
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organization_id');
        const status = searchParams.get('status') || 'active';
        const includeCount = searchParams.get('include_count') === 'true';

        if (!organizationId) {
            return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
        }

        const access = await verifyOrgAccess(organizationId);
        if (!access) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let locations;

        if (includeCount) {
            locations = await query(
                `SELECT l.*,
                    (SELECT COUNT(*) FROM participants p 
                     WHERE p.location_id = l.id AND p.status = 'active') as active_participants,
                    (SELECT COUNT(*) FROM participants p 
                     WHERE p.location_id = l.id) as total_participants
                 FROM locations l
                 WHERE l.organization_id = $1
                 ${status !== 'all' ? 'AND l.status = $2' : ''}
                 ORDER BY l.name ASC`,
                status !== 'all' ? [organizationId, status] : [organizationId]
            ) as any[];
        } else {
            locations = await query(
                `SELECT id, name, short_name, status, capacity
                 FROM locations
                 WHERE organization_id = $1
                 ${status !== 'all' ? 'AND status = $2' : ''}
                 ORDER BY name ASC`,
                status !== 'all' ? [organizationId, status] : [organizationId]
            ) as any[];
        }

        return NextResponse.json({ locations });
    } catch (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }
}

// ============================================================================
// POST /api/locations — Create a new location
// ============================================================================
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { organization_id, name, short_name, address, city, state, zip, capacity, notes } = body;

        if (!organization_id || !name) {
            return NextResponse.json({ error: 'organization_id and name required' }, { status: 400 });
        }

        const access = await verifyOrgAccess(organization_id);
        if (!access) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await query(
            `INSERT INTO locations (organization_id, name, short_name, address, city, state, zip, capacity, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [organization_id, name, short_name || null, address || null, city || null,
             state || null, zip || null, capacity || null, notes || null]
        ) as any[];

        return NextResponse.json({ success: true, location: result[0] });
    } catch (error) {
        console.error('Error creating location:', error);
        return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }
}

// ============================================================================
// PUT /api/locations — Update a location
// ============================================================================
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, organization_id, ...data } = body;

        if (!id || !organization_id) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        const access = await verifyOrgAccess(organization_id);
        if (!access) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        const allowedFields = ['name', 'short_name', 'address', 'city', 'state', 'zip', 'capacity', 'status', 'notes'];
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = $${idx++}`);
                values.push(data[field]);
            }
        }

        if (fields.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        fields.push(`updated_at = NOW()`);
        values.push(id);
        values.push(organization_id);

        await query(
            `UPDATE locations SET ${fields.join(', ')} WHERE id = $${idx} AND organization_id = $${idx + 1}`,
            values
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating location:', error);
        return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }
}

// ============================================================================
// DELETE /api/locations — Delete a location (nulls participant.location_id)
// ============================================================================
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organization_id');

        if (!id || !organizationId) {
            return NextResponse.json({ error: 'id and organization_id required' }, { status: 400 });
        }

        const access = await verifyOrgAccess(organizationId);
        if (!access) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Null out participant location references before deleting
        await query(
            'UPDATE participants SET location_id = NULL WHERE location_id = $1',
            [id]
        );

        await query(
            'DELETE FROM locations WHERE id = $1 AND organization_id = $2',
            [id, organizationId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting location:', error);
        return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
    }
}
