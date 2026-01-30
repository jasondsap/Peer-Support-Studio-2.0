import { NextRequest, NextResponse } from 'next/server';

// For App Router (Next.js 13+), increase the body size limit
export const runtime = 'nodejs';
export const maxDuration = 300; // Allow up to 5 minutes for processing large files

export async function POST(req: NextRequest) {
    try {
        // Check content length header first for early rejection
        const contentLength = req.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 50MB.' },
                { status: 413 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const speakerDetection = formData.get('speakerDetection') === 'true';

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Check file size (50MB max for AssemblyAI)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB.` },
                { status: 413 }
            );
        }

        // Get the API key
        const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;
        if (!assemblyAIKey) {
            return NextResponse.json(
                { error: 'AssemblyAI API key not configured' },
                { status: 500 }
            );
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Step 1: Upload the file to AssemblyAI
        console.log('Uploading file to AssemblyAI...', file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
        
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'Authorization': assemblyAIKey,
                'Content-Type': 'application/octet-stream',
            },
            body: buffer,
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload failed:', errorText);
            return NextResponse.json(
                { error: 'Failed to upload file to AssemblyAI' },
                { status: 500 }
            );
        }

        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;

        console.log('File uploaded, starting transcription...');

        // Step 2: Start transcription
        const transcriptRequest: any = {
            audio_url: audioUrl,
            language_code: 'en',
        };

        // Enable speaker diarization if requested
        if (speakerDetection) {
            transcriptRequest.speaker_labels = true;
            transcriptRequest.speakers_expected = 2; // PSS and participant
        }

        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'Authorization': assemblyAIKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transcriptRequest),
        });

        if (!transcriptResponse.ok) {
            const errorText = await transcriptResponse.text();
            console.error('Transcription request failed:', errorText);
            return NextResponse.json(
                { error: 'Failed to start transcription' },
                { status: 500 }
            );
        }

        const transcriptData = await transcriptResponse.json();
        const transcriptId = transcriptData.id;

        console.log('Transcription started, ID:', transcriptId);

        // Step 3: Poll for completion
        let transcript = null;
        let attempts = 0;
        const maxAttempts = 120; // Max 10 minutes (120 * 5 seconds)

        while (attempts < maxAttempts) {
            const statusResponse = await fetch(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                {
                    headers: {
                        'Authorization': assemblyAIKey,
                    },
                }
            );

            const statusData = await statusResponse.json();

            if (statusData.status === 'completed') {
                transcript = statusData;
                break;
            } else if (statusData.status === 'error') {
                console.error('Transcription error:', statusData.error);
                return NextResponse.json(
                    { error: statusData.error || 'Transcription failed' },
                    { status: 500 }
                );
            }

            // Log progress every 6 attempts (30 seconds)
            if (attempts % 6 === 0) {
                console.log(`Transcription status: ${statusData.status} (${Math.round(attempts * 5 / 60)} min elapsed)`);
            }

            // Wait 5 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        if (!transcript) {
            return NextResponse.json(
                { error: 'Transcription is taking longer than expected. Please try again in a few minutes - your audio was uploaded successfully.' },
                { status: 504 }
            );
        }

        console.log('Transcription completed!');

        // Format the response
        let formattedTranscript = '';
        
        if (speakerDetection && transcript.utterances) {
            // Format with speaker labels
            formattedTranscript = transcript.utterances
                .map((utterance: any) => {
                    const speaker = utterance.speaker === 'A' ? 'Speaker 1' : 'Speaker 2';
                    return `${speaker}: ${utterance.text}`;
                })
                .join('\n\n');
        } else {
            // Plain transcript
            formattedTranscript = transcript.text;
        }

        return NextResponse.json({
            success: true,
            transcript: formattedTranscript,
            duration: transcript.audio_duration,
            wordCount: transcript.words?.length || 0,
            speakerCount: transcript.utterances ? 
                new Set(transcript.utterances.map((u: any) => u.speaker)).size : 1,
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error occurred' },
            { status: 500 }
        );
    }
}
