// ============================================================================
// TTS API — Text-to-Speech via AWS Polly
// File: /app/api/tts/route.ts
//
// Generates speech audio for assessment questions.
// Caches generated audio in-memory to avoid repeated Polly calls.
// Supports English and Spanish with neural voices.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PollyClient, SynthesizeSpeechCommand, Engine, OutputFormat, VoiceId, LanguageCode } from '@aws-sdk/client-polly';

// ── In-memory cache: key → audio buffer ──
// In production, swap this for S3 storage
const audioCache = new Map<string, Buffer>();

// ── Voice config per language + gender ──
const VOICE_CONFIG: Record<string, Record<string, { voiceId: VoiceId; languageCode: LanguageCode; engine: Engine }>> = {
    en: {
        male:   { voiceId: 'Matthew',  languageCode: 'en-US', engine: 'neural' },
        female: { voiceId: 'Joanna',   languageCode: 'en-US', engine: 'neural' },
    },
    es: {
        male:   { voiceId: 'Pedro',    languageCode: 'es-US', engine: 'neural' },
        female: { voiceId: 'Lupe',     languageCode: 'es-US', engine: 'neural' },
    },
};

// ── Polly client (reused across requests) ──
const polly = new PollyClient({
    region: process.env.AWS_REGION || 'us-east-1',
    // Uses default credential chain: env vars, instance role, etc.
});

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { text, language = 'en', voice = 'male', cacheKey } = body;

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }

        // Limit text length to prevent abuse
        if (text.length > 2000) {
            return NextResponse.json({ error: 'Text too long (max 2000 chars)' }, { status: 400 });
        }

        const lang = language === 'es' ? 'es' : 'en';
        const gender = voice === 'female' ? 'female' : 'male';
        const key = cacheKey || `${lang}_${gender}_${hashText(text)}`;

        // ── Check cache first ──
        if (audioCache.has(key)) {
            const cached = new Uint8Array(audioCache.get(key)!);
            return new NextResponse(cached, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': cached.byteLength.toString(),
                    'Cache-Control': 'public, max-age=86400', // 24h browser cache
                    'X-TTS-Cache': 'hit',
                },
            });
        }

        // ── Call Polly ──
        const voiceConfig = VOICE_CONFIG[lang][gender];

        const command = new SynthesizeSpeechCommand({
            Text: text,
            OutputFormat: 'mp3',
            VoiceId: voiceConfig.voiceId,
            LanguageCode: voiceConfig.languageCode,
            Engine: voiceConfig.engine,
        });

        const response = await polly.send(command);

        if (!response.AudioStream) {
            return NextResponse.json({ error: 'No audio returned from Polly' }, { status: 500 });
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        // @ts-ignore — AudioStream is a Readable in Node
        for await (const chunk of response.AudioStream) {
            chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        // ── Store in cache ──
        audioCache.set(key, audioBuffer);

        // Evict old entries if cache gets too large (keep last 200)
        if (audioCache.size > 200) {
            const firstKey = audioCache.keys().next().value;
            if (firstKey) audioCache.delete(firstKey);
        }

        return new NextResponse(new Uint8Array(audioBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length.toString(),
                'Cache-Control': 'public, max-age=86400',
                'X-TTS-Cache': 'miss',
            },
        });
    } catch (error: any) {
        console.error('TTS error:', error);

        // Surface useful Polly errors
        if (error.name === 'InvalidSsmlException') {
            return NextResponse.json({ error: 'Invalid text for speech synthesis' }, { status: 400 });
        }

        return NextResponse.json(
            { error: 'Failed to generate speech' },
            { status: 500 }
        );
    }
}

// Simple hash for cache keys
function hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}
