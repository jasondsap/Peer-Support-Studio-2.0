import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const {
            goalArea,
            participantName,
            desiredOutcome,
            motivation,
            strengths,
            challenges,
            timeframe,
        } = await req.json();

        const prompt = `You are an expert Peer Support Specialist trainer helping create recovery goals. Your role is to transform a participant's desire into a comprehensive, strength-based recovery plan that a Peer Support Specialist can use in real life.

PARTICIPANT INFORMATION:
- Name: ${participantName}
- Goal Area: ${goalArea}
- Their Desired Outcome (in their words): "${desiredOutcome}"
- Motivation Level: ${motivation}/10
- Identified Strengths: ${strengths.join(', ')}
- Potential Challenges: ${challenges.join(', ')}
- Goal Timeframe: ${timeframe} days

OVERALL TASK:
Create a comprehensive, strength-based recovery goal plan in JSON format that:
- Includes a clear SMART goal
- Breaks the goal down into realistic, time-bound phases
- Uses the participant's strengths
- Anticipates real-world barriers and includes coping strategies
- Clearly defines how progress will be measured
- Is written in warm, supportive, trauma-informed language
- Includes backup plans and contingencies
- Addresses emotional support needs

GENERAL GUIDELINES (APPLY TO ALL GOAL AREAS):
1. Use STRENGTH-BASED language throughout (hopeful, empowering, person-centered).
2. Avoid clinical, deficit-focused, or judgmental language.
3. Transform vague desires into specific, measurable actions.
4. Make the SMART goal achievable within the timeframe.
5. Ensure coping strategies directly address each identified challenge.
6. Weekly actions should be concrete, small, and realistically doable.
7. Peer support activities should leverage the peer relationship (check-ins, role-plays, processing feelings, celebrating wins).
8. Progress indicators must be observable and measurable (counts, frequency, completion of tasks, etc.).
9. Always include backup plans for when things don't go as expected.
10. Address the emotional journey, not just the practical steps.

STRENGTH-BASED LANGUAGE EXAMPLES:
- Instead of "stop relapsing" → "strengthen my recovery foundation"
- Instead of "not lose my kids" → "be present and connected as a parent"
- Instead of "stop isolating" → "build meaningful connections"
- Instead of "control my anger" → "develop healthy ways to express emotions"
- Instead of "get clean" → "build a life I don't want to escape from"
- Instead of "fix my problems" → "create positive changes in my life"

PHASED PLANNING APPROACH:
Structure all plans in four phases:
1. PREPARATION (Week 1): Research, gather resources, build foundation
2. ACTION (Week 2-3): Execute main tasks, apply, engage
3. FOLLOW-THROUGH (Week 3-4): Follow up, adjust, persist
4. MAINTENANCE (Ongoing): Sustain gains, prevent setbacks

SPECIAL INSTRUCTIONS BY GOAL AREA:

=== HOUSING GOALS ===
If the goal area is "Housing", you MUST include detailed:
1. Financial Readiness: Budgeting for rent/utilities, income requirements, application fees, security deposits, savings plan
2. Document Checklist: ID, proof of income, rental history, references, voucher paperwork, background check forms
3. Transportation Plan: How to get to viewings, appointments, signings (bus routes, peer transport, rideshare)
4. Safety & Family Needs: Neighborhood safety, school access, distance to work/treatment, accessibility needs, childcare proximity
5. Backup Plan: What if applications are denied, alternative housing programs, low-barrier landlords, sober living options
6. After-Approval Steps: Reading lease, setting up utilities, move-in planning, first-30-days stability actions
7. Landlord Communication: What to say when calling, how to ask about fees, how to address background issues

=== EMPLOYMENT GOALS ===
If the goal area is "Employment", you MUST include detailed:
1. Resume & Application Prep: Resume creation/update, cover letter templates, references list, work history documentation
2. Job Search Strategy: Where to look, how many applications per week, networking opportunities, job fairs
3. Interview Preparation: Common questions, practicing responses, appropriate attire, transportation to interviews
4. Workplace Readiness: Soft skills, communication, conflict resolution, time management, workplace expectations
5. Backup Plan: Alternative job options, temp agencies, volunteer work for experience, gig economy options
6. First 90 Days Plan: Building relationships, learning the role, handling challenges, maintaining recovery while working

=== FAMILY RELATIONSHIPS GOALS ===
If the goal area is "Family Relationships", you MUST include detailed:
1. Communication Skills: I-statements, active listening, expressing needs without blame, de-escalation techniques
2. Boundary Setting: Healthy boundaries, recognizing unhealthy patterns, saying no respectfully
3. Relationship Repair Steps: Acknowledgment, amends (if appropriate), rebuilding trust over time, realistic expectations
4. Visit/Contact Planning: Supervised visit preparation (if applicable), scheduling regular contact, quality time ideas
5. Legal Considerations: Court requirements, custody arrangements, documentation for family court (if applicable)
6. Backup Plan: If family member isn't ready, maintaining hope, alternative support systems, self-care during rejection
7. Long-term Reunification Milestones: Gradual steps toward full reconnection, celebrating small wins

=== SUBSTANCE USE RECOVERY GOALS ===
If the goal area is "Substance Use Recovery", you MUST include detailed:
1. Recovery Foundation: Meeting attendance, sponsor/mentor connection, recovery community involvement
2. Trigger Management: Identifying triggers, avoiding high-risk situations, creating a trigger response plan
3. Craving Coping Skills: Specific techniques (HALT check, urge surfing, distraction, calling support)
4. Environment Changes: People, places, things to avoid or change, creating a recovery-supportive environment
5. Relapse Prevention Plan: Warning signs, who to call, what to do if slip happens, getting back on track
6. Backup Plan: If current approach isn't working, alternative treatment options, higher level of care
7. Celebrating Milestones: Recovery anniversaries, non-monetary rewards, sharing success with others

=== MENTAL HEALTH GOALS ===
If the goal area is "Mental Health", you MUST include detailed:
1. Professional Support: Connecting with therapist/counselor, medication management (if applicable), crisis resources
2. Daily Wellness Practices: Sleep hygiene, nutrition, exercise, mindfulness/meditation routines
3. Symptom Management: Recognizing warning signs, coping techniques for specific symptoms, grounding exercises
4. Support Network: Who to reach out to, peer support connections, support groups
5. Crisis Plan: Warning signs of crisis, who to call, crisis hotline numbers, safety planning
6. Backup Plan: If symptoms worsen, when to seek higher level of care, emergency contacts

=== ALL OTHER GOAL AREAS ===
For Education, Legal, Physical Health, Life Skills, Social Support, Transportation, Financial Stability:
- Apply the same phased approach (Preparation → Action → Follow-through → Maintenance)
- Include relevant preparation steps, document/resource needs, and practical considerations
- Always include backup plans and emotional support elements
- Make the plan realistic and achievable within the timeframe

RETURN FORMAT:
Return ONLY valid JSON with this exact structure and no extra commentary or markdown:

{
    "smartGoal": "A specific, measurable, achievable, relevant, time-bound goal statement (1-3 sentences). Start with: 'Over the next ${timeframe} days, ${participantName} will...'",
    
    "motivationStatement": "A personalized, inspiring statement that connects to their 'why'. Make it personal, hopeful, and emotionally grounded in their specific situation.",
    
    "phasedPlan": {
        "preparation": {
            "title": "Week 1: Preparation",
            "description": "Brief description of this phase's focus",
            "actions": ["Specific action 1", "Specific action 2", "Specific action 3", "Specific action 4"]
        },
        "action": {
            "title": "Week 2-3: Action",
            "description": "Brief description of this phase's focus",
            "actions": ["Specific action 1", "Specific action 2", "Specific action 3", "Specific action 4"]
        },
        "followThrough": {
            "title": "Week 3-4: Follow-Through",
            "description": "Brief description of this phase's focus",
            "actions": ["Specific action 1", "Specific action 2", "Specific action 3"]
        },
        "maintenance": {
            "title": "Ongoing: Maintenance",
            "description": "Brief description of maintaining gains",
            "actions": ["Specific action 1", "Specific action 2", "Specific action 3"]
        }
    },
    
    "strengthsUsed": [
        {"strength": "Strength name", "howItHelps": "How this strength will help achieve the goal"},
        {"strength": "Strength name", "howItHelps": "How this strength will help"},
        {"strength": "Strength name", "howItHelps": "How this strength will help"}
    ],
    
    "barriersAndCoping": [
        {"barrier": "Barrier 1", "copingStrategy": "Specific, actionable coping strategy"},
        {"barrier": "Barrier 2", "copingStrategy": "Specific, actionable coping strategy"},
        {"barrier": "Barrier 3", "copingStrategy": "Specific, actionable coping strategy"}
    ],
    
    "peerSupportActivities": [
        {"activity": "Activity description", "purpose": "Why this helps"},
        {"activity": "Activity description", "purpose": "Why this helps"},
        {"activity": "Activity description", "purpose": "Why this helps"},
        {"activity": "Activity description", "purpose": "Why this helps"}
    ],
    
    "progressIndicators": [
        {"indicator": "Measurable indicator", "target": "Specific target or frequency"},
        {"indicator": "Measurable indicator", "target": "Specific target or frequency"},
        {"indicator": "Measurable indicator", "target": "Specific target or frequency"},
        {"indicator": "Measurable indicator", "target": "Specific target or frequency"}
    ],
    
    "emotionalSupportPlan": {
        "anticipatedEmotions": ["Emotion 1 they may experience", "Emotion 2", "Emotion 3"],
        "copingStrategies": ["Strategy for managing difficult emotions 1", "Strategy 2", "Strategy 3"],
        "peerSupportRole": "How the peer specialist will provide emotional support throughout this journey",
        "selfCareReminders": ["Self-care reminder 1", "Self-care reminder 2", "Self-care reminder 3"]
    },
    
    "backupPlan": {
        "potentialSetbacks": ["What could go wrong 1", "What could go wrong 2"],
        "alternativeStrategies": ["Backup approach 1", "Backup approach 2", "Backup approach 3"],
        "ifThingsGetHard": "Encouraging message about persistence and not giving up",
        "emergencyResources": ["Resource 1 if needed", "Resource 2 if needed"]
    },
    
    "domainSpecific": {
        "category": "${goalArea}",
        "sections": [
            {
                "title": "Section title relevant to goal area (e.g., 'Financial Readiness' for Housing)",
                "items": ["Item 1", "Item 2", "Item 3", "Item 4"]
            },
            {
                "title": "Another relevant section title",
                "items": ["Item 1", "Item 2", "Item 3"]
            },
            {
                "title": "Another relevant section title",
                "items": ["Item 1", "Item 2", "Item 3"]
            },
            {
                "title": "Another relevant section title",
                "items": ["Item 1", "Item 2", "Item 3"]
            }
        ]
    },
    
    "successVision": "A 2-3 sentence inspiring description of what life will look like when this goal is achieved. Paint a picture of success that motivates the participant."
}

Generate the recovery goal plan now. Return ONLY the raw JSON object with no explanation, backticks, or markdown.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 4000,
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert Peer Support Specialist trainer. You always respond with valid JSON only, no markdown formatting or explanation.'
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        const message = completion.choices[0]?.message;
        if (!message?.content) {
            throw new Error('No response from AI');
        }

        let responseText = message.content.trim();
        
        // Clean up any markdown code blocks
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        let goal;
        try {
            goal = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            console.error('Response text:', responseText.substring(0, 500));
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        return NextResponse.json({ goal });

    } catch (error) {
        console.error('Error generating goal:', error);
        return NextResponse.json(
            { error: `Failed to generate goal: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
