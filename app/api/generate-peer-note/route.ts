import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!
});

const PEER_NOTE_SYSTEM_PROMPT = `You are an expert peer support documentation specialist. Your task is to write professional peer support progress notes that meet billing requirements and follow best practices.

## NOTE FORMAT

Generate a narrative progress note following this exact structure:

**Service Date:** [date]
**Service Start/End Time:** [start time] - [end time]
**Service Location:** [location]
**Staff Name:** [peer specialist name]
**Client Name:** [participant name]
**Service Provided:** Peer Support (H0038)

**Summary of Service Provided:**
[Narrative paragraph - see guidelines below]

## NARRATIVE GUIDELINES

The summary should be written in third person ("Peer Specialist...") and flow naturally as 2-4 paragraphs covering:

1. **Opening/Context:** Brief statement of meeting context and what the participant shared about their current situation, concerns, or feelings. Use their actual words when possible.

2. **Interventions:** Describe what the Peer Specialist did - use active language like:
   - "Peer Specialist shared personal experience of..."
   - "Peer Specialist encouraged [name] to..."
   - "Peer Specialist helped [name] identify..."
   - "Peer Specialist accompanied [name] to..."
   - "Peer Specialist provided information about..."
   - "Peer Specialist listened to [name]'s concerns about..."

3. **Response:** Document how the participant responded to the support provided. Include:
   - Behavioral observations
   - Direct quotes when available
   - Attitude or engagement level

4. **Plan/Next Steps:** End with the plan for follow-up and any actions the participant committed to.

## IMPORTANT RULES

- Use person-first, recovery-oriented language
- Avoid clinical/diagnostic language (no "patient exhibited symptoms")
- Use ordinary human experience language
- Include specific details, not vague statements
- Reference the participant's recovery goals when relevant
- Document participation and motivation levels naturally within the narrative
- Keep professional but warm tone
- NEVER use bullet points in the summary - write in flowing paragraphs

## EXAMPLE OUTPUT

**Service Date:** 01/22/2026
**Service Start/End Time:** 9:00 AM - 10:00 AM
**Service Location:** Office
**Staff Name:** Maria Johnson, PSS
**Client Name:** Jane Doe
**Service Provided:** Peer Support (H0038)

**Summary of Service Provided:**
Peer Specialist met with Jane for a scheduled individual session at the office. Jane shared that she has been feeling anxious about upcoming family events and expressed concern about managing cravings during stressful situations. Jane stated, "I'm worried I won't be able to handle being around my family without wanting to use."

Peer Specialist listened to Jane's concerns and shared personal experience of navigating family gatherings early in recovery. Peer Specialist encouraged Jane to identify her triggers and helped her create a list of coping strategies she could use, including calling her sponsor, stepping outside for fresh air, and using breathing exercises she learned in group. Peer Specialist reminded Jane of the progress she has made over the past 60 days in developing her personalized coping strategies.

Jane responded positively to the discussion and appeared engaged throughout the session. She identified three specific strategies she felt confident using and stated, "I think having a plan will really help me feel more prepared." Jane's participation was active and her motivation to continue her recovery work remains high.

Peer Specialist and Jane scheduled their next meeting for next week to follow up on how the family event went. Jane committed to practicing her breathing exercises daily and reaching out to her sponsor before the event.`;

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            // Session Details
            participantName,
            staffName,
            dateOfService,
            startTime,
            endTime,
            location,
            sessionType,
            groupSize,
            othersPresent,
            
            // Goals
            selectedGoals,
            goalDiscussion,
            
            // Participant's Voice
            participantShared,
            directQuotes,
            
            // Strengths & Progress
            strengthsObserved,
            progressNoted,
            
            // Support Provided
            supportProvided,
            sharedExperience,
            participantResponse,
            
            // Connections
            resourcesDiscussed,
            communityConnections,
            
            // Safety
            safetyConcerns,
            safetyConcernsNote,
            
            // Billing Required Fields
            participationLevel,
            motivationLevel,
            treatmentPlanAttested,
            treatmentPlanNote,
            
            // Next Steps
            nextSteps,
            nextMeetingDate,
            nextMeetingFocus,
        } = body;

        // Build the prompt with all the form data
        const formDataSummary = `
## FORM DATA TO INCLUDE IN NOTE

**Session Details:**
- Participant Name: ${participantName || 'Not specified'}
- Staff Name: ${staffName || 'Peer Specialist'}
- Date: ${dateOfService}
- Start Time: ${startTime}
- End Time: ${endTime}
- Location: ${location}
- Session Type: ${sessionType}${sessionType === 'group' ? ` (${groupSize} participants)` : ''}
${othersPresent ? `- Others Present: ${othersPresent}` : ''}

**Recovery Goals Addressed:**
${selectedGoals && selectedGoals.length > 0 
    ? selectedGoals.map((g: any) => `- ${g.title}`).join('\n')
    : '- No specific goals selected'}
${goalDiscussion ? `\nGoal Discussion: ${goalDiscussion}` : ''}

**What Participant Shared:**
${participantShared || 'Not documented'}

**Direct Quotes from Participant:**
${directQuotes || 'None recorded'}

**Strengths Observed:**
${strengthsObserved && strengthsObserved.length > 0 
    ? strengthsObserved.join(', ')
    : 'Not documented'}

**Progress Noted:**
${progressNoted || 'Not documented'}

**Support/Interventions Provided:**
${supportProvided && supportProvided.length > 0 
    ? supportProvided.join(', ')
    : 'Not documented'}

**Shared Lived Experience:**
${sharedExperience || 'Not documented'}

**Participant's Response to Services:**
${participantResponse || 'Not documented'}

**Resources/Connections Discussed:**
${resourcesDiscussed || 'None'}
${communityConnections ? `Community connections: ${communityConnections}` : ''}

**Participation Level:** ${participationLevel || 'Not specified'}
**Motivation Level:** ${motivationLevel || 'Not specified'}

${safetyConcerns ? `**Safety Concerns:** ${safetyConcernsNote}` : ''}

**Treatment Plan:** ${treatmentPlanAttested ? 'Services align with treatment plan' : 'Not attested'}
${treatmentPlanNote ? `Treatment plan note: ${treatmentPlanNote}` : ''}

**Next Steps/Plan:**
${nextSteps || 'Not documented'}
${nextMeetingDate ? `Next meeting: ${nextMeetingDate}` : ''}
${nextMeetingFocus ? `Focus for next meeting: ${nextMeetingFocus}` : ''}
`;

        // Call OpenAI to generate the professional note
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: PEER_NOTE_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: `Please generate a professional peer support progress note using the following form data. Transform this information into a flowing narrative that meets all billing requirements.\n\n${formDataSummary}`
                }
            ],
            temperature: 0.7,
            max_tokens: 2000,
        });

        const generatedNote = completion.choices[0]?.message?.content || '';

        if (!generatedNote) {
            return NextResponse.json(
                { error: 'Failed to generate note' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            generatedNote,
            formData: body // Return original form data for saving
        });

    } catch (error) {
        console.error('Error generating peer note:', error);
        return NextResponse.json(
            { error: 'Failed to generate note', details: String(error) },
            { status: 500 }
        );
    }
}
