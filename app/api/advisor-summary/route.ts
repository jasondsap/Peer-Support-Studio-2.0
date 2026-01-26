import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { transcript } = await request.json();

        if (!transcript || transcript.trim().length === 0) {
            return NextResponse.json(
                { error: 'Transcript is required' },
                { status: 400 }
            );
        }

        const systemPrompt = `You are a summarization assistant working inside "Peer Support Studio", a digital workspace for Peer Support Specialists (PSS) who support people in recovery, reentry, and behavioral health.

You receive the FULL TRANSCRIPT of a conversation between:
- a Peer Support Specialist (the user), and
- an AI Peer Advisor (a supportive, non-clinical voice assistant).

Your job is to create a short, clear, strength-based summary of the conversation that the Peer Support Specialist can quickly review and act on.

IMPORTANT CONTEXT:
- The conversation is about the Peer Support Specialist's work, feelings, ideas, and questions.
- The conversation is NOT therapy for the participant. It's support and coaching for the Peer Support Specialist.
- The summary should NEVER sound clinical or diagnostic.
- The summary is for personal/professional support and planning only, not for an official medical record.

YOUR TASK:
From the transcript, create a structured summary that:
1. Briefly explains what the Peer Support Specialist was looking for help with.
2. Captures the main topics or themes discussed.
3. Notes any specific ideas, strategies, or reframes that came up.
4. Suggests a few practical next steps for the Peer Support Specialist.
5. Creates ACTIONABLE PROMPTS for other tools in Peer Support Studio (see below).
6. Ends with 1–2 sentences of strength-based encouragement.

CRITICAL - TOOL SUGGESTIONS:
For each tool suggestion, you must provide TWO things:
1. "suggestion" - A brief, human-readable explanation of why this tool might help (displayed to the user)
2. "prompt" - An ACTIONABLE, TOOL-READY prompt that will be passed directly to that tool

TOOL PROMPT GUIDELINES:

For Recovery Goal Generator:
- The "prompt" should be written as if the PARTICIPANT is speaking about what they want
- Use first-person language: "I want to...", "I would like to...", "My goal is to..."
- Be specific and actionable, not meta or instructional
- BAD: "Consider creating a recovery goal around building confidence"
- GOOD prompt: "I want to feel more confident speaking up in group settings and sharing my recovery story"

For Lesson Builder:
- The "prompt" should be a clear, specific TOPIC for a peer support group session
- Keep it concise (3-10 words ideally)
- Focus on the subject matter, not instructions
- BAD: "Use the lesson builder to design a session about coping skills"
- GOOD prompt: "Building Healthy Coping Skills After Relapse"

For Resource Navigator:
- The "prompt" should be SEARCH KEYWORDS that would find relevant resources
- Use 3-6 specific, searchable terms
- Include location "Louisville" if local resources would help
- BAD: "Explore resources that offer support for housing instability"
- GOOD prompt: "emergency housing assistance Louisville KY"

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure and no additional text, no markdown, and no backticks:

{
  "summary": "2–4 sentence, plain-language recap of what the Peer Support Specialist came to talk about and what you explored together.",
  "mainTopics": [
    "Short topic 1 (e.g., 'supporting a participant after relapse')",
    "Short topic 2 (e.g., 'peer burnout and self-care')"
  ],
  "ideasDiscussed": [
    "Concrete idea or strategy 1 that came up in the conversation.",
    "Concrete idea or strategy 2.",
    "Concrete idea or strategy 3."
  ],
  "suggestedNextSteps": [
    "Practical next step 1 the Peer Support Specialist could take after this conversation.",
    "Practical next step 2.",
    "Practical next step 3."
  ],
  "toolSuggestions": {
    "recoveryGoalGenerator": {
      "suggestion": "One sentence explaining how this conversation could inspire a recovery goal",
      "prompt": "First-person goal statement as if participant is speaking (e.g., 'I want to build a daily routine that supports my recovery')"
    },
    "lessonBuilder": {
      "suggestion": "One sentence explaining how this could become a group session",
      "prompt": "Clear topic title for a lesson (e.g., 'Managing Triggers in Early Recovery')"
    },
    "resourceNavigator": {
      "suggestion": "One sentence explaining what resources might help",
      "prompt": "Search keywords (e.g., 'mental health counseling sliding scale Louisville')"
    }
  },
  "encouragement": "1–2 sentences of strength-based encouragement for the Peer Support Specialist, acknowledging their effort and the importance of their work."
}

IMPORTANT NOTES:
- Set any tool suggestion to null if it's not relevant to the conversation
- Make sure each "prompt" is DIRECTLY USABLE in that tool without modification
- The "prompt" should NOT contain meta-language like "consider", "explore", "use the tool to..."
- Focus on extracting the ACTUAL CONTENT discussed, not describing what to do with it

STYLE & SAFETY:
- Use warm, non-judgmental, supportive language.
- Do NOT give medical, psychiatric, or legal advice.
- Do NOT mention 'diagnosis', 'symptoms', or other clinical framing.
- Focus on hope, agency, and small, doable steps.
- NEVER invent or hallucinate specific real-world organizations or contact details. If resources are mentioned, just refer to them in general terms.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `TRANSCRIPT:\n${transcript}` }
            ],
            max_tokens: 1500,
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || '';

        // Clean and parse JSON
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        try {
            const parsedSummary = JSON.parse(cleanContent);
            
            // Normalize tool suggestions to ensure backward compatibility
            // Convert old format (string) to new format (object with suggestion and prompt)
            if (parsedSummary.toolSuggestions) {
                const tools = ['recoveryGoalGenerator', 'lessonBuilder', 'resourceNavigator'];
                tools.forEach(tool => {
                    const value = parsedSummary.toolSuggestions[tool];
                    if (typeof value === 'string') {
                        // Old format - convert to new format
                        parsedSummary.toolSuggestions[tool] = {
                            suggestion: value,
                            prompt: value // Use same value as fallback
                        };
                    }
                });
            }
            
            return NextResponse.json({
                success: true,
                summary: parsedSummary
            });
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // Return a basic structure if parsing fails
            return NextResponse.json({
                success: true,
                summary: {
                    summary: cleanContent,
                    mainTopics: [],
                    ideasDiscussed: [],
                    suggestedNextSteps: ['Review the conversation and identify key takeaways.'],
                    toolSuggestions: {
                        recoveryGoalGenerator: null,
                        lessonBuilder: null,
                        resourceNavigator: null
                    },
                    encouragement: 'Thank you for taking time to reflect on your practice. Your dedication to growth makes a real difference.'
                },
                parseError: true
            });
        }

    } catch (error) {
        console.error('Advisor summary error:', error);
        return NextResponse.json(
            { error: 'Failed to generate summary' },
            { status: 500 }
        );
    }
}
