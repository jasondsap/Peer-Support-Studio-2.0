'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ChevronRight, HelpCircle, Search, FileText,
    Target, Mic, Sparkles, BookOpen, Download,
    ArrowRight, ChevronDown, ChevronUp, Mail, Heart, Users, Shield,
    Brain, Lightbulb, CheckCircle, TrendingUp,
    Award, Phone, MapPin, ClipboardList, MessageSquare,
    ClipboardCheck, Calendar, Upload, PenLine, Zap
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
        { question: 'How do PDFs work?', answer: 'Most tools offer PDF download. PDFs are generated instantly and include all relevant information. They\'re great for sharing with participants, supervisors, or keeping for your records.' }
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
                                Our AI-powered tools help you create lessons, set recovery goals, document sessions, find resources, 
                                assess recovery capital, and review your notes for billing compliance - all while maintaining the 
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                    <p className="text-gray-600">Use <strong>Note Reviewer</strong> to ensure billing compliance before submission</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Build your <strong>Lesson Library</strong> for reusable group content</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Use <strong>Service Planner</strong> to create audit-ready records</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Try <strong>Peer Advisor</strong> when you need support or want to brainstorm</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-gray-600">Assess <strong>Recovery Capital</strong> to identify participant strengths</p>
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
