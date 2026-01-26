import { neon } from '@neondatabase/serverless';

// Create SQL query function
export const sql = neon(process.env.DATABASE_URL!);

// ==================== QUERY HELPERS ====================

/**
 * Execute a parameterized query
 */
export async function query<T>(queryString: string, params?: unknown[]): Promise<T[]> {
    try {
        const result = await sql(queryString, params);
        return result as T[];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

/**
 * Get a single record or null
 */
export async function queryOne<T>(queryString: string, params?: unknown[]): Promise<T | null> {
    const results = await query<T>(queryString, params);
    return results[0] || null;
}

/**
 * Insert and return the created record
 */
export async function insert<T>(table: string, data: Record<string, unknown>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');
    
    const queryString = `
        INSERT INTO ${table} (${columns})
        VALUES (${placeholders})
        RETURNING *
    `;
    
    const result = await query<T>(queryString, values);
    return result[0];
}

/**
 * Update records and return updated rows
 */
export async function update<T>(
    table: string,
    data: Record<string, unknown>,
    where: Record<string, unknown>
): Promise<T[]> {
    const dataKeys = Object.keys(data);
    const whereKeys = Object.keys(where);
    
    const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const whereClause = whereKeys.map((key, i) => `${key} = $${dataKeys.length + i + 1}`).join(' AND ');
    
    const values = [...Object.values(data), ...Object.values(where)];
    
    const queryString = `
        UPDATE ${table}
        SET ${setClause}, updated_at = NOW()
        WHERE ${whereClause}
        RETURNING *
    `;
    
    return query<T>(queryString, values);
}

/**
 * Soft delete (set is_archived = true or status = 'archived')
 */
export async function softDelete(
    table: string,
    id: string,
    field: 'is_archived' | 'status' = 'is_archived'
): Promise<boolean> {
    const value = field === 'is_archived' ? true : 'archived';
    const queryString = `
        UPDATE ${table}
        SET ${field} = $1, updated_at = NOW()
        WHERE id = $2
    `;
    await query(queryString, [value, id]);
    return true;
}

/**
 * Hard delete (use sparingly)
 */
export async function hardDelete(table: string, id: string): Promise<boolean> {
    const queryString = `DELETE FROM ${table} WHERE id = $1`;
    await query(queryString, [id]);
    return true;
}

// ==================== AUDIT LOGGING ====================

export async function logAuditEvent(
    userId: string | null,
    organizationId: string | null,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
): Promise<void> {
    try {
        await sql`
            INSERT INTO audit_log (user_id, organization_id, action, resource_type, resource_id, details, ip_address)
            VALUES (
                ${userId}::uuid,
                ${organizationId}::uuid,
                ${action},
                ${resourceType},
                ${resourceId}::uuid,
                ${JSON.stringify(details || {})}::jsonb,
                ${ipAddress}
            )
        `;
    } catch (error) {
        // Don't throw - audit logging failures shouldn't break the app
        console.error('Audit log error:', error);
    }
}

// ==================== ORGANIZATION HELPERS ====================

export async function getUserOrganizations(cognitoSub: string) {
    return sql`
        SELECT 
            o.id,
            o.name,
            o.slug,
            o.type,
            o.logo_url,
            o.primary_color,
            om.role
        FROM organizations o
        JOIN organization_members om ON o.id = om.organization_id
        JOIN users u ON om.user_id = u.id
        WHERE u.cognito_sub = ${cognitoSub}
        AND om.status = 'active'
        ORDER BY o.name
    `;
}

export async function getOrCreateUser(cognitoSub: string, email: string, name?: string) {
    // Try to get existing user
    const existing = await sql`
        SELECT * FROM users WHERE cognito_sub = ${cognitoSub}
    `;
    
    if (existing.length > 0) {
        // Update last login
        await sql`
            UPDATE users SET last_login_at = NOW() WHERE cognito_sub = ${cognitoSub}
        `;
        return existing[0];
    }
    
    // Create new user
    const [firstName, ...lastParts] = (name || '').split(' ');
    const lastName = lastParts.join(' ');
    
    const newUser = await sql`
        INSERT INTO users (cognito_sub, email, first_name, last_name, last_login_at)
        VALUES (${cognitoSub}, ${email}, ${firstName || null}, ${lastName || null}, NOW())
        RETURNING *
    `;
    
    return newUser[0];
}

// ==================== PARTICIPANT HELPERS ====================

export async function getParticipantsByOrg(organizationId: string, includeInactive = false) {
    const statusFilter = includeInactive ? '' : "AND p.status = 'active'";
    
    return sql`
        SELECT 
            p.*,
            u.first_name || ' ' || u.last_name as primary_pss_name,
            (SELECT COUNT(*) FROM goals g WHERE g.participant_id = p.id) as goals_count,
            (SELECT COUNT(*) FROM session_notes sn WHERE sn.participant_id = p.id AND NOT sn.is_archived) as notes_count
        FROM participants p
        LEFT JOIN users u ON p.primary_pss_id = u.id
        WHERE p.organization_id = ${organizationId}
        ${includeInactive ? sql`` : sql`AND p.status = 'active'`}
        ORDER BY p.last_name, p.first_name
    `;
}

export async function getParticipantById(id: string, organizationId: string) {
    const result = await sql`
        SELECT 
            p.*,
            u.first_name || ' ' || u.last_name as primary_pss_name,
            u.email as primary_pss_email
        FROM participants p
        LEFT JOIN users u ON p.primary_pss_id = u.id
        WHERE p.id = ${id}
        AND p.organization_id = ${organizationId}
    `;
    return result[0] || null;
}

// ==================== VALIDATION HELPERS ====================

export function validateUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

export function sanitizeInput(input: string): string {
    return input.trim().slice(0, 10000); // Reasonable max length
}
