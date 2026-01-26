import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

const client = new AssemblyAI({
    apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min timeout for longer recordings

export async function POST(request: NextRequest) {
    try {
        // Check for API key
        if (!process.env.ASSEMBLYAI_API_KEY) {
            console.error('ASSEMBLYAI_API_KEY is not configured');
            return NextResponse.json(
                { error: 'Server configuration error. Please contact support.' },
                { status: 500 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const speakerCount = formData.get('speakerCount') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'Audio file is required' },
                { status: 400 }
            );
        }

        // Validate file size (max 100MB for AssemblyAI)
        if (file.size > 100 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'File size must be less than 100MB' },
                { status: 400 }
            );
        }

        // Validate file type by extension
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const validExtensions = ['mp3', 'wav', 'm4a', 'mp4', 'webm', 'ogg', 'flac', 'mpeg', 'mpga'];
        
        if (!validExtensions.includes(fileExtension || '')) {
            return NextResponse.json(
                { error: `Invalid file type ".${fileExtension}". Please upload MP3, WAV, M4A, MP4, WebM, OGG, or FLAC` },
                { status: 400 }
            );
        }

        console.log(`Transcribing with diarization: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Convert File to Buffer for AssemblyAI
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload file to AssemblyAI
        const uploadUrl = await client.files.upload(buffer);

        // Configure transcription with speaker diarization
        const config: any = {
            audio_url: uploadUrl,
            speaker_labels: true, // Enable speaker diarization
        };

        // If user specified speaker count, use it (helps accuracy)
        if (speakerCount && parseInt(speakerCount) >= 2) {
            config.speakers_expected = parseInt(speakerCount);
        }

        // Start transcription
        const transcript = await client.transcripts.transcribe(config);

        if (transcript.status === 'error') {
            console.error('Transcription error:', transcript.error);
            return NextResponse.json(
                { error: transcript.error || 'Transcription failed' },
                { status: 500 }
            );
        }

        // Format transcript with speaker labels
        const formattedTranscript = formatDiarizedTranscript(transcript);
        
        // Extract speaker statistics
        const speakerStats = calculateSpeakerStats(transcript);

        console.log(`Transcription complete: ${transcript.audio_duration}s, ${speakerStats.speakerCount} speakers detected`);

        return NextResponse.json({
            success: true,
            transcript: formattedTranscript,
            rawUtterances: transcript.utterances || [],
            duration: transcript.audio_duration,
            speakerStats,
            speakerCount: speakerStats.speakerCount,
            speakers: speakerStats.speakers
        });

    } catch (error: any) {
        console.error('Transcription error:', error);
        
        return NextResponse.json(
            { error: error.message || 'Failed to transcribe audio. Please try again.' },
            { status: 500 }
        );
    }
}

// Format transcript with speaker labels and timestamps
function formatDiarizedTranscript(transcript: any): string {
    if (!transcript.utterances || transcript.utterances.length === 0) {
        // Fallback to plain text if no utterances
        return transcript.text || '';
    }

    return transcript.utterances.map((utterance: any) => {
        const timestamp = formatTime(utterance.start / 1000); // Convert ms to seconds
        const speaker = utterance.speaker; // e.g., "A", "B", "C"
        const text = utterance.text.trim();
        
        return `${timestamp} [Speaker ${speaker}]: ${text}`;
    }).join('\n\n');
}

// Calculate speaker statistics
function calculateSpeakerStats(transcript: any): {
    speakerCount: number;
    speakers: Array<{
        id: string;
        label: string;
        wordCount: number;
        talkTimeMs: number;
        talkTimePercent: number;
        utteranceCount: number;
    }>;
    totalDuration: number;
} {
    if (!transcript.utterances || transcript.utterances.length === 0) {
        return {
            speakerCount: 0,
            speakers: [],
            totalDuration: transcript.audio_duration || 0
        };
    }

    const speakerMap = new Map<string, {
        wordCount: number;
        talkTimeMs: number;
        utteranceCount: number;
    }>();

    // Aggregate stats per speaker
    for (const utterance of transcript.utterances) {
        const speaker = utterance.speaker;
        const duration = utterance.end - utterance.start;
        const words = utterance.text.split(/\s+/).filter((w: string) => w.length > 0).length;

        if (!speakerMap.has(speaker)) {
            speakerMap.set(speaker, {
                wordCount: 0,
                talkTimeMs: 0,
                utteranceCount: 0
            });
        }

        const stats = speakerMap.get(speaker)!;
        stats.wordCount += words;
        stats.talkTimeMs += duration;
        stats.utteranceCount += 1;
    }

    // Calculate total talk time
    const totalTalkTime = Array.from(speakerMap.values()).reduce((sum, s) => sum + s.talkTimeMs, 0);

    // Convert to array with percentages
    const speakers = Array.from(speakerMap.entries()).map(([id, stats]) => ({
        id,
        label: `Speaker ${id}`,
        wordCount: stats.wordCount,
        talkTimeMs: stats.talkTimeMs,
        talkTimePercent: totalTalkTime > 0 ? Math.round((stats.talkTimeMs / totalTalkTime) * 100) : 0,
        utteranceCount: stats.utteranceCount
    }));

    // Sort by talk time (most to least)
    speakers.sort((a, b) => b.talkTimeMs - a.talkTimeMs);

    return {
        speakerCount: speakers.length,
        speakers,
        totalDuration: transcript.audio_duration || 0
    };
}

// Helper function to format seconds to timestamp
function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
