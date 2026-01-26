import jsPDF from 'jspdf';

interface DomainScore {
    name: string;
    percentage: number;
    color: string;
}

interface Goal {
    domain: string;
    title: string;
    description: string;
    actionSteps: string[];
    whyItMatters: string;
}

interface RecoveryCapitalAnalysis {
    overallSummary: string;
    strengthsHighlight: {
        title: string;
        items: string[];
    };
    growthOpportunities: {
        title: string;
        items: string[];
    };
    recommendedGoals: Goal[];
    weeklyChallenge: {
        title: string;
        description: string;
        domain: string;
    };
    encouragement: string;
}

interface RecoveryCapitalData {
    participantName?: string;
    assessmentType: 'barc10' | 'mirc28';
    assessmentDate: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    interpretation: {
        level: string;
        description: string;
    };
    domains: DomainScore[];
    analysis: RecoveryCapitalAnalysis;
}

export function generateRecoveryCapitalPDF(data: RecoveryCapitalData) {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const lineHeight = 6;
    const maxWidth = pageWidth - (margin * 2);

    // Brand colors
    const purple = { r: 139, g: 92, b: 246 }; // #8B5CF6
    const amber = { r: 245, g: 158, b: 11 };  // #F59E0B
    const green = { r: 34, g: 197, b: 94 };   // #22C55E
    const blue = { r: 59, g: 130, b: 246 };   // #3B82F6

    const checkNewPage = (neededSpace: number = 20) => {
        if (yPosition > pageHeight - neededSpace) {
            doc.addPage();
            yPosition = margin;
        }
    };

    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color?: { r: number, g: number, b: number }) => {
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

    const addSpace = (space: number = 5) => {
        yPosition += space;
    };

    // ========================================
    // HEADER
    // ========================================
    doc.setFillColor(purple.r, purple.g, purple.b);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Gradient effect with amber
    doc.setFillColor(amber.r, amber.g, amber.b);
    doc.rect(pageWidth - 60, 0, 60, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Recovery Capital Assessment', margin, 18);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const assessmentLabel = data.assessmentType === 'mirc28' ? 'Comprehensive (MIRC-28)' : 'Quick Check (BARC-10)';
    doc.text(assessmentLabel, margin, 28);
    
    doc.setFontSize(10);
    doc.text(`Date: ${data.assessmentDate}`, margin, 36);
    
    if (data.participantName) {
        doc.text(`Participant: ${data.participantName}`, pageWidth - margin - 60, 36);
    }
    
    doc.setTextColor(0, 0, 0);
    yPosition = 55;

    // ========================================
    // SCORE SUMMARY
    // ========================================
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin - 5, yPosition - 5, maxWidth + 10, 45, 3, 3, 'F');
    
    // Score circle
    doc.setFillColor(purple.r, purple.g, purple.b);
    doc.circle(margin + 20, yPosition + 17, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.totalScore}`, margin + 20, yPosition + 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`of ${data.maxScore}`, margin + 20, yPosition + 23, { align: 'center' });
    
    // Interpretation
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(data.interpretation.level, margin + 50, yPosition + 10);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const interpLines = doc.splitTextToSize(data.interpretation.description, maxWidth - 60);
    interpLines.slice(0, 3).forEach((line: string, idx: number) => {
        doc.text(line, margin + 50, yPosition + 18 + (idx * 5));
    });
    
    yPosition += 50;

    // ========================================
    // DOMAIN SCORES
    // ========================================
    addSpace(5);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Domain Breakdown', margin, yPosition);
    yPosition += 10;

    const domainWidth = (maxWidth - 15) / 4;
    data.domains.forEach((domain, idx) => {
        const xPos = margin + (idx * (domainWidth + 5));
        
        // Domain box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(xPos, yPosition, domainWidth, 35, 2, 2, 'F');
        
        // Progress bar background
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(xPos + 5, yPosition + 20, domainWidth - 10, 6, 2, 2, 'F');
        
        // Progress bar fill
        const hex = domain.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        doc.setFillColor(r, g, b);
        const fillWidth = ((domainWidth - 10) * domain.percentage) / 100;
        doc.roundedRect(xPos + 5, yPosition + 20, fillWidth, 6, 2, 2, 'F');
        
        // Domain name and score
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(domain.name.split(' ')[0], xPos + 5, yPosition + 10);
        
        doc.setFontSize(10);
        doc.setTextColor(r, g, b);
        doc.text(`${domain.percentage}%`, xPos + 5, yPosition + 17);
    });
    
    yPosition += 45;

    // ========================================
    // AI ANALYSIS SUMMARY
    // ========================================
    checkNewPage(40);
    doc.setFillColor(purple.r, purple.g, purple.b);
    doc.roundedRect(margin - 5, yPosition - 5, maxWidth + 10, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('AI Analysis', margin, yPosition + 1);
    yPosition += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    addText(data.analysis.overallSummary, 10);
    addSpace(5);

    // ========================================
    // STRENGTHS
    // ========================================
    checkNewPage(40);
    doc.setFillColor(220, 252, 231); // Light green
    doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, 8, 2, 2, 'F');
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.analysis.strengthsHighlight.title, margin, yPosition + 2);
    yPosition += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    data.analysis.strengthsHighlight.items.forEach((item) => {
        checkNewPage(15);
        // Wrap text properly with bullet point
        const bulletWidth = 8;
        const textWidth = maxWidth - bulletWidth;
        const lines = doc.splitTextToSize(item, textWidth);
        
        // Draw bullet on first line
        doc.text('✓', margin + 3, yPosition);
        
        // Draw wrapped text
        lines.forEach((line: string, idx: number) => {
            checkNewPage();
            doc.text(line, margin + 3 + bulletWidth, yPosition);
            yPosition += lineHeight;
        });
        yPosition += 2; // Small gap between items
    });
    addSpace(5);

    // ========================================
    // GROWTH OPPORTUNITIES
    // ========================================
    checkNewPage(40);
    doc.setFillColor(254, 243, 199); // Light amber
    doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, 8, 2, 2, 'F');
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.analysis.growthOpportunities.title, margin, yPosition + 2);
    yPosition += 12;
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    data.analysis.growthOpportunities.items.forEach((item) => {
        checkNewPage(15);
        // Wrap text properly with arrow
        const bulletWidth = 8;
        const textWidth = maxWidth - bulletWidth;
        const lines = doc.splitTextToSize(item, textWidth);
        
        // Draw arrow on first line
        doc.text('→', margin + 3, yPosition);
        
        // Draw wrapped text
        lines.forEach((line: string, idx: number) => {
            checkNewPage();
            doc.text(line, margin + 3 + bulletWidth, yPosition);
            yPosition += lineHeight;
        });
        yPosition += 2; // Small gap between items
    });
    addSpace(8);

    // ========================================
    // RECOMMENDED GOALS
    // ========================================
    if (data.analysis.recommendedGoals && data.analysis.recommendedGoals.length > 0) {
        checkNewPage(50);
        doc.setFillColor(purple.r, purple.g, purple.b);
        doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Goals', margin, yPosition + 2);
        yPosition += 15;

        data.analysis.recommendedGoals.forEach((goal, idx) => {
            checkNewPage(45);
            
            // Goal header
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin - 3, yPosition - 5, maxWidth + 6, 10, 2, 2, 'F');
            
            doc.setTextColor(purple.r, purple.g, purple.b);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${idx + 1}. ${goal.title}`, margin, yPosition);
            yPosition += 8;
            
            // Goal description
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const descLines = doc.splitTextToSize(goal.description, maxWidth - 5);
            descLines.forEach((line: string) => {
                checkNewPage();
                doc.text(line, margin + 3, yPosition);
                yPosition += 5;
            });
            
            // Action steps
            addSpace(2);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Action Steps:', margin + 3, yPosition);
            yPosition += 5;
            
            doc.setFont('helvetica', 'normal');
            goal.actionSteps.forEach((step, stepIdx) => {
                checkNewPage();
                doc.text(`${stepIdx + 1}. ${step}`, margin + 6, yPosition);
                yPosition += 5;
            });
            
            addSpace(5);
        });
    }

    // ========================================
    // WEEKLY CHALLENGE
    // ========================================
    checkNewPage(35);
    doc.setFillColor(purple.r, purple.g, purple.b);
    doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, 30, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.analysis.weeklyChallenge.title, margin, yPosition + 5);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const challengeLines = doc.splitTextToSize(data.analysis.weeklyChallenge.description, maxWidth - 10);
    challengeLines.forEach((line: string, idx: number) => {
        doc.text(line, margin, yPosition + 14 + (idx * 5));
    });
    
    yPosition += 40;

    // ========================================
    // ENCOURAGEMENT
    // ========================================
    checkNewPage(35);
    doc.setFillColor(237, 233, 254); // Light purple
    doc.roundedRect(margin - 5, yPosition - 3, maxWidth + 10, 25, 3, 3, 'F');
    
    doc.setTextColor(88, 28, 135);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const encLines = doc.splitTextToSize(data.analysis.encouragement, maxWidth - 10);
    encLines.forEach((line: string, idx: number) => {
        doc.text(line, margin, yPosition + 5 + (idx * 5));
    });
    
    yPosition += 30;

    // ========================================
    // FOOTER
    // ========================================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
            'Peer Support Studio by MADe180 • Louisville, KY',
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
        : 'self';
    const dateSlug = data.assessmentDate.replace(/[^a-z0-9]/gi, '-');
    const fileName = `recovery_capital_${nameSlug}_${dateSlug}.pdf`;
    doc.save(fileName);
}
