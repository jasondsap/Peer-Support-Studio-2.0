// lib/generateGoalPDF.ts
// Generate a branded PDF for a saved goal with milestone checklist
// Pattern follows generateRecoveryCapitalPDF.ts

import jsPDF from 'jspdf';
import type { Milestone } from '@/app/lib/milestoneUtils';
import { getMilestoneStats, calculateProgress, phaseConfig } from '@/app/lib/milestoneUtils';

interface GoalPDFData {
    participantName: string;
    goalArea: string;
    goalAreaLabel: string;
    smartGoal: string;
    desiredOutcome?: string;
    timeframe: string;
    status: string;
    progress: number;
    createdAt: string;
    milestones: Milestone[];
    goalData: {
        type?: string;
        motivationStatement?: string;
        successVision?: string;
        phasedPlan?: {
            preparation?: { title: string; description: string; actions: string[] };
            action?: { title: string; description: string; actions: string[] };
            followThrough?: { title: string; description: string; actions: string[] };
            maintenance?: { title: string; description: string; actions: string[] };
        };
        strengthsUsed?: { strength: string; howItHelps: string }[];
        barriersAndCoping?: { barrier: string; copingStrategy: string }[];
        peerSupportActivities?: { activity: string; purpose: string }[];
        emotionalSupportPlan?: {
            anticipatedEmotions?: string[];
            copingStrategies?: string[];
            peerSupportRole?: string;
            selfCareReminders?: string[];
        };
        backupPlan?: {
            potentialSetbacks?: string[];
            alternativeStrategies?: string[];
            ifThingsGetHard?: string;
            emergencyResources?: string[];
        };
        domainSpecific?: {
            category?: string;
            sections?: { title: string; items: string[] }[];
        };
        sourcesCited?: { doc: string; section: string; pages?: string; usage?: string }[];
    } | null;
}

