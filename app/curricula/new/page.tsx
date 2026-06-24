'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    ChevronRight,
    Loader2,
    Plus,
    Trash2,
    Sparkles,
    GraduationCap,
} from 'lucide-react';

interface ModuleDraft {
    module_number: number;
    title: string;
    minimum_minutes: string;
    description: string;
}

const PND_TEMPLATE = {
    name: 'Portal New Direction (PND)',
    description: 'Life skills program addressing common reentry needs and barriers across 16 modules. 21+ hours total.',
    source: 'Kentucky Department of Corrections',
    total_hours: '21',
    modules: [
        { title: 'Orientation, Getting Organized & Goals', minimum_minutes: 120 },
        { title: 'Identification', minimum_minutes: 30 },
        { title: 'Housing', minimum_minutes: 60 },
        { title: 'Transportation', minimum_minutes: 30 },
        { title: 'Family and Friend Relationships', minimum_minutes: 120 },
        { title: 'Parenting & Child Support', minimum_minutes: 120 },
        { title: 'Money & Taxes', minimum_minutes: 60 },
        { title: 'Healthy Thinking — Healthy Living', minimum_minutes: 120 },
        { title: 'Addictions & Mental Health', minimum_minutes: 120 },
        { title: 'Community/Restorative Justice', minimum_minutes: 30 },
        { title: 'Digital Literacy', minimum_minutes: 90 },
        { title: 'Education', minimum_minutes: 60 },
        { title: 'Employment', minimum_minutes: 120 },
        { title: 'Supervision, Parole Board & Community Resources', minimum_minutes: 90 },
        { title: 'Expungements and Restoration of Civil Rights', minimum_minutes: 30 },
        { title: 'Reentry Planning', minimum_minutes: 60 },
    ],
};

const blankModule = (n: number): ModuleDraft => ({ module_number: n, title: '', minimum_minutes: '', description: '' });

export default function NewCurriculumPage() {
    const router = useRouter();
    const { status: authStatus } = useSession();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('');
    const [totalHours, setTotalHours] = useState('');
    const [modules, setModules] = useState<ModuleDraft[]>([blankModule(1)]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const applyTemplate = () => {
        setName(PND_TEMPLATE.name);
        setDescription(PND_TEMPLATE.description);
        setSource(PND_TEMPLATE.source);
        setTotalHours(PND_TEMPLATE.total_hours);
        setModules(PND_TEMPLATE.modules.map((m, i) => ({
            module_number: i + 1,
            title: m.title,
            minimum_minutes: String(m.minimum_minutes),
            description: '',
        })));
    };

    const updateModule = (idx: number, field: keyof ModuleDraft, value: string) => {
        setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
    };

    const addModule = () => setModules((prev) => [...prev, blankModule(prev.length + 1)]);

    const removeModule = (idx: number) => {
        setModules((prev) => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, module_number: i + 1 })));
    };

    const handleSave = async () => {
        setError('');
        if (!name.trim()) {
            setError('Curriculum name is required.');
            return;
        }
        const cleanModules = modules
            .filter((m) => m.title.trim())
            .map((m, i) => ({
                module_number: i + 1,
                title: m.title.trim(),
                description: m.description.trim() || null,
                minimum_minutes: m.minimum_minutes ? parseInt(m.minimum_minutes, 10) : null,
                sort_order: i,
            }));

        setSaving(true);
        try {
            const res = await fetch('/api/curricula', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || null,
                    source: source.trim() || null,
                    total_hours: totalHours ? parseFloat(totalHours) : null,
                    modules: cleanModules,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Could not create curriculum.');
                setSaving(false);
                return;
            }
            router.push(`/curricula/${data.curriculum.id}`);
        } catch (e) {
            console.error(e);
            setError('Could not create curriculum.');
            setSaving(false);
        }
    };

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1A73A8]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <header className="bg-white border-b border-[#E7E9EC]">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/curricula')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <nav className="flex items-center gap-2 text-sm">
                            <button onClick={() => router.push('/curricula')} className="text-[#1A73A8] hover:underline">
                                Curriculum Manager
                            </button>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">New Curriculum</span>
                        </nav>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[#0E2235]">Create Curriculum</h1>
                    <button
                        onClick={applyTemplate}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Use PND template
                    </button>
                </div>

                {error && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6 mb-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Curriculum name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Portal New Direction (PND)"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                            <input
                                type="text"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                placeholder="e.g. Hazelden, State DOC, Internal"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total hours</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={totalHours}
                                onChange={(e) => setTotalHours(e.target.value)}
                                placeholder="e.g. 21"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Brief overview of the program"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-[#E7E9EC] p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-[#0E2235] flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-indigo-500" />
                            Modules ({modules.length})
                        </h2>
                        <button onClick={addModule} className="text-sm text-[#1A73A8] hover:underline flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add module
                        </button>
                    </div>

                    <div className="space-y-3">
                        {modules.map((m, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                                <div className="w-7 h-7 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium flex items-center justify-center mt-1">
                                    {m.module_number}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={m.title}
                                        onChange={(e) => updateModule(idx, 'title', e.target.value)}
                                        placeholder="Module title"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={m.minimum_minutes}
                                            onChange={(e) => updateModule(idx, 'minimum_minutes', e.target.value)}
                                            placeholder="Min. minutes"
                                            className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                        />
                                        <input
                                            type="text"
                                            value={m.description}
                                            onChange={(e) => updateModule(idx, 'description', e.target.value)}
                                            placeholder="Short description (optional)"
                                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73A8]"
                                        />
                                    </div>
                                </div>
                                {modules.length > 1 && (
                                    <button onClick={() => removeModule(idx)} className="p-1 text-red-400 hover:text-red-600 mt-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={() => router.push('/curricula')}
                        className="px-5 py-2.5 text-gray-600 font-medium rounded-lg hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 text-white font-medium rounded-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1A73A8 0%, #30B27A 100%)' }}
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Create Curriculum
                    </button>
                </div>
            </main>
        </div>
    );
}
