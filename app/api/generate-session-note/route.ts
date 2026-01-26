import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { lessonId, ...sessionNoteData } = body;

        // Here you would typically save to your database
        // For now, we'll just return success with the data

        const sessionNote = {
            id: `note-${Date.now()}`,
            lessonId,
            ...sessionNoteData,
            createdAt: new Date().toISOString()
        };

        return NextResponse.json({
            success: true,
            sessionNote
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating session note:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to create session note'
            },
            { status: 500 }
        );
    }
}
