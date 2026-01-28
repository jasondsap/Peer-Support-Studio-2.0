// app/api/hume/access-token/route.ts
// Server-only route for minting a short-lived Hume access token.
// Requires Vercel env vars (Server-side, NOT NEXT_PUBLIC):
//   HUME_API_KEY
//   HUME_SECRET_KEY

import { NextResponse } from "next/server";
import { fetchAccessToken } from "hume";

export const runtime = "nodejs";          // ensure this runs on Node (not Edge)
export const dynamic = "force-dynamic";   // prevent caching at the route level

export async function GET() {
    const apiKey = process.env.HUME_API_KEY;
    const secretKey = process.env.HUME_SECRET_KEY;

    // Fail loud + explicit (no empty-string fallbacks)
    if (!apiKey || !secretKey) {
        return NextResponse.json(
            { error: "Missing HUME_API_KEY or HUME_SECRET_KEY on the server." },
            {
                status: 500,
                headers: {
                    "Cache-Control": "no-store, max-age=0",
                },
            }
        );
    }

    try {
        const accessToken = await fetchAccessToken({ apiKey, secretKey });

        if (!accessToken || typeof accessToken !== "string") {
            return NextResponse.json(
                { error: "Hume returned no access token." },
                {
                    status: 502,
                    headers: {
                        "Cache-Control": "no-store, max-age=0",
                    },
                }
            );
        }

        return NextResponse.json(
            { accessToken },
            {
                status: 200,
                headers: {
                    // Prevent Vercel/CDN/browser caching of short-lived tokens
                    "Cache-Control": "no-store, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            }
        );
    } catch (err: any) {
        console.error("Hume access token error:", err);

        return NextResponse.json(
            {
                error: "Failed to fetch Hume access token.",
                // Helpful (safe) message for debugging; remove if you prefer
                details: err?.message ?? String(err),
            },
            {
                status: 500,
                headers: {
                    "Cache-Control": "no-store, max-age=0",
                },
            }
        );
    }
}
