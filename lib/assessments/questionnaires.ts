/**
 * Shared questionnaire definitions for BARC-10 and MIRC-28.
 *
 * Used by:
 *   - app/assessment/[token]/* (public participant-facing form)
 *   - lib/assessment-invite/sender.ts (label resolution for email/SMS copy)
 *
 * Source of truth for question text + scoring still lives in the staff-facing
 * pages (app/assessments/barc10/page.tsx, app/assessments/mirc28/page.tsx).
 * If you edit a question there, update it here too.
 */

export type AssessmentType = 'barc10' | 'mirc28';

export const ASSESSMENT_LABELS: Record<AssessmentType, string> = {
    barc10: 'BARC-10',
    mirc28: 'MIRC-28',
};

// ─── BARC-10 ────────────────────────────────────────────────────────────────
// 10 items, 6-point Likert, no reverse-scoring. Max total 60.

export const BARC10_DOMAINS = {
    human: 'Human Capital',
    social: 'Social Capital',
    physical: 'Physical Capital',
    cultural: 'Cultural Capital',
} as const;

export type Barc10Domain = keyof typeof BARC10_DOMAINS;

export interface Barc10Question {
    id: number;
    text: string;
    domain: Barc10Domain;
}

export const BARC10_QUESTIONS: Barc10Question[] = [
    { id: 1,  text: 'There are more important things to me in life than using substances.', domain: 'human' },
    { id: 2,  text: 'In general I am happy with my life.', domain: 'human' },
    { id: 3,  text: 'I have enough energy to complete the tasks I set myself.', domain: 'human' },
    { id: 4,  text: 'I am proud of the community I live in and feel part of it.', domain: 'social' },
    { id: 5,  text: 'I get lots of support from friends.', domain: 'social' },
    { id: 6,  text: 'I regard my life as challenging and fulfilling without the need for using drugs or alcohol.', domain: 'human' },
    { id: 7,  text: 'My living space has helped to drive my recovery journey.', domain: 'physical' },
    { id: 8,  text: 'I take full responsibility for my actions.', domain: 'human' },
    { id: 9,  text: 'I am happy dealing with a range of professional people.', domain: 'cultural' },
    { id: 10, text: 'I am making good progress on my recovery journey.', domain: 'cultural' },
];

export const BARC10_RESPONSE_OPTIONS = [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Somewhat Disagree' },
    { value: 4, label: 'Somewhat Agree' },
    { value: 5, label: 'Agree' },
    { value: 6, label: 'Strongly Agree' },
];

export function scoreBarc10(answers: Record<string, number>) {
    const domains: Record<Barc10Domain, number> = { human: 0, social: 0, physical: 0, cultural: 0 };
    let total = 0;
    for (const q of BARC10_QUESTIONS) {
        const v = answers[`q${q.id}`] || 0;
        total += v;
        domains[q.domain] += v;
    }
    return { total, maxScore: 60, domains };
}

// ─── MIRC-28 ────────────────────────────────────────────────────────────────
// 28 items, 4-point Likert, includes reverse-scored items. Max total 112.

export const MIRC28_DOMAINS = {
    social: 'Social Capital',
    physical: 'Physical Capital',
    human: 'Human Capital',
    cultural: 'Cultural Capital',
} as const;

export type Mirc28Domain = keyof typeof MIRC28_DOMAINS;

export interface Mirc28Question {
    id: number;
    text: string;
    domain: Mirc28Domain;
    reverse: boolean;
}

export const MIRC28_QUESTIONS: Mirc28Question[] = [
    // Social
    { id: 1,  domain: 'social',   reverse: false, text: 'I actively support other people who are in recovery.' },
    { id: 2,  domain: 'social',   reverse: true,  text: 'My family makes my recovery more difficult.' },
    { id: 3,  domain: 'social',   reverse: false, text: 'I have at least one friend who supports my recovery.' },
    { id: 4,  domain: 'social',   reverse: false, text: 'My family supports my recovery.' },
    { id: 5,  domain: 'social',   reverse: true,  text: "Some people in my life do not think I'll make it in my recovery." },
    { id: 6,  domain: 'social',   reverse: true,  text: 'I feel alone.' },
    { id: 7,  domain: 'social',   reverse: false, text: "I feel like I'm part of a recovery community." },
    // Physical
    { id: 8,  domain: 'physical', reverse: false, text: 'My housing situation is helpful for my recovery.' },
    { id: 9,  domain: 'physical', reverse: true,  text: 'I have difficulty getting transportation.' },
    { id: 10, domain: 'physical', reverse: true,  text: 'My housing situation is unstable.' },
    { id: 11, domain: 'physical', reverse: false, text: 'I have enough money every week to buy the basic things I need.' },
    { id: 12, domain: 'physical', reverse: true,  text: 'Not having enough money makes my recovery more difficult.' },
    { id: 13, domain: 'physical', reverse: false, text: 'I can afford the care I need for my health, mental health, and recovery.' },
    { id: 14, domain: 'physical', reverse: false, text: 'I have reliable access to a phone and the internet.' },
    // Human
    { id: 15, domain: 'human',    reverse: false, text: 'I am hopeful about my future.' },
    { id: 16, domain: 'human',    reverse: true,  text: 'I have difficulty managing stress.' },
    { id: 17, domain: 'human',    reverse: true,  text: 'My physical health makes my recovery more difficult.' },
    { id: 18, domain: 'human',    reverse: true,  text: 'I struggle with my mental health.' },
    { id: 19, domain: 'human',    reverse: false, text: 'I have the skills to cope with challenges in my recovery.' },
    { id: 20, domain: 'human',    reverse: false, text: 'I am motivated to continue my recovery.' },
    { id: 21, domain: 'human',    reverse: false, text: 'I feel good about myself.' },
    // Cultural
    { id: 22, domain: 'cultural', reverse: false, text: 'I know where to go in my community if I need help with my recovery.' },
    { id: 23, domain: 'cultural', reverse: true,  text: 'My community has limited resources for people in recovery.' },
    { id: 24, domain: 'cultural', reverse: false, text: 'I participate in activities that give my life meaning.' },
    { id: 25, domain: 'cultural', reverse: true,  text: 'I lack access to recovery support services in my community.' },
    { id: 26, domain: 'cultural', reverse: false, text: 'My cultural or spiritual beliefs support my recovery.' },
    { id: 27, domain: 'cultural', reverse: false, text: 'I have a sense of purpose in my life.' },
    { id: 28, domain: 'cultural', reverse: false, text: 'I feel connected to my community.' },
];

export const MIRC28_RESPONSE_OPTIONS = [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Agree' },
    { value: 4, label: 'Strongly Agree' },
];

export function scoreMirc28(answers: Record<string, number>) {
    const domains: Record<Mirc28Domain, { raw: number; max: number; percentage: number }> = {
        social:   { raw: 0, max: 0, percentage: 0 },
        physical: { raw: 0, max: 0, percentage: 0 },
        human:    { raw: 0, max: 0, percentage: 0 },
        cultural: { raw: 0, max: 0, percentage: 0 },
    };
    let total = 0;

    for (const key of Object.keys(MIRC28_DOMAINS) as Mirc28Domain[]) {
        const qs = MIRC28_QUESTIONS.filter(q => q.domain === key);
        const max = qs.length * 4;
        let raw = 0;
        for (const q of qs) {
            const v = answers[`q${q.id}`] || 0;
            raw += q.reverse ? (5 - v) : v;
        }
        domains[key] = { raw, max, percentage: max > 0 ? Math.round((raw / max) * 100) : 0 };
        total += raw;
    }

    return { total, maxScore: 112, domains };
}
