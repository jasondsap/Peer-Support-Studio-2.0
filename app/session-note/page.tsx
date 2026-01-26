'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, Download, FileText, Users, Clock, Calendar, Loader2 } from 'lucide-react';

type ClinicalObservation = {
    affect: string[];
    behavior: string[];
    cognition: string[];
    psychomotor: string[];
    mood: string[];
    appearance: string[];
};

type SessionNoteData = {
    // Session Info
    dateOfService: string;
    serviceCode: string;
    startTime: string;
    endTime: string;
    numberInGroup: string;
    servicesReceived: string[];
    groupTopic: string;

    // Individual Client Info (template - they'll edit for each person)
    clientName: string;
    subjectiveStatement: string;

    // Clinical Observations
    observations: ClinicalObservation;

    // Individual Assessment
    suicidalIdeation: boolean;
    homicidalIdeation: boolean;
    riskNotes: string;

    // Treatment Notes
    reactionToTreatment: string;
    stageOfChange: string;
    intervention: string;
    treatmentPlanChanges: string;
    justification: string;
};

function SessionNoteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [formData, setFormData] = useState<SessionNoteData>({
        dateOfService: new Date().toISOString().split('T')[0],
        serviceCode: '52091',
        startTime: '09:00',
        endTime: '10:00',
        numberInGroup: '',
        servicesReceived: ['psychoeducation-consumer'],
        groupTopic: searchParams.get('topic') || '',
        clientName: '',
        subjectiveStatement: '',
        observations: {
            affect: ['Appropriate'],
            behavior: ['Appropriate', 'Compliant'],
            cognition: ['Rational'],
            psychomotor: ['Normal'],
            mood: ['Happy'],
            appearance: ['Well-Groomed', 'Clean']
        },
        suicidalIdeation: false,
        homicidalIdeation: false,
        riskNotes: '',
        reactionToTreatment: '',
        stageOfChange: 'Action',
        intervention: searchParams.get('intervention') || '',
        treatmentPlanChanges: 'No changes in treatment plan.',
        justification: ''
    });

    const [isGeneratingWord, setIsGeneratingWord] = useState(false);

    // Clinical observation options
    const affectOptions = ['Angry', 'Depressed', 'Inappropriate', 'Sad', 'Appropriate', 'Elated', 'Labile', 'Superficial', 'Blunted', 'Flat', 'Pleasant', 'Worried'];

    const behaviorOptions = ['Aggressive', 'Compulsive', 'Lazy', 'Sleepy', 'Alert', 'Cooperative', 'Manipulative', 'Talkative', 'Appropriate', 'Crying', 'Non-Compliant', 'Tense/Anxious', 'Attention Seeking', 'Defensive', 'Restless', 'Withdrawn', 'Compliant'];

    const cognitionOptions = ['Bizarre', 'Disoriented', 'Obsessive', 'Tangential', 'Delusional', 'Flight of Ideas', 'Paranoid', 'Disorganized', 'Loose', 'Rational'];

    const psychomotorOptions = ['Agitated', 'Pacing', 'Rocking', 'Tics', 'Normal', 'Restless', 'Slowed', 'Tremulous'];

    const moodOptions = ['Anxious', 'Happy', 'Preoccupied', 'Withdrawn', 'Fearful', 'Irritable', 'Sad'];

    const appearanceOptions = ['Bizarre', 'Dirty', 'Neat', 'Well-Groomed', 'Clean', 'Malodorous', 'Unkempt'];

    const stageOfChangeOptions = ['Pre-contemplation', 'Contemplation', 'Preparation', 'Action', 'Maintenance'];

    const servicesReceivedOptions = [
        { value: 'individual', label: 'Individual therapy' },
        { value: 'group', label: 'Group therapy' },
        { value: 'family', label: 'Family therapy' },
        { value: 'crisis', label: 'Crisis intervention' },
        { value: 'psychoeducation-consumer', label: 'Psycho-education for consumer' },
        { value: 'psychoeducation-family', label: 'Psycho-education for family' }
    ];

    const handleObservationToggle = (category: keyof ClinicalObservation, value: string) => {
        setFormData(prev => ({
            ...prev,
            observations: {
                ...prev.observations,
                [category]: prev.observations[category].includes(value)
                    ? prev.observations[category].filter(v => v !== value)
                    : [...prev.observations[category], value]
            }
        }));
    };

    const handleServiceToggle = (value: string) => {
        setFormData(prev => ({
            ...prev,
            servicesReceived: prev.servicesReceived.includes(value)
                ? prev.servicesReceived.filter(v => v !== value)
                : [...prev.servicesReceived, value]
        }));
    };

    const generateWord = async () => {
        setIsGeneratingWord(true);
        try {
            const response = await fetch('/api/generate-session-note-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('API Error:', response.status, errorData);
                throw new Error(errorData.error || `Failed to generate Word document (Status: ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Group_Session_Note_${formData.dateOfService}_${formData.clientName || 'Template'}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error generating Word document:', error);
            alert('Failed to generate session note Word document. Please try again.');
        } finally {
            setIsGeneratingWord(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Header with Breadcrumb */}
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.back()}
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
                                <span className="text-gray-600 font-medium">Session Note</span>
                            </nav>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Page Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#30B27A]/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#30B27A]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E2235]">Group Session Note</h1>
                        <p className="text-gray-600">Complete documentation for billing and compliance</p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-[#1A73A8]/5 border border-[#1A73A8]/20 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-[#1A73A8] mb-2">📋 How to Use This Form</h3>
                    <ol className="text-sm text-gray-700 space-y-1">
                        <li><strong>1.</strong> The group topic and intervention are pre-filled from your lesson</li>
                        <li><strong>2.</strong> Fill in session details (date, time, group size)</li>
                        <li><strong>3.</strong> Complete the form as a template with typical observations</li>
                        <li><strong>4.</strong> Generate Word Document</li>
                        <li><strong>5.</strong> Use "Save As" to create individual copies for each group member</li>
                        <li><strong>6.</strong> Edit individual sections (client name, subjective, risk, reaction, justification) for each person</li>
                    </ol>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-8 space-y-8">
                    {/* SESSION INFORMATION */}
                    <section>
                        <h2 className="text-xl font-bold text-[#0E2235] mb-4 border-b-2 border-[#1A73A8] pb-2">
                            Session Information (Applies to Entire Group)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Calendar className="w-4 h-4 inline mr-1" />
                                    Date of Service *
                                </label>
                                <input
                                    type="date"
                                    value={formData.dateOfService}
                                    onChange={(e) => setFormData({ ...formData, dateOfService: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Service Code
                                </label>
                                <input
                                    type="text"
                                    value={formData.serviceCode}
                                    onChange={(e) => setFormData({ ...formData, serviceCode: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Users className="w-4 h-4 inline mr-1" />
                                    Number in Group *
                                </label>
                                <input
                                    type="number"
                                    value={formData.numberInGroup}
                                    onChange={(e) => setFormData({ ...formData, numberInGroup: e.target.value })}
                                    placeholder="e.g. 8"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    Start Time *
                                </label>
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    <Clock className="w-4 h-4 inline mr-1" />
                                    End Time *
                                </label>
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8]"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Services Received
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {servicesReceivedOptions.map(service => (
                                    <label key={service.value} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.servicesReceived.includes(service.value)}
                                            onChange={() => handleServiceToggle(service.value)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{service.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Group Topic (Pre-filled from lesson)
                            </label>
                            <input
                                type="text"
                                value={formData.groupTopic}
                                onChange={(e) => setFormData({ ...formData, groupTopic: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] bg-[#1A73A8]/5"
                            />
                        </div>
                    </section>

                    {/* CLIENT INFORMATION */}
                    <section className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2 flex items-center gap-2">
                            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm">EDIT FOR EACH CLIENT</span>
                            Client Information
                        </h2>
                        <p className="text-sm text-red-600 mb-4">Edit this section for each individual group member</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Client Name (Edit for each person)
                                </label>
                                <input
                                    type="text"
                                    value={formData.clientName}
                                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                    placeholder="Leave blank for template"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subjective Statement (Edit for each person)
                                </label>
                                <textarea
                                    value={formData.subjectiveStatement}
                                    onChange={(e) => setFormData({ ...formData, subjectiveStatement: e.target.value })}
                                    placeholder="Example: [Client name] stated, 'I learned some new coping skills today that I can use when I feel stressed.'"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* CLINICAL OBSERVATIONS */}
                    <section>
                        <h2 className="text-xl font-bold text-[#0E2235] mb-4 border-b-2 border-[#1A73A8] pb-2">
                            Clinical Observations (Typical for Group)
                        </h2>

                        {/* Affect */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                AFFECT
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {affectOptions.map(option => (
                                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.observations.affect.includes(option)}
                                            onChange={() => handleObservationToggle('affect', option)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Behavior */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                BEHAVIOR
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {behaviorOptions.map(option => (
                                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.observations.behavior.includes(option)}
                                            onChange={() => handleObservationToggle('behavior', option)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Cognition */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                COGNITION
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {cognitionOptions.map(option => (
                                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.observations.cognition.includes(option)}
                                            onChange={() => handleObservationToggle('cognition', option)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Psychomotor */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                PSYCHOMOTOR ACTIVITY
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {psychomotorOptions.map(option => (
                                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.observations.psychomotor.includes(option)}
                                            onChange={() => handleObservationToggle('psychomotor', option)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Mood */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                MOOD
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {moodOptions.map(option => (
                                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.observations.mood.includes(option)}
                                            onChange={() => handleObservationToggle('mood', option)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Appearance */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                APPEARANCE
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {appearanceOptions.map(option => (
                                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.observations.appearance.includes(option)}
                                            onChange={() => handleObservationToggle('appearance', option)}
                                            className="rounded text-[#1A73A8] focus:ring-[#1A73A8]"
                                        />
                                        <span className="text-sm text-gray-700">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* RISK ASSESSMENT */}
                    <section className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2 flex items-center gap-2">
                            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm">EDIT FOR EACH CLIENT</span>
                            Risk Assessment
                        </h2>
                        <p className="text-sm text-red-600 mb-4">Edit this section for each individual group member</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Suicidal Ideation
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="suicidalIdeation"
                                                checked={!formData.suicidalIdeation}
                                                onChange={() => setFormData({ ...formData, suicidalIdeation: false })}
                                                className="text-[#1A73A8]"
                                            />
                                            <span className="text-sm">No</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="suicidalIdeation"
                                                checked={formData.suicidalIdeation}
                                                onChange={() => setFormData({ ...formData, suicidalIdeation: true })}
                                                className="text-red-600"
                                            />
                                            <span className="text-sm">Yes</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Homicidal Ideation
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="homicidalIdeation"
                                                checked={!formData.homicidalIdeation}
                                                onChange={() => setFormData({ ...formData, homicidalIdeation: false })}
                                                className="text-[#1A73A8]"
                                            />
                                            <span className="text-sm">No</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="homicidalIdeation"
                                                checked={formData.homicidalIdeation}
                                                onChange={() => setFormData({ ...formData, homicidalIdeation: true })}
                                                className="text-red-600"
                                            />
                                            <span className="text-sm">Yes</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Risk Notes (Edit for each person)
                                </label>
                                <textarea
                                    value={formData.riskNotes}
                                    onChange={(e) => setFormData({ ...formData, riskNotes: e.target.value })}
                                    placeholder="[Client name] reported no signs or symptoms relating to suicidal or homicidal ideation during group participation."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* TREATMENT NOTES SECTION */}
                    <section className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-[#0E2235] mb-2 flex items-center gap-2">
                            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm">EDIT FOR EACH CLIENT</span>
                            Treatment Notes
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reaction to Treatment (Edit for each person)
                                </label>
                                <textarea
                                    value={formData.reactionToTreatment}
                                    onChange={(e) => setFormData({ ...formData, reactionToTreatment: e.target.value })}
                                    placeholder="[Client name]'s attitude/reaction to treatment appears good as evidenced by actively participating in today's group session and by working on treatment plan goals/objectives."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Stage of Change
                                </label>
                                <select
                                    value={formData.stageOfChange}
                                    onChange={(e) => setFormData({ ...formData, stageOfChange: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                >
                                    {stageOfChangeOptions.map(stage => (
                                        <option key={stage} value={stage}>{stage}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Intervention (Pre-filled from lesson)
                                </label>
                                <textarea
                                    value={formData.intervention}
                                    onChange={(e) => setFormData({ ...formData, intervention: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A73A8] bg-[#1A73A8]/5"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Treatment Plan Changes
                                </label>
                                <textarea
                                    value={formData.treatmentPlanChanges}
                                    onChange={(e) => setFormData({ ...formData, treatmentPlanChanges: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Justification/Need to Continue Treatment (Edit for each person)
                                </label>
                                <textarea
                                    value={formData.justification}
                                    onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                                    placeholder="[Client name] will return for intensive outpatient group services to continue building the necessary coping skills to maintain sobriety."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Generate Button - Only Word Document */}
                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <button
                            onClick={() => router.back()}
                            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={generateWord}
                            disabled={isGeneratingWord || !formData.numberInGroup || !formData.dateOfService}
                            className="px-8 py-3 bg-[#30B27A] text-white rounded-lg font-semibold hover:bg-[#28a06c] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {isGeneratingWord ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Generate Word Document
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function GroupSessionNote() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#1A73A8] mx-auto mb-4" />
                    <p className="text-gray-600">Loading session note form...</p>
                </div>
            </div>
        }>
            <SessionNoteContent />
        </Suspense>
    );
}
