'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
    Save, X, ArrowLeft, Calendar, User, Tag,
    Loader2, Check, Clock, FileText, Trash2,
    ChevronDown, Search, StickyNote, Eye, Edit3,
    Bold, Italic, List, Link2, Quote
} from 'lucide-react';

interface QuickNote {
    id: string;
    metadata: {
        title?: string;
        date: string;
        sessionType: string;
        tags?: string[];
    };
    pss_note: {
        content: string;
        isQuickNote: boolean;
    };
    pss_summary: string;
    participant_name?: string;
    participant_id?: string;
    created_at: string;
}

interface Participant {
    id: string;
    first_name: string;
    last_name: string;
}

interface QuickNoteEditorProps {
    onBack: () => void;
    onSaved?: (note: QuickNote) => void;
}

// Simple Markdown Preview Component
function MarkdownPreview({ content }: { content: string }) {
    // Basic markdown rendering - converts common patterns
    const renderMarkdown = (text: string) => {
        if (!text) return '';
        
        let html = text
            // Headers
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Lists
            .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
            .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank">$1</a>')
            // Blockquotes
            .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600">$1</blockquote>')
            // Line breaks
            .replace(/\n/g, '<br />');
        
        return html;
    };

    return (
        <div 
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
    );
}

// Markdown Toolbar Component
function MarkdownToolbar({ onInsert }: { onInsert: (before: string, after: string) => void }) {
    return (
        <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <button
                type="button"
                onClick={() => onInsert('**', '**')}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => onInsert('*', '*')}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button
                type="button"
                onClick={() => onInsert('\n- ', '')}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                title="List"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => onInsert('[', '](url)')}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                title="Link"
            >
                <Link2 className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => onInsert('\n> ', '')}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                title="Quote"
            >
                <Quote className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function QuickNoteEditor({ onBack, onSaved }: QuickNoteEditorProps) {
    const { data: session } = useSession();
    
    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionType, setSessionType] = useState('general');
    const [selectedParticipant, setSelectedParticipant] = useState<string>('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    
    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
    const [participantSearch, setParticipantSearch] = useState('');
    
    // Recent notes state
    const [recentNotes, setRecentNotes] = useState<QuickNote[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(true);
    const [selectedNote, setSelectedNote] = useState<QuickNote | null>(null);

    // Textarea ref for markdown toolbar
    const textareaRef = useState<HTMLTextAreaElement | null>(null);

    // Fetch participants
    useEffect(() => {
        fetchParticipants();
        fetchRecentNotes();
    }, []);

    const fetchParticipants = async () => {
        try {
            const response = await fetch('/api/participants');
            const data = await response.json();
            if (data.participants) {
                setParticipants(data.participants);
            }
        } catch (error) {
            console.error('Error fetching participants:', error);
        }
    };

    const fetchRecentNotes = async () => {
        setIsLoadingNotes(true);
        try {
            const response = await fetch('/api/session-notes?source=quick_note&limit=10');
            const data = await response.json();
            if (data.notes) {
                setRecentNotes(data.notes);
            }
        } catch (error) {
            console.error('Error fetching recent notes:', error);
        } finally {
            setIsLoadingNotes(false);
        }
    };

    const handleInsertMarkdown = (before: string, after: string) => {
        const textarea = document.getElementById('quick-note-content') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
        
        setContent(newContent);
        
        // Set cursor position after insertion
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + before.length + selectedText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        if (!content.trim()) {
            setError('Please enter some content for your note');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Create plain text summary for Service Log display
            const plainTextSummary = content
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/^#+\s/gm, '')
                .replace(/^[-*]\s/gm, '• ')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^>\s/gm, '')
                .substring(0, 500);

            const noteData = {
                metadata: {
                    title: title || `Quick Note - ${new Date(date).toLocaleDateString()}`,
                    date,
                    sessionType,
                    tags,
                    isQuickNote: true,
                },
                pss_note: {
                    content,
                    isQuickNote: true,
                    sessionOverview: title || 'Quick Note',
                    topicsDiscussed: tags,
                    strengthsObserved: [],
                    recoverySupportProvided: [],
                    actionItems: [],
                    followUpNeeded: [],
                },
                pss_summary: plainTextSummary,
                source: 'quick_note',
                participant_id: selectedParticipant || null,
                organization_id: (session as any)?.currentOrganization?.id || null,
            };

            const response = await fetch('/api/session-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save note');
            }

            setSaveSuccess(true);
            
            // Refresh recent notes
            fetchRecentNotes();
            
            // Call onSaved callback
            if (onSaved && data.note) {
                onSaved(data.note);
            }

            // Reset form after short delay
            setTimeout(() => {
                setTitle('');
                setContent('');
                setTags([]);
                setSelectedParticipant('');
                setSaveSuccess(false);
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to save note');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            const response = await fetch(`/api/session-notes/${noteId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setRecentNotes(recentNotes.filter(n => n.id !== noteId));
                if (selectedNote?.id === noteId) {
                    setSelectedNote(null);
                }
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const filteredParticipants = participants.filter(p => 
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(participantSearch.toLowerCase())
    );

    const SESSION_TYPES = [
        { value: 'general', label: 'General Note' },
        { value: 'individual', label: 'Individual Session' },
        { value: 'group', label: 'Group Session' },
        { value: 'check-in', label: 'Check-in' },
        { value: 'phone', label: 'Phone Call' },
        { value: 'outreach', label: 'Outreach' },
        { value: 'crisis', label: 'Crisis' },
    ];

    const QUICK_TAGS = [
        'Follow-up needed', 'Housing', 'Employment', 'Transportation',
        'Mental Health', 'Substance Use', 'Family', 'Medical', 'Legal'
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to options
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Editor */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <StickyNote className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Quick Note</h2>
                                    <p className="text-purple-100 text-sm">Capture thoughts, updates, or observations</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title (optional)
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Give your note a title..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>

                            {/* Metadata Row */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type
                                    </label>
                                    <select
                                        value={sessionType}
                                        onChange={(e) => setSessionType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    >
                                        {SESSION_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <User className="w-4 h-4 inline mr-1" />
                                        Participant (optional)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-purple-400"
                                    >
                                        <span className={selectedParticipant ? 'text-gray-900' : 'text-gray-400'}>
                                            {selectedParticipant 
                                                ? participants.find(p => p.id === selectedParticipant)?.first_name + ' ' + participants.find(p => p.id === selectedParticipant)?.last_name
                                                : 'Select...'
                                            }
                                        </span>
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </button>

                                    {showParticipantDropdown && (
                                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                            <div className="p-2 border-b">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={participantSearch}
                                                        onChange={(e) => setParticipantSearch(e.target.value)}
                                                        placeholder="Search..."
                                                        className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedParticipant('');
                                                    setShowParticipantDropdown(false);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-gray-500"
                                            >
                                                No participant (general note)
                                            </button>
                                            {filteredParticipants.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedParticipant(p.id);
                                                        setShowParticipantDropdown(false);
                                                        setParticipantSearch('');
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2"
                                                >
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    {p.first_name} {p.last_name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Tag className="w-4 h-4 inline mr-1" />
                                    Tags
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {QUICK_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => {
                                                if (tags.includes(tag)) {
                                                    handleRemoveTag(tag);
                                                } else {
                                                    setTags([...tags, tag]);
                                                }
                                            }}
                                            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                                tags.includes(tag)
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                        placeholder="Add custom tag..."
                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddTag}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Content Editor */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        <FileText className="w-4 h-4 inline mr-1" />
                                        Note Content
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowPreview(!showPreview)}
                                        className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                                    >
                                        {showPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        {showPreview ? 'Edit' : 'Preview'}
                                    </button>
                                </div>

                                {showPreview ? (
                                    <div className="min-h-[200px] p-4 border border-gray-300 rounded-lg bg-gray-50">
                                        {content ? (
                                            <MarkdownPreview content={content} />
                                        ) : (
                                            <p className="text-gray-400 italic">Nothing to preview yet...</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent">
                                        <MarkdownToolbar onInsert={handleInsertMarkdown} />
                                        <textarea
                                            id="quick-note-content"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="Start typing your note... (Markdown supported)"
                                            rows={8}
                                            className="w-full px-4 py-3 border-0 focus:ring-0 resize-none"
                                        />
                                    </div>
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    Supports Markdown: **bold**, *italic*, - lists, [links](url), &gt; quotes
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                                    <X className="w-5 h-5" />
                                    {error}
                                </div>
                            )}

                            {/* Success Message */}
                            {saveSuccess && (
                                <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                                    <Check className="w-5 h-5" />
                                    Note saved successfully!
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !content.trim()}
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Quick Note
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent Quick Notes Panel */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-24">
                        <div className="bg-gray-50 p-4 border-b">
                            <h3 className="font-semibold text-[#0E2235] flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                Recent Quick Notes
                            </h3>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto">
                            {isLoadingNotes ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                                </div>
                            ) : recentNotes.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm">No quick notes yet</p>
                                    <p className="text-xs text-gray-400">Your saved notes will appear here</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {recentNotes.map(note => (
                                        <div
                                            key={note.id}
                                            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                                                selectedNote?.id === note.id ? 'bg-purple-50' : ''
                                            }`}
                                            onClick={() => setSelectedNote(selectedNote?.id === note.id ? null : note)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-[#0E2235] text-sm truncate">
                                                        {note.metadata?.title || 'Untitled Note'}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {formatDate(note.created_at)}
                                                    </p>
                                                    {note.participant_name && (
                                                        <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {note.participant_name}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteNote(note.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Expanded content */}
                                            {selectedNote?.id === note.id && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    {(note.metadata?.tags?.length ?? 0) > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {note.metadata.tags.map((tag: string, i: number) => (
                                                                <span
                                                                    key={i}
                                                                    className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="text-sm text-gray-600 prose prose-sm max-w-none">
                                                        <MarkdownPreview content={note.pss_note?.content || note.pss_summary || ''} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