export function generateGoalPDF(data: GoalPDFData) {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const lineHeight = 6;
    const maxWidth = pageWidth - (margin * 2);

    // Brand colors
    const purple = { r: 139, g: 92, b: 246 };   // #8B5CF6
    const amber = { r: 245, g: 158, b: 11 };    // #F59E0B
    const green = { r: 48, g: 178, b: 122 };     // #30B27A
    const blue = { r: 26, g: 115, b: 168 };      // #1A73A8
    const darkText = { r: 14, g: 34, b: 53 };    // #0E2235

    const checkNewPage = (neededSpace: number = 20) => {
        if (yPosition > pageHeight - neededSpace) {
            doc.addPage();
            yPosition = margin;
        }
    };

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color?: { r: number; g: number; b: number }) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        if (color) {
            doc.setTextColor(color.r, color.g, color.b);
        } else {
            doc.setTextColor(0, 0, 0);
        }
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
            checkNewPage();
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
        });
    };

    const addWrappedBullet = (bullet: string, text: string, indent: number = 3, bulletColor?: { r: number; g: number; b: number }) => {
        const bulletWidth = 8;
        const textWidth = maxWidth - indent - bulletWidth;
        const lines = doc.splitTextToSize(text, textWidth);

        if (bulletColor) {
            doc.setTextColor(bulletColor.r, bulletColor.g, bulletColor.b);
        }
        doc.text(bullet, margin + indent, yPosition);
        doc.setTextColor(0, 0, 0);

        lines.forEach((line: string) => {
            checkNewPage();
            doc.text(line, margin + indent + bulletWidth, yPosition);
            yPosition += lineHeight;
        });
        yPosition += 1;
    };

    const addSpace = (space: number = 5) => {
        yPosition += space;
    };

    const addSectionHeader = (title: string, bgColor: { r: number; g: number; b: number }, textColor?: { r: number; g: number; b: number }) => {
        checkNewPage(40);
        doc.setFillColor(bgColor.r, bgColor.g, bgColor.b);
        doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, 8, 2, 2, 'F');
        const tc = textColor || { r: 255, g: 255, b: 255 };
        doc.setTextColor(tc.r, tc.g, tc.b);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, yPosition + 2);
        yPosition += 12;
        doc.setTextColor(0, 0, 0);
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const formatShortDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const isAIGoal = data.goalData && data.goalData.type !== 'quick-goal';

    // ========================================
    // HEADER
    // ========================================
    doc.setFillColor(blue.r, blue.g, blue.b);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Gradient accent
    doc.setFillColor(green.r, green.g, green.b);
    doc.rect(pageWidth - 60, 0, 60, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Recovery Goal Plan', margin, 18);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(data.goalAreaLabel, margin, 28);

    doc.setFontSize(10);
    doc.text(`Date: ${formatDate(data.createdAt)}`, margin, 36);

    if (data.participantName) {
        const nameText = `Participant: ${data.participantName}`;
        const nameWidth = doc.getTextWidth(nameText);
        doc.text(nameText, pageWidth - margin - Math.max(nameWidth, 50), 36);
    }

    doc.setTextColor(0, 0, 0);
    yPosition = 55;

    // ========================================
    // SMART GOAL CARD
    // ========================================
    doc.setFillColor(248, 250, 252);

    // Calculate height needed for smart goal text
    doc.setFontSize(11);
    const smartGoalLines = doc.splitTextToSize(data.smartGoal, maxWidth - 10);
    const cardHeight = Math.max(35, 15 + (smartGoalLines.length * 6));

    doc.roundedRect(margin - 5, yPosition - 5, maxWidth + 10, cardHeight, 3, 3, 'F');

    // Left accent bar
    doc.setFillColor(blue.r, blue.g, blue.b);
    doc.rect(margin - 5, yPosition - 5, 3, cardHeight, 'F');

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(isAIGoal ? 'SMART GOAL' : 'GOAL DESCRIPTION', margin + 3, yPosition + 2);

    doc.setTextColor(darkText.r, darkText.g, darkText.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    smartGoalLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + 3, yPosition + 10 + (idx * 6));
    });

    yPosition += cardHeight + 5;

    // Status and timeframe line
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    doc.text(`Status: ${statusLabel}  •  Timeframe: ${data.timeframe} days  •  Progress: ${data.progress}%`, margin, yPosition);
    yPosition += 10;

    // ========================================
    // MOTIVATION STATEMENT
    // ========================================
    if (isAIGoal && data.goalData?.motivationStatement) {
        checkNewPage(25);
        doc.setFillColor(237, 233, 254); // Light purple
        const motLines = doc.splitTextToSize(`"${data.goalData.motivationStatement}"`, maxWidth - 10);
        const motHeight = 8 + (motLines.length * 5);
        doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, motHeight, 3, 3, 'F');

        doc.setTextColor(88, 28, 135);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        motLines.forEach((line: string, idx: number) => {
            doc.text(line, margin, yPosition + 4 + (idx * 5));
        });

        yPosition += motHeight + 5;
    }

    // ========================================
    // MILESTONE CHECKLIST
    // ========================================
    if (data.milestones.length > 0) {
        const stats = getMilestoneStats(data.milestones);
        const progress = calculateProgress(data.milestones);

        addSectionHeader(`Milestone Checklist  (${stats.totalCompleted}/${stats.totalMilestones} completed — ${progress}%)`, blue);

        // Progress bar
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(margin, yPosition - 2, maxWidth, 5, 2, 2, 'F');

        if (progress > 0) {
            doc.setFillColor(green.r, green.g, green.b);
            const fillWidth = (maxWidth * progress) / 100;
            doc.roundedRect(margin, yPosition - 2, fillWidth, 5, 2, 2, 'F');
        }
        yPosition += 10;

        // Milestones by phase
        stats.phases.forEach(({ phase, total, completed, milestones: phaseMilestones }) => {
            checkNewPage(20);
            const config = phaseConfig[phase];

            // Phase header
            const phaseTitle = data.goalData?.phasedPlan?.[phase]?.title || config.label;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);

            // Phase dot
            const hex = config.color.replace('#', '');
            const pr = parseInt(hex.substring(0, 2), 16);
            const pg = parseInt(hex.substring(2, 4), 16);
            const pb = parseInt(hex.substring(4, 6), 16);
            doc.setFillColor(pr, pg, pb);
            doc.circle(margin + 3, yPosition - 1.5, 2, 'F');

            doc.text(`${phaseTitle}  (${completed}/${total})`, margin + 8, yPosition);
            yPosition += 7;

            // Milestone items
            phaseMilestones.forEach((m) => {
                checkNewPage(12);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');

                // Checkbox
                if (m.completed) {
                    doc.setFillColor(green.r, green.g, green.b);
                    doc.roundedRect(margin + 5, yPosition - 3.5, 4, 4, 1, 1, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(7);
                    doc.text('✓', margin + 5.8, yPosition - 0.3);
                } else {
                    doc.setDrawColor(180, 180, 180);
                    doc.setLineWidth(0.3);
                    doc.roundedRect(margin + 5, yPosition - 3.5, 4, 4, 1, 1, 'S');
                }

                // Title
                doc.setFontSize(9);
                if (m.completed) {
                    doc.setTextColor(130, 130, 130);
                } else {
                    doc.setTextColor(40, 40, 40);
                }
                doc.setFont('helvetica', 'normal');

                const titleLines = doc.splitTextToSize(m.title, maxWidth - 20);
                titleLines.forEach((line: string, idx: number) => {
                    checkNewPage();
                    doc.text(line, margin + 12, yPosition + (idx > 0 ? idx * 5 : 0));
                });
                yPosition += (titleLines.length - 1) * 5;

                // Completion date
                if (m.completed && m.completed_at) {
                    doc.setFontSize(7);
                    doc.setTextColor(green.r, green.g, green.b);
                    doc.text(`Completed ${formatShortDate(m.completed_at)}`, margin + 12, yPosition + 4);
                    yPosition += 4;
                }

                // Notes
                if (m.notes) {
                    doc.setFontSize(7);
                    doc.setTextColor(120, 120, 120);
                    doc.setFont('helvetica', 'italic');
                    const noteLines = doc.splitTextToSize(m.notes, maxWidth - 20);
                    noteLines.slice(0, 2).forEach((line: string) => {
                        checkNewPage();
                        doc.text(line, margin + 12, yPosition + 4);
                        yPosition += 4;
                    });
                }

                yPosition += 5;
            });

            addSpace(3);
        });

        addSpace(5);
    }

    // ========================================
    // DOMAIN-SPECIFIC DETAILS
    // ========================================
    if (data.goalData?.domainSpecific?.sections && data.goalData.domainSpecific.sections.length > 0) {
        addSectionHeader(`${data.goalAreaLabel} Planning Details`, blue);

        data.goalData.domainSpecific.sections.forEach((section) => {
            checkNewPage(20);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text(section.title, margin, yPosition);
            yPosition += 7;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            section.items.forEach((item) => {
                checkNewPage(10);
                addWrappedBullet('•', item, 3, blue);
            });
            addSpace(3);
        });

        addSpace(5);
    }

    // ========================================
    // STRENGTHS
    // ========================================
    if (data.goalData?.strengthsUsed && data.goalData.strengthsUsed.length > 0) {
        const lightGreen = { r: 220, g: 252, b: 231 };
        const greenText = { r: 22, g: 163, b: 74 };
        addSectionHeader('Strengths to Build On', lightGreen, greenText);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        data.goalData.strengthsUsed.forEach((item) => {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text(`✓ ${item.strength}`, margin + 3, yPosition);
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            const helpLines = doc.splitTextToSize(item.howItHelps, maxWidth - 15);
            helpLines.forEach((line: string) => {
                checkNewPage();
                doc.text(line, margin + 11, yPosition);
                yPosition += 5;
            });
            yPosition += 2;
        });
        addSpace(5);
    }

    // ========================================
    // BARRIERS & COPING
    // ========================================
    if (data.goalData?.barriersAndCoping && data.goalData.barriersAndCoping.length > 0) {
        const lightRed = { r: 254, g: 226, b: 226 };
        const redText = { r: 185, g: 28, b: 28 };
        addSectionHeader('Barriers & Coping Strategies', lightRed, redText);

        doc.setFontSize(9);
        data.goalData.barriersAndCoping.forEach((item) => {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(185, 28, 28);
            doc.text(`⚠ ${item.barrier}`, margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(22, 163, 74);
            addWrappedBullet('→', item.copingStrategy, 8);
            yPosition += 1;
        });
        addSpace(5);
    }

    // ========================================
    // PEER SUPPORT ACTIVITIES
    // ========================================
    if (data.goalData?.peerSupportActivities && data.goalData.peerSupportActivities.length > 0) {
        addSectionHeader('Peer Support Activities', purple);

        doc.setFontSize(9);
        data.goalData.peerSupportActivities.forEach((item) => {
            checkNewPage(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text(item.activity, margin + 3, yPosition);
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            const purposeLines = doc.splitTextToSize(item.purpose, maxWidth - 10);
            purposeLines.forEach((line: string) => {
                checkNewPage();
                doc.text(line, margin + 8, yPosition);
                yPosition += 5;
            });
            yPosition += 2;
        });
        addSpace(5);
    }

    // ========================================
    // EMOTIONAL SUPPORT PLAN
    // ========================================
    if (data.goalData?.emotionalSupportPlan) {
        const esp = data.goalData.emotionalSupportPlan;
        const lightPink = { r: 252, g: 231, b: 243 };
        const pinkText = { r: 190, g: 24, b: 93 };
        addSectionHeader('Emotional Support Plan', lightPink, pinkText);

        // Anticipated emotions
        if (esp.anticipatedEmotions && esp.anticipatedEmotions.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Anticipated Emotions:', margin + 3, yPosition);
            yPosition += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(esp.anticipatedEmotions.join(', '), margin + 8, yPosition);
            yPosition += 8;
        }

        // Coping strategies
        if (esp.copingStrategies && esp.copingStrategies.length > 0) {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Coping Strategies:', margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            esp.copingStrategies.forEach((s) => {
                checkNewPage(8);
                addWrappedBullet('•', s, 5);
            });
            addSpace(3);
        }

        // Peer support role
        if (esp.peerSupportRole) {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Peer Support Role:', margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            const roleLines = doc.splitTextToSize(esp.peerSupportRole, maxWidth - 10);
            roleLines.forEach((line: string) => {
                checkNewPage();
                doc.text(line, margin + 8, yPosition);
                yPosition += 5;
            });
            addSpace(3);
        }

        // Self-care reminders
        if (esp.selfCareReminders && esp.selfCareReminders.length > 0) {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Self-Care Reminders:', margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            esp.selfCareReminders.forEach((r) => {
                checkNewPage(8);
                addWrappedBullet('♥', r, 5, { r: 236, g: 72, b: 153 });
            });
        }

        addSpace(5);
    }

    // ========================================
    // BACKUP PLAN
    // ========================================
    if (data.goalData?.backupPlan) {
        const bp = data.goalData.backupPlan;
        addSectionHeader('Backup Plan & Contingencies', { r: 107, g: 114, b: 128 });

        // Potential setbacks
        if (bp.potentialSetbacks && bp.potentialSetbacks.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Potential Setbacks:', margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            bp.potentialSetbacks.forEach((s) => {
                checkNewPage(8);
                addWrappedBullet('⚠', s, 5, { r: 180, g: 83, b: 9 });
            });
            addSpace(3);
        }

        // Alternative strategies
        if (bp.alternativeStrategies && bp.alternativeStrategies.length > 0) {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Alternative Strategies:', margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            bp.alternativeStrategies.forEach((s) => {
                checkNewPage(8);
                addWrappedBullet('→', s, 5, blue);
            });
            addSpace(3);
        }

        // If things get hard
        if (bp.ifThingsGetHard) {
            checkNewPage(25);
            doc.setFillColor(239, 246, 255); // Light blue
            const hardLines = doc.splitTextToSize(bp.ifThingsGetHard, maxWidth - 10);
            const hardHeight = 12 + (hardLines.length * 5);
            doc.roundedRect(margin - 3, yPosition - 3, maxWidth + 6, hardHeight, 2, 2, 'F');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(blue.r, blue.g, blue.b);
            doc.text('If Things Get Hard...', margin, yPosition + 3);
            yPosition += 8;
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(59, 130, 246);
            hardLines.forEach((line: string) => {
                doc.text(line, margin + 3, yPosition);
                yPosition += 5;
            });
            yPosition += 5;
        }

        // Emergency resources
        if (bp.emergencyResources && bp.emergencyResources.length > 0) {
            checkNewPage(15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkText.r, darkText.g, darkText.b);
            doc.text('Emergency Resources:', margin + 3, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            bp.emergencyResources.forEach((r) => {
                checkNewPage(8);
                addWrappedBullet('⚡', r, 5, amber);
            });
        }

        addSpace(5);
    }

    // ========================================
    // VISION OF SUCCESS
    // ========================================
    if (data.goalData?.successVision) {
        checkNewPage(30);
        doc.setFillColor(blue.r, blue.g, blue.b);

        const visionLines = doc.splitTextToSize(data.goalData.successVision, maxWidth - 10);
        const visionHeight = 14 + (visionLines.length * 5);
        doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, visionHeight, 3, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Vision of Success', margin, yPosition + 5);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        visionLines.forEach((line: string, idx: number) => {
            doc.text(line, margin, yPosition + 13 + (idx * 5));
        });

        yPosition += visionHeight + 8;
    }

    // ========================================
    // EVIDENCE SOURCES (if from RAG)
    // ========================================
    if (data.goalData?.sourcesCited && data.goalData.sourcesCited.length > 0) {
        checkNewPage(40);

        // Divider line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, margin + maxWidth, yPosition);
        yPosition += 8;

        // Section header with green accent
        doc.setFillColor(green.r, green.g, green.b);
        doc.rect(margin - 5, yPosition - 5, 3, 10, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(green.r, green.g, green.b);
        doc.text('Evidence Sources', margin + 2, yPosition);
        yPosition += lineHeight;
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(128, 128, 128);
        doc.text('This goal plan was built using the following authoritative sources.', margin, yPosition);
        yPosition += lineHeight;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        data.goalData.sourcesCited.forEach((source) => {
            checkNewPage(8);

            let citation = `${source.doc}, ${source.section}`;
            if (source.pages) citation += ` — pp. ${source.pages}`;
            if (source.usage) citation += ` — ${source.usage}`;

            doc.setTextColor(green.r, green.g, green.b);
            doc.text('✓', margin, yPosition);
            doc.setTextColor(80, 80, 80);
            const citationLines = doc.splitTextToSize(citation, maxWidth - 8);
            citationLines.forEach((line: string) => {
                doc.text(line, margin + 8, yPosition);
                yPosition += 5;
            });
            yPosition += 1;
        });

        addSpace(5);
    }

    // ========================================
    // FOOTER (all pages)
    // ========================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            'Peer Support Studio by MADE180 • Louisville, KY',
            margin,
            pageHeight - 10
        );
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - margin,
            pageHeight - 10,
            { align: 'right' }
        );
    }

    // Save
    const nameSlug = data.participantName
        ? data.participantName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
        : 'goal';
    const dateSlug = formatDate(data.createdAt).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const fileName = `recovery_goal_${nameSlug}_${dateSlug}.pdf`;
    doc.save(fileName);
}
