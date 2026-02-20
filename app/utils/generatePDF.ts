import jsPDF from 'jspdf';

// ========================================
// LESSON PDF TYPES & FUNCTION
// ========================================

interface Activity {
    name: string;
    duration: string;
    description: string;
}

interface ParticipantHandout {
    topicOverview: string;
    keyTakeaways: string[];
    reflectionQuestions: string[];
    quote: string;
    selfCareReminder: string;
    supportResources: string[];
}

interface SourceCitation {
    doc: string;
    section: string;
    pages?: string;
    usage?: string;
}

interface LessonPlan {
    title: string;
    overview: string;
    objectives: string[];
    materials: string[];
    activities: Activity[];
    discussionPrompts: string[];
    facilitatorNotes: string[];
    resources: string[];
    participantHandout: ParticipantHandout;
    sourcesCited?: SourceCitation[];
}

export function generateLessonPDF(lessonPlan: LessonPlan) {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;
    const maxWidth = 170;

    // Brand colors
    const studioBlue = { r: 26, g: 115, b: 168 }; // #1A73A8
    const recoveryGreen = { r: 48, g: 178, b: 122 }; // #30B27A

    const addText = (text: string, fontSize: number = 11, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        const lines = doc.splitTextToSize(text, maxWidth);

        lines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
        });
    };

    const addSpace = (space: number = 5) => {
        yPosition += space;
    };

    const addSection = (title: string, content: string[] | string) => {
        addSpace(5);
        addText(title, 14, true);
        addSpace(3);

        if (Array.isArray(content)) {
            content.forEach((item, index) => {
                addText(`${index + 1}. ${item}`, 11);
            });
        } else {
            addText(content, 11);
        }
    };

    // ========================================
    // FACILITATOR GUIDE
    // ========================================

    // Header with gradient effect (using Studio Blue)
    doc.setFillColor(studioBlue.r, studioBlue.g, studioBlue.b);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Peer Support Studio - Facilitator Guide', margin, 20);
    doc.setTextColor(0, 0, 0);
    yPosition = 45;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    addText(lessonPlan.title, 18, true);

    // Overview
    addSection('Session Overview', lessonPlan.overview);

    // Learning Objectives
    addSection('Learning Objectives', lessonPlan.objectives);

    // Materials Needed
    addSection('Materials Needed', lessonPlan.materials);

    // Session Flow
    addSpace(5);
    addText('Session Flow', 14, true);
    addSpace(3);
    lessonPlan.activities.forEach((activity, index) => {
        if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${activity.name} (${activity.duration})`, margin, yPosition);
        yPosition += lineHeight;
        doc.setFont('helvetica', 'normal');
        addText(activity.description, 11);
        addSpace(2);
    });

    // Discussion Prompts
    addSection('Discussion Prompts', lessonPlan.discussionPrompts);

    // Facilitator Notes
    addSpace(5);
    doc.setFillColor(254, 243, 199); // Yellow background
    doc.rect(margin - 5, yPosition - 5, maxWidth + 10, 10, 'F');
    addText('Facilitator Notes', 14, true);
    addSpace(3);
    lessonPlan.facilitatorNotes.forEach((note) => {
        addText(`- ${note}`, 11);
    });

    // Resources
    addSection('Additional Resources', lessonPlan.resources);

    // Evidence Sources (if available from RAG)
    if (lessonPlan.sourcesCited && lessonPlan.sourcesCited.length > 0) {
        addSpace(8);

        // Divider line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, margin + maxWidth, yPosition);
        yPosition += 8;

        // Section header with green accent
        doc.setFillColor(recoveryGreen.r, recoveryGreen.g, recoveryGreen.b);
        doc.rect(margin - 5, yPosition - 5, 3, 10, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(recoveryGreen.r, recoveryGreen.g, recoveryGreen.b);
        doc.text('Evidence Sources', margin + 2, yPosition);
        yPosition += lineHeight;
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('This lesson was built using the following authoritative sources.', margin, yPosition);
        yPosition += lineHeight;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        lessonPlan.sourcesCited.forEach((source) => {
            if (yPosition > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
            }

            let citation = `${source.doc}, ${source.section}`;
            if (source.pages) citation += ` — pp. ${source.pages}`;
            if (source.usage) citation += ` — ${source.usage}`;

            doc.setTextColor(recoveryGreen.r, recoveryGreen.g, recoveryGreen.b);
            doc.text('✓', margin, yPosition);
            doc.setTextColor(0, 0, 0);
            doc.text(citation, margin + 8, yPosition);
            yPosition += lineHeight - 1;
        });
    }

    // ========================================
    // PARTICIPANT HANDOUT (NEW PAGE)
    // ========================================

    doc.addPage();
    yPosition = 20;

    // Participant Handout Header (using Studio Blue)
    doc.setFillColor(studioBlue.r, studioBlue.g, studioBlue.b);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Participant Handout', margin, 15);
    doc.setFontSize(16);
    doc.text(lessonPlan.title, margin, 28);
    doc.setTextColor(0, 0, 0);
    yPosition = 50;

    // Date field
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Date: _______________________', margin, yPosition);
    yPosition += 15;

    // Topic Overview
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text("WHAT WE'LL EXPLORE TODAY", margin, yPosition);
    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    addText(lessonPlan.participantHandout.topicOverview, 11);

    // Key Takeaways
    addSpace(8);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('KEY IDEAS', margin, yPosition);
    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    lessonPlan.participantHandout.keyTakeaways.forEach((takeaway) => {
        addText(`- ${takeaway}`, 11);
        addSpace(2);
    });

    // Quote/Affirmation Box (light blue/purple tint)
    addSpace(8);
    doc.setFillColor(237, 233, 254);
    const quoteHeight = 20;
    doc.rect(margin - 5, yPosition - 5, maxWidth + 10, quoteHeight, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    const quoteLines = doc.splitTextToSize(`"${lessonPlan.participantHandout.quote}"`, maxWidth - 10);
    quoteLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 6;
    });
    yPosition += 5;

    // Reflection Questions
    addSpace(8);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('PERSONAL REFLECTION QUESTIONS', margin, yPosition);
    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    lessonPlan.participantHandout.reflectionQuestions.forEach((question, index) => {
        if (yPosition > pageHeight - 35) {
            doc.addPage();
            yPosition = margin;
        }
        addText(`${index + 1}. ${question}`, 11);
        yPosition += 2;
        doc.text('_________________________________________________________', margin, yPosition);
        yPosition += 5;
        doc.text('_________________________________________________________', margin, yPosition);
        yPosition += 8;
    });

    // My Goals Section
    if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = margin;
    }
    addSpace(5);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('MY GOALS FOR THIS WEEK', margin, yPosition);
    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < 3; i++) {
        doc.text('_________________________________________________________', margin, yPosition);
        yPosition += 7;
    }

    // Self-Care Reminder Box (using Recovery Green tint)
    addSpace(8);
    doc.setFillColor(220, 252, 231); // Light green
    const selfCareHeight = 18;
    doc.rect(margin - 5, yPosition - 5, maxWidth + 10, selfCareHeight, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SELF-CARE REMINDER:', margin, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    addText(lessonPlan.participantHandout.selfCareReminder, 10);
    yPosition += 5;

    // Resources
    addSpace(10);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('RESOURCES & SUPPORT', margin, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    lessonPlan.participantHandout.supportResources.forEach((resource) => {
        addText(`- ${resource}`, 10);
        addSpace(1);
    });

    // Footer message
    addSpace(10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    const footerMessage = 'Remember: Recovery is a journey, not a destination. Be patient and kind with yourself.';
    const footerLines = doc.splitTextToSize(footerMessage, maxWidth);
    footerLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 5;
    });

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Page ${i} of ${totalPages}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Save
    const fileName = `${lessonPlan.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
}

// ========================================
// GOAL PDF TYPES & FUNCTION
// ========================================

interface PhasedPlanPhase {
    title: string;
    description: string;
    actions: string[];
}

interface PhasedPlan {
    preparation: PhasedPlanPhase;
    action: PhasedPlanPhase;
    followThrough: PhasedPlanPhase;
    maintenance: PhasedPlanPhase;
}

interface StrengthUsed {
    strength: string;
    howItHelps: string;
}

interface BarrierAndCoping {
    barrier: string;
    copingStrategy: string;
}

interface PeerSupportActivity {
    activity: string;
    purpose: string;
}

interface ProgressIndicator {
    indicator: string;
    target: string;
}

interface EmotionalSupportPlan {
    anticipatedEmotions: string[];
    copingStrategies: string[];
    peerSupportRole: string;
    selfCareReminders: string[];
}

interface BackupPlan {
    potentialSetbacks: string[];
    alternativeStrategies: string[];
    ifThingsGetHard: string;
    emergencyResources: string[];
}

interface DomainSpecificSection {
    title: string;
    items: string[];
}

interface DomainSpecific {
    category: string;
    sections: DomainSpecificSection[];
}

interface GoalPlan {
    smartGoal: string;
    motivationStatement: string;
    phasedPlan: PhasedPlan;
    strengthsUsed: StrengthUsed[];
    barriersAndCoping: BarrierAndCoping[];
    peerSupportActivities: PeerSupportActivity[];
    progressIndicators: ProgressIndicator[];
    emotionalSupportPlan: EmotionalSupportPlan;
    backupPlan: BackupPlan;
    domainSpecific: DomainSpecific;
    successVision: string;
}

interface GoalMetadata {
    participantName: string;
    goalArea: string;
    timeframe: string;
    createdAt?: string;
}

export function generateGoalPDF(goalPlan: GoalPlan, metadata: GoalMetadata) {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 6;
    const maxWidth = 170;

    // Brand colors
    const studioBlue = { r: 26, g: 115, b: 168 }; // #1A73A8
    const recoveryGreen = { r: 48, g: 178, b: 122 }; // #30B27A
    const goalTeal = { r: 6, g: 148, b: 162 }; // #0694A2

    // Helper to ensure font is reset to helvetica
    const resetFont = (size: number = 10, style: 'normal' | 'bold' | 'italic' = 'normal') => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
    };

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        const lines = doc.splitTextToSize(text, maxWidth);

        lines.forEach((line: string) => {
            if (yPosition > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
        });
    };

    const addBulletText = (text: string, fontSize: number = 9, bulletChar: string = '-') => {
        resetFont(fontSize, 'normal');
        const bulletText = `${bulletChar} ${text}`;
        const lines = doc.splitTextToSize(bulletText, maxWidth);

        lines.forEach((line: string, index: number) => {
            if (yPosition > pageHeight - margin) {
                doc.addPage();
                yPosition = margin;
            }
            // Only first line gets the bullet, continuation lines are indented
            if (index === 0) {
                doc.text(line, margin, yPosition);
            } else {
                doc.text(line, margin + 3, yPosition);
            }
            yPosition += lineHeight;
        });
    };

    const addSpace = (space: number = 5) => {
        yPosition += space;
    };

    const checkPageBreak = (neededSpace: number = 30) => {
        if (yPosition > pageHeight - neededSpace) {
            doc.addPage();
            yPosition = margin;
        }
    };

    const addSectionHeader = (title: string, bgColor?: { r: number; g: number; b: number }) => {
        checkPageBreak(20);
        addSpace(8);
        if (bgColor) {
            doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
            doc.rect(margin - 5, yPosition - 5, maxWidth + 10, 10, 'F');
            doc.setTextColor(255, 255, 255);
        } else {
            doc.setTextColor(goalTeal.r, goalTeal.g, goalTeal.b);
        }
        resetFont(12, 'bold');
        doc.text(title, margin, yPosition);
        yPosition += 8;
        doc.setTextColor(0, 0, 0);
    };

    // ========================================
    // PAGE 1: RECOVERY GOAL PLAN COVER
    // ========================================

    // Header
    doc.setFillColor(goalTeal.r, goalTeal.g, goalTeal.b);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    resetFont(22, 'bold');
    doc.text('Recovery Goal Plan', margin, 20);
    resetFont(14, 'normal');
    doc.text(`${metadata.participantName} | ${metadata.goalArea}`, margin, 32);
    resetFont(10, 'normal');
    doc.text(`${metadata.timeframe}-Day Plan`, margin, 40);
    doc.setTextColor(0, 0, 0);
    yPosition = 55;

    // SMART Goal Box
    doc.setFillColor(240, 253, 250); // Light teal background
    const smartGoalLines = doc.splitTextToSize(goalPlan.smartGoal, maxWidth - 10);
    const smartGoalHeight = Math.max(25, smartGoalLines.length * 6 + 15);
    doc.rect(margin - 5, yPosition - 5, maxWidth + 10, smartGoalHeight, 'F');
    resetFont(11, 'bold');
    doc.setTextColor(goalTeal.r, goalTeal.g, goalTeal.b);
    doc.text('SMART GOAL', margin, yPosition);
    yPosition += 8;
    doc.setTextColor(0, 0, 0);
    resetFont(10, 'normal');
    smartGoalLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 6;
    });
    yPosition += 5;

    // Motivation Statement
    addSpace(5);
    doc.setFillColor(237, 233, 254); // Light purple
    const motivationLines = doc.splitTextToSize(`"${goalPlan.motivationStatement}"`, maxWidth - 10);
    const motivationHeight = Math.max(20, motivationLines.length * 5 + 10);
    doc.rect(margin - 5, yPosition - 5, maxWidth + 10, motivationHeight, 'F');
    resetFont(10, 'italic');
    motivationLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 5;
    });
    yPosition += 5;

    // Vision of Success
    addSpace(5);
    doc.setFillColor(220, 252, 231); // Light green
    const visionLines = doc.splitTextToSize(goalPlan.successVision, maxWidth - 10);
    const visionHeight = Math.max(20, visionLines.length * 5 + 15);
    doc.rect(margin - 5, yPosition - 5, maxWidth + 10, visionHeight, 'F');
    resetFont(10, 'bold');
    doc.text('Vision of Success', margin, yPosition);
    yPosition += 7;
    resetFont(10, 'normal');
    visionLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 5;
    });
    yPosition += 5;

    // ========================================
    // PHASED PLAN
    // ========================================

    addSectionHeader('PHASED ACTION PLAN', goalTeal);

    const phases = [
        { key: 'preparation', data: goalPlan.phasedPlan.preparation },
        { key: 'action', data: goalPlan.phasedPlan.action },
        { key: 'followThrough', data: goalPlan.phasedPlan.followThrough },
        { key: 'maintenance', data: goalPlan.phasedPlan.maintenance }
    ];

    phases.forEach((phase) => {
        checkPageBreak(40);
        resetFont(11, 'bold');
        doc.setTextColor(goalTeal.r, goalTeal.g, goalTeal.b);
        doc.text(phase.data.title, margin, yPosition);
        yPosition += 6;
        doc.setTextColor(100, 100, 100);
        resetFont(9, 'italic');
        addText(phase.data.description, 9);
        doc.setTextColor(0, 0, 0);
        resetFont(9, 'normal');
        phase.data.actions.forEach((action) => {
            checkPageBreak(10);
            addBulletText(action, 9, '[ ]');
        });
        addSpace(5);
    });

    // ========================================
    // PAGE 2: STRENGTHS & BARRIERS
    // ========================================

    doc.addPage();
    yPosition = margin;

    // Strengths Used
    addSectionHeader('YOUR STRENGTHS');
    goalPlan.strengthsUsed.forEach((item) => {
        checkPageBreak(15);
        resetFont(10, 'bold');
        doc.text(`+ ${item.strength}`, margin, yPosition);
        yPosition += 5;
        resetFont(9, 'normal');
        doc.setTextColor(80, 80, 80);
        addText(item.howItHelps, 9);
        doc.setTextColor(0, 0, 0);
        addSpace(3);
    });

    // Barriers & Coping
    addSectionHeader('BARRIERS & COPING STRATEGIES');
    goalPlan.barriersAndCoping.forEach((item) => {
        checkPageBreak(20);
        doc.setFillColor(254, 243, 199); // Light yellow
        doc.rect(margin - 3, yPosition - 3, maxWidth + 6, 6, 'F');
        resetFont(10, 'bold');
        doc.text(`Barrier: ${item.barrier}`, margin, yPosition);
        yPosition += 7;
        resetFont(9, 'normal');
        doc.setTextColor(0, 100, 0);
        addBulletText(item.copingStrategy, 9, '>');
        doc.setTextColor(0, 0, 0);
        addSpace(5);
    });

    // ========================================
    // PEER SUPPORT ACTIVITIES
    // ========================================

    addSectionHeader('PEER SUPPORT ACTIVITIES');
    goalPlan.peerSupportActivities.forEach((item, index) => {
        checkPageBreak(15);
        resetFont(10, 'bold');
        doc.text(`${index + 1}. ${item.activity}`, margin, yPosition);
        yPosition += 5;
        resetFont(9, 'italic');
        doc.setTextColor(100, 100, 100);
        addText(`Purpose: ${item.purpose}`, 9);
        doc.setTextColor(0, 0, 0);
        addSpace(3);
    });

    // ========================================
    // PAGE 3: PROGRESS & SUPPORT
    // ========================================

    doc.addPage();
    yPosition = margin;

    // Progress Indicators
    addSectionHeader('PROGRESS INDICATORS');
    resetFont(9, 'normal');
    goalPlan.progressIndicators.forEach((item) => {
        checkPageBreak(12);
        resetFont(9, 'bold');
        doc.text(`- ${item.indicator}`, margin, yPosition);
        yPosition += 5;
        resetFont(9, 'normal');
        doc.setTextColor(goalTeal.r, goalTeal.g, goalTeal.b);
        doc.text(`  Target: ${item.target}`, margin, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 6;
    });

    // Emotional Support Plan
    addSectionHeader('EMOTIONAL SUPPORT PLAN');
    
    resetFont(10, 'bold');
    doc.text('Emotions You May Experience:', margin, yPosition);
    yPosition += 5;
    resetFont(9, 'normal');
    addText(goalPlan.emotionalSupportPlan.anticipatedEmotions.join(', '), 9);
    addSpace(3);

    resetFont(10, 'bold');
    doc.text('Coping Strategies:', margin, yPosition);
    yPosition += 5;
    resetFont(9, 'normal');
    goalPlan.emotionalSupportPlan.copingStrategies.forEach((strategy) => {
        addBulletText(strategy, 9, '-');
    });
    addSpace(3);

    checkPageBreak(25);
    doc.setFillColor(240, 253, 250);
    const peerRoleLines = doc.splitTextToSize(goalPlan.emotionalSupportPlan.peerSupportRole, maxWidth - 10);
    doc.rect(margin - 3, yPosition - 3, maxWidth + 6, peerRoleLines.length * 5 + 12, 'F');
    resetFont(10, 'bold');
    doc.text('Peer Support Role:', margin, yPosition);
    yPosition += 6;
    resetFont(9, 'normal');
    peerRoleLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 5;
    });
    yPosition += 5;

    // Self-Care Reminders
    addSpace(5);
    resetFont(10, 'bold');
    doc.text('Self-Care Reminders:', margin, yPosition);
    yPosition += 5;
    resetFont(9, 'normal');
    goalPlan.emotionalSupportPlan.selfCareReminders.forEach((reminder) => {
        addBulletText(reminder, 9, '*');
    });

    // ========================================
    // BACKUP PLAN
    // ========================================

    addSectionHeader('BACKUP PLAN');
    
    resetFont(10, 'bold');
    doc.text("If Things Don't Go As Planned:", margin, yPosition);
    yPosition += 5;
    resetFont(9, 'normal');
    goalPlan.backupPlan.potentialSetbacks.forEach((setback) => {
        addBulletText(setback, 9, '-');
    });
    addSpace(3);

    resetFont(10, 'bold');
    doc.text('Alternative Strategies:', margin, yPosition);
    yPosition += 5;
    resetFont(9, 'normal');
    goalPlan.backupPlan.alternativeStrategies.forEach((strategy) => {
        addBulletText(strategy, 9, '>');
    });
    addSpace(5);

    // Encouragement Box
    checkPageBreak(25);
    doc.setFillColor(220, 252, 231);
    const encourageLines = doc.splitTextToSize(goalPlan.backupPlan.ifThingsGetHard, maxWidth - 10);
    doc.rect(margin - 3, yPosition - 3, maxWidth + 6, encourageLines.length * 5 + 10, 'F');
    resetFont(9, 'italic');
    encourageLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 5;
    });
    yPosition += 5;

    // Emergency Resources
    addSpace(5);
    resetFont(10, 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text('Emergency Resources:', margin, yPosition);
    yPosition += 5;
    doc.setTextColor(0, 0, 0);
    resetFont(9, 'normal');
    goalPlan.backupPlan.emergencyResources.forEach((resource) => {
        addBulletText(resource, 9, '-');
    });

    // ========================================
    // DOMAIN-SPECIFIC CONTENT
    // ========================================

    if (goalPlan.domainSpecific && goalPlan.domainSpecific.sections.length > 0) {
        doc.addPage();
        yPosition = margin;

        addSectionHeader(`${goalPlan.domainSpecific.category.toUpperCase()} - SPECIFIC GUIDANCE`, goalTeal);

        goalPlan.domainSpecific.sections.forEach((section) => {
            checkPageBreak(25);
            resetFont(11, 'bold');
            doc.setTextColor(goalTeal.r, goalTeal.g, goalTeal.b);
            doc.text(section.title, margin, yPosition);
            yPosition += 6;
            doc.setTextColor(0, 0, 0);
            resetFont(9, 'normal');
            section.items.forEach((item) => {
                checkPageBreak(8);
                addBulletText(item, 9, '[ ]');
            });
            addSpace(5);
        });
    }

    // ========================================
    // FOOTER & PAGE NUMBERS
    // ========================================

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        resetFont(8, 'normal');
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Peer Support Studio | ${metadata.participantName} - ${metadata.goalArea} Goal Plan`,
            margin,
            doc.internal.pageSize.height - 10
        );
        doc.text(
            `Page ${i} of ${totalPages}`,
            doc.internal.pageSize.width - margin,
            doc.internal.pageSize.height - 10,
            { align: 'right' }
        );
    }

    // Save
    const fileName = `${metadata.participantName.replace(/[^a-z0-9]/gi, '_')}_${metadata.goalArea.replace(/[^a-z0-9]/gi, '_')}_goal_plan.pdf`;
    doc.save(fileName);
}
