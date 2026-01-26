import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('ANTHROPIC_API_KEY is not set');
            return NextResponse.json(
                { error: 'API key not configured' },
                { status: 500 }
            );
        }

        const {
            topic,
            sessionType,
            groupSize,
            sessionLength,
            recoveryModel,
            settingType,
            groupComposition
        } = await request.json();

        console.log('Generating lesson for topic:', topic, 'Type:', sessionType);

        const isIndividual = sessionType === 'individual';

        const prompt = isIndividual
            ? generateIndividualSessionPrompt(topic, sessionLength, recoveryModel, settingType)
            : generateGroupSessionPrompt(topic, groupSize, sessionLength, recoveryModel, settingType, groupComposition);

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
        });

        const firstBlock = message.content[0];
        if (firstBlock.type !== 'text') {
            throw new Error('Unexpected response type from AI');
        }
        const responseText = firstBlock.text;

        console.log('Raw AI response:', responseText.substring(0, 200));

        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let lessonPlan;
        try {
            lessonPlan = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            console.error('Cleaned text:', cleanedText.substring(0, 500));
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        return NextResponse.json({ lessonPlan });
    } catch (error) {
        console.error('Error generating lesson:', error);
        return NextResponse.json(
            { error: `Failed to generate lesson plan: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}

function generateGroupSessionPrompt(
    topic: string,
    groupSize: string,
    sessionLength: string,
    recoveryModel: string,
    settingType: string,
    groupComposition: string
): string {
    const settingDescriptions: Record<string, string> = {
        'outpatient': 'outpatient treatment setting',
        'residential': 'residential treatment facility',
        'jail': 'jail or correctional facility',
        'hospital': 'hospital or inpatient psychiatric unit',
        'outreach': 'community outreach or field-based setting',
        'dual-diagnosis': 'dual diagnosis program (co-occurring mental health and substance use)',
        'mh-only': 'mental health only program',
        'youth': 'youth or adolescent program',
        'therapeutic-rehab': 'therapeutic rehabilitative program for individuals with intellectual disabilities'
    };

    const compositionDescriptions: Record<string, string> = {
        'mixed': 'mixed gender/co-ed group',
        'male': 'male-only group',
        'female': 'female-only group'
    };

    return `You are an expert peer support specialist trainer. Create a comprehensive, empathetic lesson plan for a peer support GROUP session, including a participant handout.

Topic: ${topic}
Setting: ${settingDescriptions[settingType] || settingType}
Group Composition: ${compositionDescriptions[groupComposition] || groupComposition}
Group Size: ${groupSize} people
Session Length: ${sessionLength} minutes
Recovery Model: ${recoveryModel}

Create a detailed lesson plan in JSON format with the following structure:
{
  "title": "session title",
  "overview": "brief overview paragraph that acknowledges the specific setting and population",
  "objectives": ["objective 1", "objective 2", "objective 3", "objective 4"],
  "materials": ["material 1", "material 2", "material 3"],
  "activities": [
    {
      "name": "activity name",
      "duration": "X minutes",
      "description": "detailed description"
    }
  ],
  "discussionPrompts": ["prompt 1", "prompt 2", "prompt 3", "prompt 4", "prompt 5"],
  "facilitatorNotes": ["note 1", "note 2", "note 3", "note 4"],
  "resources": ["resource 1", "resource 2", "resource 3"],
  "participantHandout": {
    "topicOverview": "1-2 paragraph participant-friendly summary of what this session is about",
    "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4"],
    "reflectionQuestions": ["personal reflection question 1", "personal reflection question 2", "personal reflection question 3", "personal reflection question 4"],
    "quote": "an inspiring, recovery-focused quote or affirmation related to the topic",
    "selfCareReminder": "a brief, compassionate self-care reminder related to the topic",
    "supportResources": ["resource 1 with description", "resource 2 with description", "resource 3 with description"]
  }
}

Important guidelines:
- Use lived-experience language, not clinical/expert language
- Focus on peer-to-peer support and mutual aid
- Include 5-7 activities that fit within the ${sessionLength} minute timeframe
- Make discussion prompts open-ended and recovery-focused
- Keep facilitator notes practical and supportive
- Ensure content is trauma-informed and hopeful
- Tailor content specifically to the ${settingDescriptions[settingType]} setting
- Consider the unique needs and constraints of a ${compositionDescriptions[groupComposition]}
- Make activities appropriate for group interaction and peer learning
- Include icebreakers or warm-up activities suitable for groups
- Make it specific to ${topic}

For the participant handout:
- Write the overview in warm, welcoming language (avoid clinical jargon)
- Frame key takeaways as hopeful insights, not rules
- Make reflection questions personal and introspective (different from group discussion prompts)
- Choose a quote that's empowering and relevant to ${topic}
- Make self-care reminder specific and actionable for this topic
- Include practical, accessible resources (crisis lines, websites, local support options)

Return ONLY valid JSON, no other text.`;
}

function generateIndividualSessionPrompt(
    topic: string,
    sessionLength: string,
    recoveryModel: string,
    settingType: string
): string {
    const settingDescriptions: Record<string, string> = {
        'outpatient': 'outpatient treatment setting',
        'residential': 'residential treatment facility',
        'jail': 'jail or correctional facility',
        'hospital': 'hospital or inpatient psychiatric unit',
        'outreach': 'community outreach or field-based setting',
        'dual-diagnosis': 'dual diagnosis program (co-occurring mental health and substance use)',
        'mh-only': 'mental health only program',
        'youth': 'youth or adolescent program',
        'therapeutic-rehab': 'therapeutic rehabilitative program for individuals with intellectual disabilities'
    };

    return `You are an expert peer support specialist trainer. Create a comprehensive, empathetic session guide for a ONE-ON-ONE peer support session, including a participant handout.

Topic: ${topic}
Setting: ${settingDescriptions[settingType] || settingType}
Session Length: ${sessionLength} minutes
Recovery Model: ${recoveryModel}

Create a detailed session guide in JSON format with the following structure:
{
  "title": "session title",
  "overview": "brief overview paragraph that acknowledges the individual nature of this session and the specific setting",
  "objectives": ["personal goal 1", "personal goal 2", "personal goal 3", "personal goal 4"],
  "materials": ["material 1", "material 2", "material 3"],
  "activities": [
    {
      "name": "activity/conversation phase name",
      "duration": "X minutes",
      "description": "detailed description of what to do in this phase"
    }
  ],
  "discussionPrompts": ["conversation starter 1", "reflection question 2", "exploration prompt 3", "action-planning question 4", "closing question 5"],
  "facilitatorNotes": ["note 1", "note 2", "note 3", "note 4"],
  "resources": ["resource 1", "resource 2", "resource 3"],
  "participantHandout": {
    "topicOverview": "1-2 paragraph participant-friendly summary of what this session is about",
    "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4"],
    "reflectionQuestions": ["personal reflection question 1", "personal reflection question 2", "personal reflection question 3", "personal reflection question 4"],
    "quote": "an inspiring, recovery-focused quote or affirmation related to the topic",
    "selfCareReminder": "a brief, compassionate self-care reminder related to the topic",
    "supportResources": ["resource 1 with description", "resource 2 with description", "resource 3 with description"]
  }
}

Important guidelines for INDIVIDUAL sessions:
- Use lived-experience language, emphasizing personal connection
- Focus on one-on-one dialogue, active listening, and personal reflection
- Include 4-6 conversation phases that fit within ${sessionLength} minutes
- Make prompts more intimate and personally-focused (not group discussion questions)
- Emphasize building rapport, trust, and a safe space for sharing
- Include personal goal-setting and action planning components
- Keep facilitator notes focused on reading the individual's cues and adapting
- Ensure content is trauma-informed with extra sensitivity for individual disclosure
- Tailor content to the ${settingDescriptions[settingType]} setting
- Include activities like journaling, personal reflection exercises, skill practice
- Focus on empowerment, self-discovery, and personal agency
- Make it specific to ${topic}
- Structure should flow naturally like a conversation, not a presentation

For the participant handout:
- Write the overview in warm, welcoming language (avoid clinical jargon)
- Frame key takeaways as hopeful insights, not rules
- Make reflection questions deeply personal and introspective
- Choose a quote that's empowering and relevant to ${topic}
- Make self-care reminder specific and actionable for this topic
- Include practical, accessible resources (crisis lines, websites, local support options)

Return ONLY valid JSON, no other text.`;
}
