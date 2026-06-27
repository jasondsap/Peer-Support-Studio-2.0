import { NextRequest, NextResponse } from "next/server";
import { getSessionWithUserId, requireOrgAccess } from "@/lib/auth";
import { sql, logAuditEvent } from "@/lib/db";

// Shared select: task plus participant name (when linked) and assignee name.
const TASK_SELECT = `
    SELECT
        t.id,
        t.organization_id,
        t.assigned_to,
        t.participant_id,
        t.title,
        t.description,
        t.task_type,
        t.due_date,
        t.priority,
        t.status,
        t.created_by,
        t.completed_at,
        t.created_at,
        t.updated_at,
        TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS participant_name,
        TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS assigned_to_name
    FROM tasks t
    LEFT JOIN participants p ON p.id = t.participant_id
    LEFT JOIN users u ON u.id = t.assigned_to
`;

// GET — list tasks.
//   ?organization_id=  (required)
//   &assigned_to=me|<userId>   (default: me)
//   &status=open|all           (default: open)
//   &participant_id=<id>       (optional filter)
// Ordered: overdue first, then by due_date, then priority.
export async function GET(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get("organization_id");
        const assignedToParam = searchParams.get("assigned_to") || "me";
        const statusParam = (searchParams.get("status") || "open").toLowerCase();
        const participantId = searchParams.get("participant_id");

        if (!organizationId) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        // Build dynamic WHERE so we keep parameters safe.
        const where: string[] = ["t.organization_id = $1"];
        const values: unknown[] = [organizationId];

        // Assignee filter — "me" resolves to the internal user id.
        if (assignedToParam !== "all") {
            const assignedTo = assignedToParam === "me" ? session.internalUserId : assignedToParam;
            values.push(assignedTo);
            where.push(`t.assigned_to = $${values.length}`);
        }

        // Status filter — "open" excludes done/dismissed; "all" shows everything.
        if (statusParam === "open") {
            where.push(`t.status NOT IN ('done', 'dismissed')`);
        } else if (statusParam !== "all") {
            values.push(statusParam);
            where.push(`t.status = $${values.length}`);
        }

        if (participantId) {
            values.push(participantId);
            where.push(`t.participant_id = $${values.length}`);
        }

        const queryText = `
            ${TASK_SELECT}
            WHERE ${where.join(" AND ")}
            ORDER BY
                (t.due_date IS NOT NULL AND t.due_date < NOW()) DESC,
                t.due_date ASC NULLS LAST,
                CASE t.priority
                    WHEN 'urgent' THEN 0
                    WHEN 'high' THEN 1
                    WHEN 'normal' THEN 2
                    WHEN 'low' THEN 3
                    ELSE 4
                END ASC,
                t.created_at DESC
        `;

        const tasks = await sql(queryText, values);

        return NextResponse.json({ tasks });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch tasks";
        const status = message.includes("access denied") ? 403 : message === "Unauthorized" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// POST — create a task. assigned_to defaults to the creator.
export async function POST(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const {
            organization_id,
            title,
            description,
            task_type,
            due_date,
            priority,
            participant_id,
            assigned_to,
        } = body || {};

        if (!organization_id) {
            return NextResponse.json(
                { error: "organization_id is required" },
                { status: 400 }
            );
        }

        if (!title || !String(title).trim()) {
            return NextResponse.json(
                { error: "title is required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        const assignee = assigned_to || session.internalUserId;

        const result = await sql`
            INSERT INTO tasks (
                organization_id, assigned_to, participant_id, title, description,
                task_type, due_date, priority, status, created_by
            ) VALUES (
                ${organization_id},
                ${assignee},
                ${participant_id || null},
                ${String(title).trim()},
                ${description || null},
                ${task_type || null},
                ${due_date || null},
                ${priority || 'normal'},
                'open',
                ${session.internalUserId}
            )
            RETURNING *
        `;

        const task = result[0];

        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "create",
            "task",
            task.id,
            { title: task.title, assigned_to: assignee }
        );

        return NextResponse.json({ task }, { status: 201 });
    } catch (error) {
        console.error("Error creating task:", error);
        const message = error instanceof Error ? error.message : "Failed to create task";
        const status = message.includes("access denied") ? 403 : message === "Unauthorized" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// PATCH — update a task. action:'complete' or status:'done' stamps completed_at.
export async function PATCH(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const body = await req.json();
        const { id, organization_id, action } = body || {};

        if (!id || !organization_id) {
            return NextResponse.json(
                { error: "id and organization_id are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organization_id);

        // Confirm the task belongs to the org.
        const existing = await sql`
            SELECT id FROM tasks WHERE id = ${id} AND organization_id = ${organization_id}
        `;
        if (existing.length === 0) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        // Normalize completion: action:'complete' or status:'done'.
        let status: string | undefined = body.status;
        const isComplete = action === "complete" || status === "done";
        if (isComplete) status = "done";

        const setClauses: string[] = [];
        const values: unknown[] = [];
        const push = (clause: string, value: unknown) => {
            values.push(value);
            setClauses.push(`${clause} $${values.length}`);
        };

        if (typeof body.title === "string") push("title =", body.title.trim());
        if ("due_date" in body) push("due_date =", body.due_date || null);
        if ("priority" in body) push("priority =", body.priority || "normal");
        if ("assigned_to" in body) push("assigned_to =", body.assigned_to || null);
        if ("description" in body) push("description =", body.description || null);
        if (status) push("status =", status);

        // completed_at: set when completing, clear when reopening to 'open'.
        if (isComplete) {
            setClauses.push(`completed_at = NOW()`);
        } else if (status && status !== "done") {
            setClauses.push(`completed_at = NULL`);
        }

        if (setClauses.length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        values.push(id);
        const idParam = values.length;
        values.push(organization_id);
        const orgParam = values.length;

        const updateQuery = `
            UPDATE tasks
            SET ${setClauses.join(", ")}, updated_at = NOW()
            WHERE id = $${idParam} AND organization_id = $${orgParam}
            RETURNING *
        `;

        const result = await sql(updateQuery, values);
        const task = result[0];

        await logAuditEvent(
            session.internalUserId,
            organization_id,
            "update",
            "task",
            id,
            { action: isComplete ? "complete" : "update", status }
        );

        return NextResponse.json({ task });
    } catch (error) {
        console.error("Error updating task:", error);
        const message = error instanceof Error ? error.message : "Failed to update task";
        const status = message.includes("access denied") ? 403 : message === "Unauthorized" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// DELETE — soft dismiss (tasks are user data; we keep the row, set status='dismissed').
export async function DELETE(req: NextRequest) {
    try {
        const session = await getSessionWithUserId();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const organizationId = searchParams.get("organization_id");

        if (!id || !organizationId) {
            return NextResponse.json(
                { error: "id and organization_id are required" },
                { status: 400 }
            );
        }

        await requireOrgAccess(organizationId);

        const result = await sql`
            UPDATE tasks
            SET status = 'dismissed', updated_at = NOW()
            WHERE id = ${id} AND organization_id = ${organizationId}
            RETURNING id
        `;

        if (result.length === 0) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        await logAuditEvent(
            session.internalUserId,
            organizationId,
            "delete",
            "task",
            id,
            { action: "dismiss" }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error dismissing task:", error);
        const message = error instanceof Error ? error.message : "Failed to dismiss task";
        const status = message.includes("access denied") ? 403 : message === "Unauthorized" ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
