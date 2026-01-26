'use client';

import { useState } from 'react';
import { X, FileText, Search, Loader2 } from 'lucide-react';

interface Lesson {
    id: string;
    title: string;
    topic: string;
    created_at: string;
}

interface LessonSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (lessonId: string) => void;
    lessons: Lesson[];
    actionLabel: string;
}

export default function LessonSelectorModal({
    isOpen,
    onClose,
    onSelect,
    lessons,
    actionLabel,
}: LessonSelectorModalProps) {
    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredLessons = lessons.filter(lesson => 
        (lesson.title || lesson.topic).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleContinue = () => {
        if (selectedLessonId) {
            onSelect(selectedLessonId);
            setSelectedLessonId(null);
            setSearchQuery('');
        }
    };

    const handleClose = () => {
        setSelectedLessonId(null);
        setSearchQuery('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-[#0E2235]">My Saved Lessons</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search lessons..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A73A8] focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                {/* Lessons List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <div className="col-span-1"></div>
                        <div className="col-span-8">Name</div>
                        <div className="col-span-3">Modified</div>
                    </div>

                    {/* Lessons */}
                    {filteredLessons.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>{searchQuery ? 'No lessons match your search' : 'No lessons available'}</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLessons.map((lesson) => (
                                <button
                                    key={lesson.id}
                                    onClick={() => setSelectedLessonId(lesson.id)}
                                    className={`w-full grid grid-cols-12 gap-4 px-4 py-3 rounded-lg transition-colors items-center text-left ${
                                        selectedLessonId === lesson.id
                                            ? 'bg-[#1A73A8]/10 ring-2 ring-[#1A73A8]'
                                            : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="col-span-1">
                                        <div 
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                selectedLessonId === lesson.id
                                                    ? 'border-[#1A73A8] bg-[#1A73A8]'
                                                    : 'border-gray-300'
                                            }`}
                                        >
                                            {selectedLessonId === lesson.id && (
                                                <div className="w-2 h-2 bg-white rounded-full" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-8 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-[#0E2235] truncate">
                                                {lesson.title || lesson.topic}
                                            </p>
                                            <p className="text-xs text-gray-400">Lesson</p>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-sm text-gray-500">
                                        {formatDate(lesson.created_at)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
                    <p className="text-sm text-gray-500">
                        {filteredLessons.length} lesson{filteredLessons.length !== 1 ? 's' : ''} available
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleContinue}
                            disabled={!selectedLessonId}
                            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                                selectedLessonId
                                    ? 'bg-[#1A73A8] text-white hover:bg-[#156090]'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {actionLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
