'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AllySidebar from '../components/AllySidebar';
import { generateLessonPDF } from '../utils/generatePDF';
import { 
    ArrowLeft,
    ChevronRight,
    Loader2,
    Users,
    User,
    Clock,
    Building2,
    Heart,
    Sparkles,
    CheckCircle,
    Download,
    FileText,
    Presentation,
    MessageCircle,
    BookOpen
} from 'lucide-react';

function LessonBuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status: authStatus } = useSession();

    // Form state
    const [topic, setTopic] = useState('');
    const [sessionType, setSessionType] = useState<'group' | 'individual'>('group');
    const [groupSize, setGroupSize] = useState('4-8');
    const [sessionLength, setSessionLength] = useState('60');
    const [recoveryModel, setRecoveryModel] = useState('General/Flexible');
    const [settingType, setSettingType] = useState('outpatient');
    const [groupComposition, setGroupComposition] = useState('mixed');

    // UI state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedLesson, setGeneratedLesson] = useState<any>(null);
    const [error, setError] = useState('');
    const [allyResetTrigger, setAllyResetTrigger] = useState(0);

    // Check if Ally should open automatically
    const openAlly = searchParams.get('openAlly') === 'true';

    // Check for pre-filled topic from query params (e.g., from Peer Advisor)
    useEffect(() => {
        const topicParam = searchParams.get('topic');
        if (topicParam) {
            setTopic(topicParam);
        }
    }, [searchParams]);

    useEffect(() => {
        if (authStatus === 'unauthenticated') {
            router.push('/auth/signin');
        }
    }, [authStatus, router]);

    const handleTopicFromAlly = (suggestedTopic: string) => {
        setTopic(suggestedTopic);
    };

    // Format lesson plan as readable text for storage
    const formatFacilitatorGuide = (plan: any) => {
        let text = `${plan.title}\n\n`;
        text += `OVERVIEW\n${plan.overview}\n\n`;
        text += `LEARNING OBJECTIVES\n`;
        plan.objectives?.forEach((obj: string, i: number) => {
            text += `${i + 1}. ${obj}\n`;
        });
        text += `\nMATERIALS NEEDED\n`;
        plan.materials?.forEach((mat: string) => {
            text += `• ${mat}\n`;
        });
        text += `\nSESSION FLOW\n`;
        plan.activities?.forEach((act: any, i: number) => {
            text += `\n${i + 1}. ${act.name} (${act.duration})\n${act.description}\n`;
        });
        text += `\nDISCUSSION PROMPTS\n`;
        plan.discussionPrompts?.forEach((prompt: string, i: number) => {
            text += `${i + 1}. ${prompt}\n`;
        });
        text += `\nFACILITATOR NOTES\n`;
        plan.facilitatorNotes?.forEach((note: string) => {
            text += `• ${note}\n`;
        });
        text += `\nADDITIONAL RESOURCES\n`;
        plan.resources?.forEach((res: string) => {
            text += `• ${res}\n`;
        });
        return text;
    };

    const formatParticipantHandout = (plan: any) => {
        const handout = plan.participantHandout;
        if (!handout) return '';
        
        let text = `${plan.title}\nPARTICIPANT HANDOUT\n\n`;
        text += `WHAT WE'LL EXPLORE TODAY\n${handout.topicOverview}\n\n`;
        text += `KEY IDEAS\n`;
        handout.keyTakeaways?.forEach((takeaway: string) => {
            text += `• ${takeaway}\n`;
        });
        text += `\n"${handout.quote}"\n\n`;
        text += `PERSONAL REFLECTION QUESTIONS\n`;
        handout.reflectionQuestions?.forEach((q: string, i: number) => {
            text += `${i + 1}. ${q}\n\n`;
        });
        text += `SELF-CARE REMINDER\n${handout.selfCareReminder}\n\n`;
        text += `RESOURCES & SUPPORT\n`;
        handout.supportResources?.forEach((res: string) => {
            text += `• ${res}\n`;
        });
        return text;
    };

    const handleGenerateLesson = async () => {
        if (!topic.trim()) {
            setError('Please enter a topic for your lesson');
            return;
        }

        setIsGenerating(true);
        setError('');

        try {
            const response = await fetch('/api/generate-lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    sessionType,
                    groupSize: sessionType === 'group' ? groupSize : null,
                    sessionLength,
                    recoveryModel,
                    settingType,
                    groupComposition: sessionType === 'group' ? groupComposition : null,
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            setGeneratedLesson(data.lessonPlan);

            // Format as readable text before saving
            const facilitatorGuide = formatFacilitatorGuide(data.lessonPlan);
            const participantHandout = formatParticipantHandout(data.lessonPlan);

            // Save to database via API route
            const saveResponse = await fetch('/api/lessons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: data.lessonPlan.title,
                    topic,
                    facilitator_guide: facilitatorGuide,
                    participant_handout: participantHandout,
                    lesson_json: JSON.stringify(data.lessonPlan),
                    session_type: sessionType,
                    group_size: sessionType === 'group' ? groupSize : null,
                    session_length: sessionLength,
                    recovery_model: recoveryModel,
                    setting_type: settingType,
                    group_composition: sessionType === 'group' ? groupComposition : null,
                }),
            });

            if (!saveResponse.ok) {
                const saveError = await saveResponse.json();
                console.error('Error saving lesson:', saveError);
            }

        } catch (err: any) {
            setError(err.message || 'Failed to generate lesson');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartOver = () => {
        setTopic('');
        setGeneratedLesson(null);
        setError('');
        setAllyResetTrigger(prev => prev + 1);
    };

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    const settingOptions = [
        { value: 'outpatient', label: 'Outpatient' },
        { value: 'residential', label: 'Residential' },
        { value: 'jail', label: 'Jail/Correctional' },
        { value: 'hospital', label: 'Hospital/Inpatient' },
        { value: 'outreach', label: 'Community Outreach' },
        { value: 'dual-diagnosis', label: 'Dual Diagnosis' },
        { value: 'mh-only', label: 'Mental Health Only' },
        { value: 'youth', label: 'Youth/Adolescent' },
        { value: 'therapeutic-rehab', label: 'Therapeutic Rehab' },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header with Breadcrumb */}
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            
                            {/* Breadcrumb */}
                            <nav className="flex items-center gap-2 text-sm">
                                <button 
                                    onClick={() => router.push('/')}
                                    className="text-[#1A73A8] hover:underline"
                                >
                                    Dashboard
                                </button>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600 font-medium">Lesson Builder</span>
                            </nav>
                        </div>

                        {/* Lesson Library Link */}
                        <button
                            onClick={() => router.push('/library')}
                            className="flex items-center gap-2 text-[#1A73A8] hover:text-[#155a8a] text-sm font-medium transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Lesson Library
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {!generatedLesson ? (
                    <>
                        {/* Page Title */}
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold text-[#0E2235] mb-2">
                                Create a New Lesson
                            </h1>
                            <p className="text-gray-600">
                                Fill in the details below to generate an AI-powered lesson plan
                            </p>
                        </div>

                        {/* Form Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8">
                            {/* Topic Input */}
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-[#0E2235] mb-2">
                                    <Sparkles className="w-4 h-4 inline mr-1 text-[#30B27A]" />
                                    Lesson Topic *
                                </label>
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g., Building Healthy Coping Skills, Managing Triggers, etc."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent text-gray-900"
                                />
                                <p className="mt-2 text-sm text-gray-500">
                                    💡 Need help? Click "Chat with Ally" to brainstorm topics
                                </p>
                            </div>

                            {/* Session Type Toggle */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-[#0E2235] mb-3">
                                    Session Type
                                </label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setSessionType('group')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                                            sessionType === 'group'
                                                ? 'border-[#1A73A8] bg-[#1A73A8]/5 text-[#1A73A8]'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        <Users className="w-5 h-5" />
                                        <span className="font-medium">Group Session</span>
                                    </button>
                                    <button
                                        onClick={() => setSessionType('individual')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
                                            sessionType === 'individual'
                                                ? 'border-[#1A73A8] bg-[#1A73A8]/5 text-[#1A73A8]'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        <User className="w-5 h-5" />
                                        <span className="font-medium">Individual Session</span>
                                    </button>
                                </div>
                            </div>

                            {/* Settings Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                {/* Group Size (only for group sessions) */}
                                {sessionType === 'group' && (
                                    <div>
                                        <label className="block text-sm font-medium text-[#0E2235] mb-2">
                                            <Users className="w-4 h-4 inline mr-1" />
                                            Group Size
                                        </label>
                                        <select
                                            value={groupSize}
                                            onChange={(e) => setGroupSize(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                        >
                                            <option value="2-4">Small (2-4 people)</option>
                                            <option value="4-8">Medium (4-8 people)</option>
                                            <option value="8-12">Large (8-12 people)</option>
                                            <option value="12+">Extra Large (12+ people)</option>
                                        </select>
                                    </div>
                                )}

                                {/* Session Length */}
                                <div>
                                    <label className="block text-sm font-medium text-[#0E2235] mb-2">
                                        <Clock className="w-4 h-4 inline mr-1" />
                                        Session Length
                                    </label>
                                    <select
                                        value={sessionLength}
                                        onChange={(e) => setSessionLength(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                    >
                                        <option value="30">30 minutes</option>
                                        <option value="45">45 minutes</option>
                                        <option value="60">60 minutes</option>
                                        <option value="90">90 minutes</option>
                                        <option value="120">120 minutes</option>
                                    </select>
                                </div>

                                {/* Setting Type */}
                                <div>
                                    <label className="block text-sm font-medium text-[#0E2235] mb-2">
                                        <Building2 className="w-4 h-4 inline mr-1" />
                                        Setting Type
                                    </label>
                                    <select
                                        value={settingType}
                                        onChange={(e) => setSettingType(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                    >
                                        {settingOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Recovery Model */}
                                <div>
                                    <label className="block text-sm font-medium text-[#0E2235] mb-2">
                                        <Heart className="w-4 h-4 inline mr-1" />
                                        Recovery Model
                                    </label>
                                    <select
                                        value={recoveryModel}
                                        onChange={(e) => setRecoveryModel(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                    >
                                        <option value="General/Flexible">General/Flexible</option>
                                        <option value="12-Step">12-Step</option>
                                        <option value="SMART Recovery">SMART Recovery</option>
                                    </select>
                                </div>

                                {/* Group Composition (only for group sessions) */}
                                {sessionType === 'group' && (
                                    <div>
                                        <label className="block text-sm font-medium text-[#0E2235] mb-2">
                                            Group Composition
                                        </label>
                                        <select
                                            value={groupComposition}
                                            onChange={(e) => setGroupComposition(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent bg-white"
                                        >
                                            <option value="mixed">Mixed/Co-ed</option>
                                            <option value="male">Male Only</option>
                                            <option value="female">Female Only</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={handleGenerateLesson}
                                disabled={isGenerating || !topic.trim()}
                                className="w-full py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)',
                                }}
                            >
                                {isGenerating ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Generating Your Lesson...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <Sparkles className="w-5 h-5" />
                                        Generate Lesson Plan
                                    </span>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    /* Generated Lesson Display */
                    <>
                        {/* Lesson Plan Card */}
                        <div className="bg-white rounded-2xl shadow-lg border border-[#E7E9EC] p-8 mb-6">
                            <div className="flex items-start justify-between mb-6">
                                <h2 className="text-3xl font-bold text-[#0E2235]">{generatedLesson.title}</h2>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleStartOver}
                                        className="px-6 py-2.5 bg-[#30B27A] text-white rounded-lg font-medium hover:bg-[#28a06c] transition-colors"
                                    >
                                        + New Lesson
                                    </button>
                                    <button
                                        onClick={() => generateLessonPDF(generatedLesson)}
                                        className="px-6 py-2.5 bg-[#1A73A8] text-white rounded-lg font-medium hover:bg-[#156090] transition-colors"
                                    >
                                        Download PDF
                                    </button>
                                    {sessionType === 'group' && (
                                        <button
                                            onClick={() => router.push(`/session-note?topic=${encodeURIComponent(generatedLesson.title)}&intervention=${encodeURIComponent(generatedLesson.overview)}&sessionType=${sessionType}`)}
                                            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                                        >
                                            Create Note
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-8">
                                {/* Session Overview */}
                                <section>
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-3">Session Overview</h3>
                                    <p className="text-gray-700 leading-relaxed">{generatedLesson.overview}</p>
                                </section>

                                {/* Learning Objectives / Session Goals */}
                                <section>
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-3">
                                        {sessionType === 'individual' ? 'Session Goals' : 'Learning Objectives'}
                                    </h3>
                                    <ul className="space-y-2 text-gray-700">
                                        {generatedLesson.objectives?.map((obj: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-[#1A73A8] font-bold mt-1">•</span>
                                                <span>{obj}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Materials Needed */}
                                <section>
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-3">Materials Needed</h3>
                                    <ul className="space-y-2 text-gray-700">
                                        {generatedLesson.materials?.map((material: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-[#1A73A8] font-bold mt-1">•</span>
                                                <span>{material}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Session Flow */}
                                <section>
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-4">Session Flow</h3>
                                    <div className="space-y-4">
                                        {generatedLesson.activities?.map((activity: any, idx: number) => (
                                            <div key={idx} className="border-l-4 border-[#1A73A8] pl-4 py-2">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="font-semibold text-[#0E2235]">{activity.name}</h4>
                                                    <span className="text-sm text-[#1A73A8] font-medium">{activity.duration}</span>
                                                </div>
                                                <p className="text-gray-700">{activity.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Discussion Prompts */}
                                <section>
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-3">
                                        {sessionType === 'individual' ? 'Conversation Prompts' : 'Discussion Prompts'}
                                    </h3>
                                    <ul className="space-y-2 text-gray-700">
                                        {generatedLesson.discussionPrompts?.map((prompt: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-[#1A73A8] font-bold mt-1">•</span>
                                                <span>{prompt}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Facilitator Notes */}
                                <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-3">Facilitator Notes</h3>
                                    <ul className="space-y-2 text-gray-700">
                                        {generatedLesson.facilitatorNotes?.map((note: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-yellow-600 font-bold mt-1">•</span>
                                                <span>{note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Additional Resources */}
                                <section>
                                    <h3 className="text-xl font-semibold text-[#0E2235] mb-3">Additional Resources</h3>
                                    <ul className="space-y-2 text-gray-700">
                                        {generatedLesson.resources?.map((resource: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-[#1A73A8] font-bold mt-1">•</span>
                                                <span>{resource}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </div>
                        </div>

                        {/* Participant Handout */}
                        {generatedLesson.participantHandout && (
                            <div className="bg-white rounded-2xl shadow-lg border-4 border-[#1A73A8]/30 p-8">
                                <div className="bg-[#1A73A8] -mx-8 -mt-8 p-6 rounded-t-xl mb-6">
                                    <h2 className="text-2xl font-bold text-white">Participant Handout Preview</h2>
                                </div>

                                <div className="space-y-6">
                                    {/* Date Line */}
                                    <div className="border-b pb-2">
                                        <p className="text-sm text-gray-600">Date: _______________________</p>
                                    </div>

                                    {/* What We'll Explore Today */}
                                    <section>
                                        <h3 className="text-lg font-bold text-[#0E2235] mb-3">WHAT WE'LL EXPLORE TODAY</h3>
                                        <p className="text-gray-700">{generatedLesson.participantHandout.topicOverview}</p>
                                    </section>

                                    {/* Key Ideas */}
                                    <section>
                                        <h3 className="text-lg font-bold text-[#0E2235] mb-3">KEY IDEAS</h3>
                                        <ul className="space-y-2 text-gray-700">
                                            {generatedLesson.participantHandout.keyTakeaways?.map((takeaway: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="text-[#1A73A8] font-bold">•</span>
                                                    <span>{takeaway}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>

                                    {/* Quote */}
                                    <section className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                                        <p className="text-gray-800 italic text-center">
                                            "{generatedLesson.participantHandout.quote}"
                                        </p>
                                    </section>

                                    {/* Personal Reflection Questions */}
                                    <section>
                                        <h3 className="text-lg font-bold text-[#0E2235] mb-3">PERSONAL REFLECTION QUESTIONS</h3>
                                        <div className="space-y-4">
                                            {generatedLesson.participantHandout.reflectionQuestions?.map((question: string, idx: number) => (
                                                <div key={idx}>
                                                    <p className="text-gray-700 mb-2">{idx + 1}. {question}</p>
                                                    <div className="space-y-1">
                                                        <div className="border-b border-gray-300"></div>
                                                        <div className="border-b border-gray-300"></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* My Goals For This Week */}
                                    <section>
                                        <h3 className="text-lg font-bold text-[#0E2235] mb-3">MY GOALS FOR THIS WEEK</h3>
                                        <div className="space-y-2">
                                            <div className="border-b border-gray-300"></div>
                                            <div className="border-b border-gray-300"></div>
                                            <div className="border-b border-gray-300"></div>
                                        </div>
                                    </section>

                                    {/* Self-Care Reminder */}
                                    <section className="bg-[#30B27A]/10 border-2 border-[#30B27A]/30 rounded-lg p-4">
                                        <h3 className="text-sm font-bold text-[#0E2235] mb-2">SELF-CARE REMINDER:</h3>
                                        <p className="text-gray-700 text-sm">{generatedLesson.participantHandout.selfCareReminder}</p>
                                    </section>

                                    {/* Resources & Support */}
                                    <section>
                                        <h3 className="text-lg font-bold text-[#0E2235] mb-3">RESOURCES & SUPPORT</h3>
                                        <ul className="space-y-2 text-gray-700 text-sm">
                                            {generatedLesson.participantHandout.supportResources?.map((resource: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-2">
                                                    <span className="text-[#1A73A8] font-bold">•</span>
                                                    <span>{resource}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>

                                    {/* Footer Message */}
                                    <div className="text-center text-sm text-gray-600 italic border-t pt-4">
                                        Remember: Recovery is a journey, not a destination. Be patient and kind with yourself.
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Ally Sidebar */}
            <AllySidebar
                currentTopic={topic}
                sessionType={sessionType}
                settingType={settingType}
                onTopicSuggestion={handleTopicFromAlly}
                resetTrigger={allyResetTrigger}
                initialOpen={openAlly}
            />
        </div>
    );
}

export default function LessonBuilderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        }>
            <LessonBuilderContent />
        </Suspense>
    );
}
