'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ChevronRight, HelpCircle, Search, FileText,
    Target, Mic, Sparkles, BookOpen, Download,
    ArrowRight, ChevronDown, ChevronUp, Mail, Heart, Users, Shield,
    Brain, Lightbulb, CheckCircle, TrendingUp,
    Award, Phone, MapPin, ClipboardList, MessageSquare,
    ClipboardCheck, Calendar, Upload, PenLine, Zap,
    Library, Tablet, Package
} from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface ToolGuide {
    id: string;
    name: string;
    route: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    quickStart: string[];
    tips: string[];
    faqs: FAQItem[];
}

export default function HelpCenter() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

    const tools: ToolGuide[] = [
        {
            id: 'session-notes',
            name: 'Session Notes',
            route: '/session-notes',
            icon: <FileText className="w-6 h-6" />,
            color: '#F59E0B',
            description: 'Create professional session documentation using multiple methods: record live sessions, dictate notes after the fact, upload audio files, use structured templates, or write quick notes. AI-powered transcription and note generation helps you create billing-compliant documentation faster.',
            quickStart: [
                'Go to Session Notes from the Dashboard',
                'Choose your documentation method:',
                '• Record Session - Capture live with speaker detection',
                '• Dictate Note - Speak your notes, AI generates documentation',
                '• Upload Audio - Transcribe existing recordings',
                '• Manual Entry - Use clinical template with structured fields',
                '• Quick Note - Brief updates without recording',
                'Review and edit the generated documentation',
                'Save to your notes library'
            ],
            tips: [
                'Use Record Session for live peer support meetings - it detects different speakers automatically',
                'Dictate Note is perfect for documenting right after a session while details are fresh',
                'Upload Audio works great for recordings from your phone or other devices',
                'Manual Entry ensures you hit all required fields for billing compliance',
                'Quick Note is ideal for brief check-ins or phone calls',
                'Always review AI-generated content before finalizing'
            ],
            faqs: [
                { question: 'Which method should I use?', answer: 'Record Session for live meetings, Dictate Note for post-session documentation, Upload Audio for existing recordings, Manual Entry when you need structured fields, and Quick Note for brief updates.' },
                { question: 'How does speaker detection work?', answer: 'During Record Session, the AI identifies different voices and labels them (Speaker 1, Speaker 2, etc.). You can rename speakers after recording to identify the peer specialist and participant.' },
                { question: 'What audio formats can I upload?', answer: 'Common formats like MP3, WAV, M4A, and most phone recording formats are supported.' },
                { question: 'Are my recordings stored?', answer: 'Audio is processed for transcription but not permanently stored. Only the text transcription and generated notes are saved to your account.' },
                { question: 'How long can recordings be?', answer: 'Recordings up to 2 hours are supported. Longer sessions may need to be split into parts.' }
            ]
        },
        {
            id: 'lesson-builder',
            name: 'Lesson Builder',
            route: '/lesson-builder',
            icon: <BookOpen className="w-6 h-6" />,
            color: '#1A73A8',
            description: 'Generate evidence-based peer support lessons with AI assistance. Create complete lesson plans with objectives, activities, discussion questions, and facilitator notes.',
            quickStart: [
                'Enter a topic or click "Chat with Ally" for brainstorming help',
                'Select session type (group or individual), length, and setting',
                'Choose a recovery model and group composition',
                'Click "Generate Lesson Plan" and wait 30-60 seconds',
                'Review, customize, and save to your library',
                'Download as PDF or generate a presentation'
            ],
            tips: [
                'Be specific with topics - "Managing cravings at social events" works better than just "coping skills"',
                'Use Ally to brainstorm if you\'re unsure what to teach',
                'Always review and customize generated content for your specific group',
                'Save lessons to build a reusable library over time',
                'Generate presentations for visual learners in your groups'
            ],
            faqs: [
                { question: 'How long does lesson generation take?', answer: 'Typically 30-60 seconds. If it takes longer than 2 minutes, check your internet connection and refresh the page.' },
                { question: 'Can I edit lessons after generating?', answer: 'Yes! All lessons are saved to your library where you can view and use them. For major edits, you can regenerate with adjusted parameters.' },
                { question: 'What recovery models are available?', answer: 'General/Flexible (customizable), 12-Step (traditional recovery approach), and SMART Recovery (science-based, self-empowering techniques).' }
            ]
        },
        {
            id: 'note-reviewer',
            name: 'Note Reviewer',
            route: '/note-reviewer',
            icon: <ClipboardCheck className="w-6 h-6" />,
            color: '#8B5CF6',
            description: 'Check your session notes against billing compliance standards before submission. Get instant AI-powered feedback on your documentation using the official peer support note rubric.',
            quickStart: [
                'Go to Note Reviewer from the Dashboard',
                'Paste your session note text into the input area',
                'Click "Review Note" to start the analysis',
                'View your quality score (1-5) and billable status',
                'Expand categories to see specific issues and suggestions',
                'Switch to "Improved Version" tab for an AI-corrected note',
                'Copy the improved note to use in your documentation'
            ],
            tips: [
                'Review notes BEFORE submitting to your EHR to catch issues early',
                'Pay attention to the most common flags: vague descriptions and missing client responses',
                'Use direct quotes from participants when documenting responses',
                'The AI-improved version addresses all identified issues - use it as a template',
                'Check your Review History to see patterns and track improvement over time',
                'A score of 4 or 5 means your note is billable!'
            ],
            faqs: [
                { question: 'What is the rubric based on?', answer: 'The Note Reviewer uses the official Peer Support Note Rubric used by auditors and billing departments. It scores 8 categories: Professionalism, Description of Session, Interventions Used, Social/Emotional Support, Client Response, Participation, Motivation, and Treatment Plan.' },
                { question: 'What do the quality scores mean?', answer: 'Score 5 = Billable & meets medical necessity (16/16 points). Score 4 = Billable, minor edits needed (15 points). Score 3 = Mostly billable, one issue (13-14 points). Scores 1-2 = Not billable, multiple issues.' },
                { question: 'Will this guarantee my note passes audit?', answer: 'Note Reviewer helps identify common issues, but always follow your organization\'s specific documentation requirements. Use it as a tool to improve, not as a guarantee.' },
                { question: 'Are my notes stored?', answer: 'Yes, reviews are saved to your account so you can track your improvement over time. You can view your history and delete old reviews anytime.' },
                { question: 'What makes a note "not billable"?', answer: 'Common issues include: missing or vague descriptions, no documented interventions, generic responses like "client did well" instead of specific behaviors or quotes, missing participation/motivation levels, and no treatment plan reference.' }
            ]
        },
        {
            id: 'service-planner',
            name: 'Service Planner',
            route: '/service-log',
            icon: <Calendar className="w-6 h-6" />,
            color: '#10B981',
            description: 'Plan, verify, and document your peer support services. Create audit-ready records that demonstrate services were planned and delivered as claimed - helping with billing compliance and professional accountability.',
            quickStart: [
                'Go to Service Planner from the Dashboard',
                'Click "+ Plan a Service" to schedule a new service',
                'Select service type (Individual or Group)',
                'Set the planned date, duration, and setting',
                'Optionally link a participant, lesson, or goal',
                'Add planning notes if needed',
                'Click "Schedule Service" to save',
                'Mark services as Completed and Verified after delivery'
            ],
            tips: [
                'Plan services BEFORE delivering them - this creates a time-stamped record for audits',
                'Link lessons from your library when planning group sessions',
                'Connect services to participant goals to show treatment plan alignment',
                'Use the Upcoming/Completed/Verified workflow to track service status',
                'The "This Week" counter helps you monitor your service delivery',
                'Every planned and delivered service creates documentation that supports billing claims'
            ],
            faqs: [
                { question: 'Why should I plan services in advance?', answer: 'Planning creates a time-stamped record showing the service was scheduled before delivery. This demonstrates to auditors that services were intentional and not documented retroactively.' },
                { question: 'What\'s the difference between Completed and Verified?', answer: 'Completed means you delivered the service. Verified means you\'ve confirmed the documentation is accurate and ready for billing. This two-step process ensures quality.' },
                { question: 'Can I link multiple items to one service?', answer: 'Yes! You can link a participant, a lesson from your library, and a goal all to the same service. This shows how your services connect to the participant\'s treatment plan.' },
                { question: 'What is a Service Code?', answer: 'Service codes (like H0038) are billing codes used by Medicaid and insurance. Your organization will tell you which codes to use. This field is optional but helpful for tracking.' },
                { question: 'How does this help with audits?', answer: 'Auditors look for evidence that services were planned, delivered, and documented properly. The Service Planner creates automatic timestamps showing when services were planned vs. completed, supporting your billing claims.' }
            ]
        },
        {
            id: 'recovery-goals',
            name: 'Goal Generator',
            route: '/goals/new',
            icon: <Target className="w-6 h-6" />,
            color: '#30B27A',
            description: 'Build personalized, strength-based SMART goals for participants. Create comprehensive recovery plans with action steps, barriers, coping strategies, and progress indicators.',
            quickStart: [
                'Select the goal area (housing, employment, mental health, etc.)',
                'Enter the participant\'s desired outcome in their own words',
                'Rate their current motivation level',
                'Add their strengths and potential challenges',
                'Choose a timeframe for the goal',
                'Generate a complete recovery goal with action plan'
            ],
            tips: [
                'Use the participant\'s exact words when describing what they want',
                'Include both formal supports (counselors) and natural supports (family, friends)',
                'Start with smaller, achievable goals to build momentum',
                'Review the backup plan section together - setbacks are normal',
                'Save goals to track progress over time'
            ],
            faqs: [
                { question: 'What makes a good recovery goal?', answer: 'Good goals are specific, measurable, and meaningful to the participant. They should be challenging but achievable within the timeframe.' },
                { question: 'How do I use the generated goal with participants?', answer: 'Review each section together, let them modify language to feel authentic, and focus on the action steps they\'re most excited about.' },
                { question: 'Can I create multiple goals for one participant?', answer: 'Yes! Save each goal to your library. You can create goals across different life areas and track them separately.' }
            ]
        },
        {
            id: 'peer-advisor',
            name: 'Peer Advisor',
            route: '/peer-advisor',
            icon: <MessageSquare className="w-6 h-6" />,
            color: '#00BCD4',
            description: 'Voice-based AI advisor for guidance, support, and problem-solving. Have natural conversations about challenging situations, brainstorm ideas, or practice difficult conversations.',
            quickStart: [
                'Click "Start Voice Session" to begin',
                'Speak naturally about what\'s on your mind',
                'The AI responds with empathic voice feedback',
                'Interrupt anytime - it\'s a natural conversation',
                'Click "End & Summarize" when finished',
                'Generate an AI summary with action items'
            ],
            tips: [
                'Use it to brainstorm group session ideas',
                'Practice difficult conversations before having them',
                'Process challenging participant situations',
                'Get support when feeling overwhelmed',
                'Review summaries to capture key insights',
                'Use tool suggestions to continue work in other apps'
            ],
            faqs: [
                { question: 'Is my voice conversation recorded?', answer: 'Conversations are processed in real-time but not permanently stored. Summaries you generate are saved to your library.' },
                { question: 'What can I talk about?', answer: 'Anything related to your peer support work - challenging situations, brainstorming, emotional support, skill practice, and more.' },
                { question: 'How does the AI know about peer support?', answer: 'The Peer Advisor is trained specifically for peer support contexts with trauma-informed, strength-based approaches.' }
            ]
        },
        {
            id: 'recovery-capital',
            name: 'Recovery Capital',
            route: '/recovery-capital',
            icon: <TrendingUp className="w-6 h-6" />,
            color: '#8B5CF6',
            description: 'Assess and build recovery resources across four domains: Social, Physical, Human, and Cultural Capital. Take assessments yourself or administer them with participants to identify strengths and growth areas.',
            quickStart: [
                'Choose BARC-10 (quick, 2-3 min) or MIRC-28 (comprehensive, 10-15 min)',
                'Complete the assessment honestly',
                'View scores across the four recovery capital domains',
                'Review the detailed breakdown of each domain',
                'Generate AI analysis for personalized insights',
                'Download PDF reports for your records'
            ],
            tips: [
                'BARC-10 is great for quick check-ins and progress tracking',
                'MIRC-28 provides comprehensive insights across all four domains',
                'Use results as conversation starters with participants',
                'Retake assessments periodically to track progress over time',
                'Download PDF reports to add to participant files or share with your team'
            ],
            faqs: [
                { question: 'What is recovery capital?', answer: 'Recovery capital refers to the resources, relationships, knowledge, and skills that support sustained recovery. It includes Social (relationships), Physical (health, housing), Human (skills, education), and Cultural (values, identity) domains.' },
                { question: 'Which assessment should I use?', answer: 'BARC-10 is great for quick check-ins and ongoing progress tracking. MIRC-28 provides comprehensive insights and is better for initial assessments or deeper exploration.' },
                { question: 'What is the AI analysis?', answer: 'Click "Generate AI Analysis" on any assessment to get personalized insights including strengths, growth areas, recommendations for peer support, and suggested goals with action steps.' },
                { question: 'Can I see exactly how questions were answered?', answer: 'Yes! The detailed view shows all questions organized by domain, with the exact response to each one.' }
            ]
        },
        {
            id: 'treatment-locator',
            name: 'Treatment Locator',
            route: '/resource-navigator',
            icon: <Search className="w-6 h-6" />,
            color: '#9B59B6',
            description: 'Search SAMHSA\'s national database of verified treatment facilities for mental health and substance use services. Find facilities nationwide with contact information and services offered.',
            quickStart: [
                'Select service type: Mental Health, Substance Use, or All',
                'Choose a Kentucky region or enter a ZIP code/city',
                'Set your search radius (10-100 miles)',
                'Click "Find Treatment Facilities" to search',
                'Browse verified facilities with full contact details',
                'Expand cards to see services offered and get directions'
            ],
            tips: [
                'All facilities are verified by SAMHSA and regularly updated',
                'Click facility cards to expand and see all services offered',
                'Use the "Get Directions" link to help participants navigate',
                'For immediate help, call the SAMHSA Helpline: 1-800-662-4357',
                'Always call ahead to verify current availability and services'
            ],
            faqs: [
                { question: 'How current is this information?', answer: 'SAMHSA updates their database regularly. Always call facilities to verify current services, hours, and availability before referring participants.' },
                { question: 'Can I search outside Kentucky?', answer: 'Yes! Enter any US ZIP code or city name to search nationwide. The tool works for all 50 states.' },
                { question: 'What\'s the SAMHSA Helpline?', answer: 'For immediate help finding treatment, call 1-800-662-4357. It\'s free, confidential, and available 24/7, 365 days a year.' }
            ]
        },
        {
            id: 'recovery-plans',
            name: 'Recovery Plans',
            route: '/recovery-plans',
            icon: <ClipboardList className="w-6 h-6" />,
            color: '#30B27A',
            description: 'Create comprehensive, template-driven recovery plans using a 10-domain framework. Build structured plans covering Substance Use, Emotional Wellbeing, Physical Health, Civic Engagement, Functional Wellbeing, Meaning & Purpose, Housing, Risk Taking, Recovery Experience, and Social Support. Set goals, track activities, rate importance and confidence, and record outcome measures within each domain.',
            quickStart: [
                'Go to Recovery Plans from the Dashboard or a participant\'s detail page',
                'Click "New Recovery Plan" and select a participant',
                'Choose which recovery domains to include (select from 10 available)',
                'Configure each domain: uncheck goals or activities that don\'t apply',
                'Rate importance and confidence (0-10) for each domain',
                'Click "Create Plan" to save',
                'Track progress by updating goal and activity statuses over time',
                'Record outcome measures and assessment scores within each domain'
            ],
            tips: [
                'Start with 2-3 domains rather than all 10 - you can always add more later',
                'Use the importance and confidence ratings as conversation starters with participants',
                'Customize template goals by adding your own - every participant\'s journey is unique',
                'Record outcome measures regularly to document progress over time',
                'Use "Use latest saved score" on linked instruments (PHQ-4, CDC HRQOL, FLOC-1, BARC-10, MIRC-28) to pull assessment results into the plan automatically',
                'Set a next review date on every plan - overdue reviews show on the Dashboard and the plans list',
                'Use Print / PDF to produce a signable paper copy of the plan',
                'Review plans during sessions and update statuses together with participants',
                'The progress bar on each plan card shows goal completion at a glance',
                'Plans are accessible from both the Recovery Plans page and each participant\'s detail page'
            ],
            faqs: [
                { question: 'What are the 10 recovery domains?', answer: 'Substance Use, Emotional Wellbeing, Physical Health, Civic Engagement, Functional Wellbeing, Meaning & Purpose, Housing, Risk Taking, Recovery Experience, and Social Support. Each domain includes pre-built goals, activities, and outcome measures based on clinical best practices.' },
                { question: 'Can I add custom goals and activities?', answer: 'Yes! Each domain comes with template goals and activities, but you can add custom ones during plan creation and at any time afterward. Custom items are marked so you can distinguish them from templates.' },
                { question: 'What are outcome measures?', answer: 'Outcome measures let you record specific data points within each domain, such as assessment scores (BARC-10, PHQ-4, etc.), numeric values, ratings, or yes/no indicators. For linked instruments you can take the assessment directly or pull the participant\'s latest saved score with one click.' },
                { question: 'How do signatures and locking work?', answer: 'Once both the Peer Support Specialist and the resident sign, the plan locks: goals, activities, and domains can no longer be changed (outcome measures can still be recorded). To make changes, click "Revise Plan" - this removes both signatures, and the plan must be re-acknowledged after editing.' },
                { question: 'How do I print a plan or save it as a PDF?', answer: 'Open the plan and click "Print / PDF". A print-ready document opens with the full plan, outcome measures, and signature lines, and you can print it or save it as a PDF from the print dialog.' },
                { question: 'What happens when I archive or delete a plan?', answer: 'Archiving hides the plan from the active list but keeps it on record (filter by Archived to see it). Permanent deletion is only available to supervisors, admins, and owners, and only for archived plans.' },
                { question: 'Can a participant have multiple plans?', answer: 'Yes. You might create a new plan for a new phase of recovery or when priorities shift. Previous plans remain accessible for reference.' },
                { question: 'How do importance and confidence ratings work?', answer: 'These are 0-10 scales completed with the participant. Importance measures how much a domain matters to them. Confidence measures how ready they feel to work on it. High importance + low confidence areas may need extra support.' }
            ]
        },
        {
            id: 'intake',
            name: 'Participant Intake',
            route: '/intake',
            icon: <PenLine className="w-6 h-6" />,
            color: '#0891B2',
            description: 'Complete comprehensive intake assessments for new participants using a guided 9-step wizard. Capture background demographics, emergency contacts, physical and mental health history, insurance and provider information, education and employment, social supports and safety, substance use history, and recovery history. All data is viewable and editable from the participant\'s detail page.',
            quickStart: [
                'Click "Start Intake" from a participant\'s detail page, or go to Intake from the Dashboard',
                'Select the participant and set the intake date',
                'Work through each section - all fields are optional, fill in what\'s available',
                'Use the progress bar at the top to track completion',
                'Click any completed section in the step list to jump back and edit',
                'Submit the intake on the final step',
                'View the completed intake from the participant\'s "Intake" tab',
                'Edit anytime by clicking "Edit Intake" on the Intake tab'
            ],
            tips: [
                'You don\'t have to complete every field — fill in what the participant is comfortable sharing',
                'The wizard remembers your progress, so work through it naturally during conversation',
                'Sensitive sections like DV and substance use are placed later in the flow to build rapport first',
                'Use the participant\'s own language when documenting — this builds trust and accuracy',
                'The intake is always editable, so you can update it as you learn more over time',
                'View completed intakes on the participant detail page under the "Intake" tab'
            ],
            faqs: [
                { question: 'Can I complete an intake across multiple sessions?', answer: 'Currently the intake submits as one form, but you can come back and edit it anytime after saving. Fill in what you have and update later as you learn more.' },
                { question: 'Is any field required?', answer: 'Only the participant selection is required. All other fields are optional. Document what the participant is comfortable sharing.' },
                { question: 'Where do I view a completed intake?', answer: 'Go to the participant\'s detail page and click the "Intake" tab. You\'ll see a read-only view organized by section with an "Edit Intake" button.' },
                { question: 'Can a participant have multiple intakes?', answer: 'Yes. Each intake is timestamped with a date. This supports re-admission scenarios where a new intake is needed.' },
                { question: 'Who can see the intake data?', answer: 'Intake data is visible to staff members within your organization. It follows the same access controls as other participant data.' }
            ]
        },
        {
            id: 'locations',
            name: 'Locations',
            route: '/locations',
            icon: <MapPin className="w-6 h-6" />,
            color: '#6366F1',
            description: 'Manage your organization\'s service locations, offices, and program sites. Create locations with names, addresses, and short codes, then assign participants and staff to specific locations for better organization and filtering.',
            quickStart: [
                'Go to Locations from the header navigation',
                'Click "Add Location" to create a new site',
                'Enter the location name, short name, and address',
                'Set the location type (Office, Program Site, etc.)',
                'Save the location — it will appear in participant filters and assignment dropdowns',
                'Assign participants to locations from their profile or during intake'
            ],
            tips: [
                'Use short names (e.g., "Main", "North") for compact display in lists and filters',
                'Locations appear as filter options on the Participants list page',
                'Each participant can be assigned to one primary location',
                'Add all your service sites upfront so they\'re available when creating participants',
                'Location assignments help you filter your caseload when you work across multiple sites'
            ],
            faqs: [
                { question: 'Do I need to create locations?', answer: 'Locations are optional but recommended if your organization operates from multiple sites. They help organize participants and make filtering easier.' },
                { question: 'Can I edit or delete a location?', answer: 'Yes. You can edit location details anytime. Deleting a location will remove the assignment from any linked participants.' },
                { question: 'How do I assign a participant to a location?', answer: 'When creating or editing a participant, select a location from the dropdown. You can also set locations during intake.' },
                { question: 'Can a participant be at multiple locations?', answer: 'Currently each participant has one primary location. This represents where they primarily receive services.' }
            ]
        },
        {
            id: 'lesson-library',
            name: 'Lesson Library',
            route: '/lesson-library',
            icon: <Library className="w-6 h-6" />,
            color: '#10B981',
            description: 'Browse 145 ready-made peer support lessons created by the PSS team. Filter by category, session type, and setting, preview the full facilitator guide and any presentation, then add a lesson to your own library with one click to customize and use.',
            quickStart: [
                'Go to Lesson Library from the Dashboard',
                'Filter by category, session type, or setting — or search by title',
                'Click a lesson to read the full facilitator guide and participant handout',
                'Click "View Presentation" to preview the ready-made slide deck',
                'Click "Use this lesson" to copy it into your own library',
                'Customize your copy, download a PDF, or send a survey like any saved lesson'
            ],
            tips: [
                'Use the three filters together to quickly narrow 145 lessons to the right fit',
                'Most lessons include a ready-made presentation — look for the "Presentation" badge',
                '"Use this lesson" makes your own editable copy; the shared template never changes',
                'Your cloned lesson keeps the presentation, so you can present right away',
                'The "Used X times" badge shows which lessons other facilitators rely on'
            ],
            faqs: [
                { question: 'What\'s the difference between Lesson Library and Lesson Builder?', answer: 'Lesson Builder generates a brand-new lesson with AI. Lesson Library is a curated collection of 145 ready-made lessons you can browse and reuse instantly — no waiting for generation.' },
                { question: 'Do I edit the template directly?', answer: 'No. "Use this lesson" creates your own private copy in My Lessons. Edits to your copy never affect the shared template, and other users aren\'t affected.' },
                { question: 'Can I use the presentation?', answer: 'Yes — 144 of the 145 lessons include a ready-made presentation. View it from the lesson detail page, and your cloned copy keeps the link so you can present immediately.' }
            ]
        },
        {
            id: 'group-attendance',
            name: 'Group Attendance',
            route: '/groups',
            icon: <Users className="w-6 h-6" />,
            color: '#06B6D4',
            description: 'Track group meetings and recovery events — like SMART Recovery, Recovery Dharma, or community outreach — and record who attended. Add attendees individually or capture a quick headcount, and every check-in shows up on each participant\'s record.',
            quickStart: [
                'Go to Group Attendance from the Dashboard',
                'Click "New Activity" and enter the name, type, date, time, and location',
                'Open the activity and click "Add attendee" to search and add participants',
                'Or enter a Total headcount for a quick count without names',
                'Mark each attendee Present, Excused, or No-show',
                'Edit or cancel the activity anytime from its page'
            ],
            tips: [
                'Use the bulk headcount for open drop-in groups where you just need a total',
                'Add named attendees when you want the visit to show on each participant\'s record',
                'Attendance appears automatically on the participant\'s "Activity" tab',
                'Pair this with the Kiosk so participants can check themselves in',
                'Cancelled a group? Use Delete — it leaves the list but attendance is preserved'
            ],
            faqs: [
                { question: 'What\'s the difference between a headcount and named attendance?', answer: 'A headcount is a single number for a quick total. Named attendance records each person, which links the visit to their participant record. You can use either or both on the same activity.' },
                { question: 'Who can edit or cancel an activity?', answer: 'Supervisors, admins, and owners can edit or cancel any activity. A peer specialist can edit or cancel an activity they created.' },
                { question: 'Does deleting an activity remove attendance?', answer: 'No. Deleting cancels the activity and removes it from the list, but the attendance records are preserved.' },
                { question: 'How do participants check themselves in?', answer: 'Set up the Kiosk (Dashboard → Kiosk). Participants check in on a tablet with their name and birthdate or a personal code, and it lands on the activity roster automatically.' }
            ]
        },
        {
            id: 'service-resource-log',
            name: 'Service & Resource Log',
            route: '/service-resource-log',
            icon: <Package className="w-6 h-6" />,
            color: '#F59E0B',
            description: 'Log the operational services your organization provides — transportation (rides, mileage), volunteer hours, and supplies or goods distributed (clothing, food, harm-reduction kits). One unified log with CSV export built for grant reporting.',
            quickStart: [
                'Go to Service & Resource Log from the Dashboard',
                'Pick a tab: Transportation, Volunteer, or Supplies',
                'Click "New entry" and fill in the details (participant is optional)',
                'For supplies, choose items from your catalog — totals are calculated for you',
                'Click "Export CSV" anytime to pull a report for grants',
                'Admins can click "Manage items" on the Supplies tab to curate the catalog'
            ],
            tips: [
                'Leave the participant blank for anonymous distributions, like a walk-in grabbing supplies',
                'Supplies totals are calculated from quantity × unit cost automatically',
                'Admins and owners can add or remove catalog items under "Manage items"',
                'Entries tied to a participant show on their "Activity" tab',
                'Export CSV gives you date, type, participant, totals, and item details for reporting'
            ],
            faqs: [
                { question: 'Why are these three logs combined?', answer: 'Transportation, volunteer hours, and supplies are all operational records used for grant reporting, so they live in one place with a shared export — rather than three separate tools.' },
                { question: 'Is a participant required?', answer: 'No. Participant is optional, so you can log supplies handed to an anonymous walk-in or general volunteer hours not tied to one person.' },
                { question: 'Where do the supply items come from?', answer: 'Each organization has a supplies catalog. It starts with a common set (hygiene kits, food, harm-reduction supplies, and more), and admins can add or remove items under "Manage items."' },
                { question: 'How do I report for a grant?', answer: 'Use "Export CSV" on any tab. It produces a spreadsheet with dates, types, participants, cost and hour totals, and item breakdowns you can filter and total.' }
            ]
        },
        {
            id: 'kiosk',
            name: 'Kiosk',
            route: '/settings/kiosk',
            icon: <Tablet className="w-6 h-6" />,
            color: '#8B5CF6',
            description: 'Set up a self-service check-in station on a tablet at your front desk. Participants check into today\'s groups themselves using their name and birthdate or a personal code — no staff data entry. Every organization gets its own secure kiosk link and QR code.',
            quickStart: [
                'Go to Kiosk from the Dashboard (admins and owners)',
                'Copy the kiosk link or scan the QR code with your tablet',
                'On the iPad, turn on Guided Access so it stays locked to the check-in screen',
                'Participants tap today\'s group, then enter name + birthdate or their code',
                'Find a participant\'s personal code on their record\'s "Activity" tab',
                'Rotate the link anytime if a device is lost'
            ],
            tips: [
                'Each participant\'s 8-character code is on their record — share it for faster check-in',
                'The kiosk only shows groups scheduled for today, so create the activity first',
                'Treat the kiosk link like a password; rotate it if a tablet goes missing',
                'Kiosk check-ins land on the activity roster and the participant\'s record, like staff entries',
                'Use iOS Guided Access to keep the tablet locked to the kiosk page'
            ],
            faqs: [
                { question: 'Is the kiosk safe with participant data?', answer: 'Yes. The kiosk never shows a list of participants and only confirms a first name on a successful match. It uses exact matching, is rate-limited with lockout after repeated failed attempts, and logs every attempt.' },
                { question: 'What happens if someone isn\'t found?', answer: 'The kiosk shows a generic "please see staff" message — it never reveals whether a person exists, which protects privacy. Staff can add them manually.' },
                { question: 'Where do participants get their code?', answer: 'Every participant has an 8-character code on their record\'s "Activity" tab. Staff can share it or generate a new one with the "New code" button.' },
                { question: 'Can new people sign themselves up at the kiosk?', answer: 'Not yet — the current kiosk is check-in only. Unknown visitors are directed to staff. Self-enrollment may be added in a later update.' },
                { question: 'How do I move the kiosk to a different tablet?', answer: 'Just open the kiosk link on the new tablet. To invalidate the old device, rotate the link first.' }
            ]
        }
    ];

    const generalFAQs: FAQItem[] = [
        { question: 'Is my data secure?', answer: 'Yes. All data is encrypted and stored securely. We follow HIPAA-aligned practices. Your lessons, goals, and assessments are only visible to you and your organization.' },
        { question: 'Can I use this for Medicaid documentation?', answer: 'Peer Support Studio helps you create quality content, but always follow your organization\'s specific documentation requirements and policies. The Note Reviewer tool can help you check notes before submission.' },
        { question: 'Does this replace clinical supervision?', answer: 'No. This is a tool to support your work, not replace professional supervision, training, or clinical guidance.' },
        { question: 'How do I get help if something isn\'t working?', answer: 'Contact us at jason@made180.com. We typically respond within 24 hours.' },
        { question: 'Is there a mobile app?', answer: 'Peer Support Studio works in any modern web browser on desktop, tablet, or phone. No app download needed.' },
        { question: 'Can I share content with colleagues?', answer: 'Yes! Your organization members can collaborate and share content within your workspace.' },
        { question: 'What frameworks are the assessments based on?', answer: 'Our assessments are based on established frameworks from SAMHSA, NAADAC, and IC&RC. Recovery Capital uses the BARC-10 and MIRC methodologies.' },
        { question: 'How do PDFs work?', answer: 'Most tools offer PDF download. PDFs are generated instantly and include all relevant information. They\'re great for sharing with participants, supervisors, or keeping for your records.' },
        { question: 'What is the 10-domain recovery plan framework?', answer: 'Recovery Plans use 10 evidence-informed domains: Substance Use, Emotional Wellbeing, Physical Health, Civic Engagement, Functional Wellbeing, Meaning & Purpose, Housing, Risk Taking, Recovery Experience, and Social Support. Each domain includes template goals, activities, and outcome measures.' },
        { question: 'How do Intake, Recovery Plans, and Goals work together?', answer: 'Start with Intake to capture a participant\'s background and history. Use Recovery Plans to create a structured plan across life domains. Use the Goal Generator to create specific SMART goals within those domains. All three are accessible from the participant detail page.' },
        { question: 'How do I set up locations for my organization?', answer: 'Go to Locations from the header navigation. Create locations with names and addresses. Once created, they appear in participant filters and can be assigned when creating or editing participants.' },
        { question: 'How do Group Attendance and the Kiosk work together?', answer: 'Create a group activity in Group Attendance for each meeting or event. Staff can add attendees by name, or participants can check themselves in at the Kiosk using their name and birthdate or a personal code. Either way, attendance lands on the activity roster and on each participant\'s record.' },
        { question: 'What can I track in the Service & Resource Log?', answer: 'Three things, in one place: transportation (rides and mileage), volunteer hours, and supplies or goods distributed (clothing, food, harm-reduction kits, and more). Each has a CSV export designed for grant reporting, and a participant is optional so you can log anonymous distributions.' },
        { question: 'Is the self-service Kiosk safe with participant data?', answer: 'Yes. The Kiosk never shows a list of participants — it only confirms a first name on a successful match. It uses exact matching, is rate-limited with lockout after repeated failed attempts, logs every attempt, and its link can be rotated if a device is lost.' }
    ];

    const filteredTools = tools.filter(tool =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at center, #1a8ab8 0%, #1474a0 35%, #0d5272 70%, #082d42 100%)' }}>
            {/* Header */}
            <header className="bg-white/95 backdrop-blur border-b border-white/20 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <nav className="flex items-center gap-2 text-sm">
                                <button
                                    onClick={() => router.push('/')}
                                    className="text-[#1A73A8] hover:underline"
                                >
                                    Dashboard
                                </button>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600 font-medium">Help Center</span>
                            </nav>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="py-12">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                        <HelpCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2 text-white">Help Center</h1>
                    <p className="text-white/70 max-w-xl mx-auto">
                        Learn how to make the most of Peer Support Studio's tools
                    </p>

                    {/* Search */}
                    <div className="mt-6 max-w-md mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for help..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-white/50 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 pb-8">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                            activeTab === 'overview'
                                ? 'bg-white text-[#1A73A8]'
                                : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                    >
                        Overview
                    </button>
                    {tools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => setActiveTab(tool.id)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                                activeTab === tool.id
                                    ? 'bg-white text-gray-900'
                                    : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                        >
                            {tool.name}
                        </button>
                    ))}
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                            activeTab === 'faq'
                                ? 'bg-white text-gray-900'
                                : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                    >
                        General FAQ
                    </button>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* Welcome */}
                        <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-4">
                                Welcome to Peer Support Studio
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Peer Support Studio is a comprehensive toolkit designed specifically for Peer Support Specialists. 
                                Our AI-powered tools help you create lessons, build recovery plans, complete participant intakes, set recovery goals, document sessions, find resources,
                                assess recovery capital, and review your notes for billing compliance. You can also browse a library of ready-made lessons,
                                track group attendance, log transportation, volunteer, and supply services for grant reporting, and let participants check themselves in at a front-desk kiosk - all while maintaining the
                                human-centered, trauma-informed approach that defines great peer support.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                                    <Sparkles className="w-6 h-6 text-[#1A73A8] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-[#0E2235]">AI-Powered</h3>
                                        <p className="text-sm text-gray-600">Advanced AI helps you create quality content faster</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl">
                                    <Shield className="w-6 h-6 text-[#30B27A] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-[#0E2235]">Trauma-Informed</h3>
                                        <p className="text-sm text-gray-600">All content follows trauma-informed best practices</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
                                    <Heart className="w-6 h-6 text-[#9B59B6] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-[#0E2235]">Strength-Based</h3>
                                        <p className="text-sm text-gray-600">Focus on strengths, resilience, and recovery capital</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-cyan-50 rounded-xl">
                                    <Users className="w-6 h-6 text-[#00BCD4] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-[#0E2235]">Built for Peers</h3>
                                        <p className="text-sm text-gray-600">Designed by and for Peer Support Specialists</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tools Grid */}
                        <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-[#0E2235] mb-4">Available Tools</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => setActiveTab(tool.id)}
                                        className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left group"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-white"
                                            style={{ backgroundColor: tool.color }}
                                        >
                                            {tool.icon}
                                        </div>
                                        <h3 className="font-semibold text-[#0E2235] group-hover:text-[#1A73A8] transition-colors">
                                            {tool.name}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                            {tool.description.split('.')[0]}.
                                        </p>
                                        <span className="text-sm text-[#1A73A8] font-medium mt-2 flex items-center gap-1">
                                            Learn more <ArrowRight className="w-4 h-4" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick Tips */}
                        <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-amber-500" />
                                Quick Tips for Getting Started
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Start with <strong>Session Notes</strong> to document your work efficiently</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Complete a <strong>Participant Intake</strong> to capture background and history</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Create <strong>Recovery Plans</strong> with the 10-domain framework to set goals and track progress</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Use <strong>Note Reviewer</strong> to ensure billing compliance before submission</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Build your <strong>Lesson Library</strong> for reusable group content</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Set up <strong>Locations</strong> to organize participants across your service sites</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Use <strong>Service Planner</strong> to create audit-ready records</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Assess <strong>Recovery Capital</strong> to identify participant strengths</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Browse the <strong>Lesson Library</strong> for 145 ready-made lessons to reuse</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Record <strong>Group Attendance</strong> for drop-in meetings and events</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Log transportation, volunteer hours, and supplies in the <strong>Service &amp; Resource Log</strong></p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Set up the <strong>Kiosk</strong> for self-service tablet check-in</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tool-Specific Tabs */}
                {tools.map(tool => (
                    activeTab === tool.id && (
                        <div key={tool.id} className="space-y-6">
                            {/* Tool Header */}
                            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                                <div className="flex items-start gap-4">
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                                        style={{ backgroundColor: tool.color }}
                                    >
                                        {tool.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-[#0E2235]">{tool.name}</h2>
                                        <p className="text-gray-600 mt-2">{tool.description}</p>
                                        <button
                                            onClick={() => router.push(tool.route)}
                                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
                                            style={{ backgroundColor: tool.color }}
                                        >
                                            Open {tool.name}
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Start */}
                            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-amber-500" />
                                    Quick Start Guide
                                </h3>
                                <ol className="space-y-3">
                                    {tool.quickStart.map((step, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            {!step.startsWith('•') ? (
                                                <>
                                                    <span
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                                                        style={{ backgroundColor: tool.color }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-gray-700">{step}</span>
                                                </>
                                            ) : (
                                                <span className="text-gray-600 ml-9">{step}</span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Tips */}
                            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                    <Lightbulb className="w-5 h-5 text-amber-500" />
                                    Pro Tips
                                </h3>
                                <ul className="space-y-3">
                                    {tool.tips.map((tip, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                            <span className="text-gray-700">{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Special Section for Session Notes */}
                            {tool.id === 'session-notes' && (
                                <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
                                    <h3 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-amber-600" />
                                        Documentation Methods
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="bg-white rounded-xl p-4 border border-amber-200">
                                            <div className="w-10 h-10 rounded-lg bg-[#1A73A8] flex items-center justify-center mb-3">
                                                <Mic className="w-5 h-5 text-white" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">Record Session</h4>
                                            <p className="text-sm text-gray-600 mt-1">Live recording with automatic speaker detection</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-amber-200">
                                            <div className="w-10 h-10 rounded-lg bg-[#10B981] flex items-center justify-center mb-3">
                                                <MessageSquare className="w-5 h-5 text-white" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">Dictate Note</h4>
                                            <p className="text-sm text-gray-600 mt-1">Speak your notes, AI generates documentation</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-amber-200">
                                            <div className="w-10 h-10 rounded-lg bg-[#F59E0B] flex items-center justify-center mb-3">
                                                <Upload className="w-5 h-5 text-white" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">Upload Audio</h4>
                                            <p className="text-sm text-gray-600 mt-1">Transcribe existing audio recordings</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-amber-200">
                                            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6] flex items-center justify-center mb-3">
                                                <ClipboardList className="w-5 h-5 text-white" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">Manual Entry</h4>
                                            <p className="text-sm text-gray-600 mt-1">Structured clinical template with required fields</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 border border-amber-200">
                                            <div className="w-10 h-10 rounded-lg bg-[#EC4899] flex items-center justify-center mb-3">
                                                <PenLine className="w-5 h-5 text-white" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">Quick Note</h4>
                                            <p className="text-sm text-gray-600 mt-1">Brief updates without recording</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Special Section for Service Planner */}
                            {tool.id === 'service-planner' && (
                                <div className="bg-green-50 rounded-2xl p-6 border border-green-200">
                                    <h3 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                        <ClipboardCheck className="w-5 h-5 text-green-600" />
                                        Service Workflow
                                    </h3>
                                    <div className="flex flex-col md:flex-row gap-4 items-start">
                                        <div className="flex-1 bg-white rounded-xl p-4 border border-green-200 text-center">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                                                <Calendar className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">1. Plan</h4>
                                            <p className="text-sm text-gray-600 mt-1">Schedule service in advance</p>
                                        </div>
                                        <div className="hidden md:flex items-center">
                                            <ArrowRight className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div className="flex-1 bg-white rounded-xl p-4 border border-green-200 text-center">
                                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                                                <CheckCircle className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">2. Complete</h4>
                                            <p className="text-sm text-gray-600 mt-1">Mark as delivered</p>
                                        </div>
                                        <div className="hidden md:flex items-center">
                                            <ArrowRight className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div className="flex-1 bg-white rounded-xl p-4 border border-green-200 text-center">
                                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                                                <Award className="w-5 h-5 text-green-600" />
                                            </div>
                                            <h4 className="font-semibold text-[#0E2235]">3. Verify</h4>
                                            <p className="text-sm text-gray-600 mt-1">Confirm for billing</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-4 text-center">
                                        This workflow creates time-stamped records that demonstrate services were planned and delivered as claimed.
                                    </p>
                                </div>
                            )}

                            {/* Special Section for Treatment Locator */}
                            {tool.id === 'treatment-locator' && (
                                <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                                    <h3 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                        <Phone className="w-5 h-5 text-purple-600" />
                                        SAMHSA National Helpline
                                    </h3>
                                    <p className="text-gray-700 mb-4">
                                        For immediate help finding treatment, call the SAMHSA National Helpline:
                                    </p>
                                    <div className="bg-white rounded-xl p-6 border border-purple-200 text-center">
                                        <a href="tel:1-800-662-4357" className="text-3xl font-bold text-purple-700 hover:underline">
                                            1-800-662-4357
                                        </a>
                                        <p className="text-gray-500 mt-2">Free • Confidential • 24/7 • 365 days a year</p>
                                        <p className="text-sm text-gray-600 mt-3">
                                            Also known as the Treatment Referral Routing Service, this Helpline provides information 
                                            and referrals to local treatment facilities, support groups, and community organizations.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* FAQs */}
                            <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-[#0E2235] mb-4 flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-blue-500" />
                                    Frequently Asked Questions
                                </h3>
                                <div className="space-y-2">
                                    {tool.faqs.map((faq, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setExpandedFAQ(expandedFAQ === `${tool.id}-${index}` ? null : `${tool.id}-${index}`)}
                                                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                                            >
                                                <span className="font-medium text-[#0E2235]">{faq.question}</span>
                                                {expandedFAQ === `${tool.id}-${index}` ? (
                                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                                )}
                                            </button>
                                            {expandedFAQ === `${tool.id}-${index}` && (
                                                <div className="px-4 pb-4 text-gray-600">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                ))}

                {/* General FAQ Tab */}
                {activeTab === 'faq' && (
                    <div className="space-y-6">
                        <div className="bg-white/95 backdrop-blur rounded-2xl p-6 shadow-sm">
                            <h2 className="text-2xl font-bold text-[#0E2235] mb-6">General Questions</h2>
                            <div className="space-y-2">
                                {generalFAQs.map((faq, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => setExpandedFAQ(expandedFAQ === `general-${index}` ? null : `general-${index}`)}
                                            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="font-medium text-[#0E2235]">{faq.question}</span>
                                            {expandedFAQ === `general-${index}` ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </button>
                                        {expandedFAQ === `general-${index}` && (
                                            <div className="px-4 pb-4 text-gray-600">
                                                {faq.answer}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Contact Section */}
                <div className="mt-8 bg-white/95 backdrop-blur rounded-2xl p-8 text-center">
                    <Mail className="w-12 h-12 mx-auto mb-4 text-[#1A73A8]" />
                    <h2 className="text-2xl font-bold text-[#0E2235] mb-2">Still Need Help?</h2>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Can't find what you're looking for? We're here to help!
                    </p>
                    <a
                        href="mailto:jason@made180.com"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A73A8] text-white rounded-xl font-semibold hover:bg-[#156a9a] transition-colors"
                    >
                        <Mail className="w-5 h-5" />
                        Contact Support
                    </a>
                    <p className="text-sm text-gray-500 mt-4">
                        jason@made180.com • We typically respond within 24 hours
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-white/50">
                <p>Peer Support Studio by MADe180 • Louisville, KY</p>
            </footer>
        </div>
    );
}
