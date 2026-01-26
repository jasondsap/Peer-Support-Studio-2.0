import { NextRequest, NextResponse } from 'next/server';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.json();

        // Create Word document
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Session Information Section
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'SESSION INFORMATION',
                                bold: true
                            })
                        ],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'DATE OF SERVICE: ', bold: true }),
                            new TextRun({ text: formData.dateOfService })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Service Code: ', bold: true }),
                            new TextRun({ text: formData.serviceCode }),
                            new TextRun({ text: '        Start Time: ', bold: true }),
                            new TextRun({ text: formData.startTime }),
                            new TextRun({ text: '        End Time: ', bold: true }),
                            new TextRun({ text: formData.endTime })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Number in Group: ', bold: true }),
                            new TextRun({ text: formData.numberInGroup })
                        ],
                        spacing: { after: 200 }
                    }),

                    // Services Received
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Services Received:',
                                bold: true
                            })
                        ],
                        spacing: { after: 100 }
                    }),
                    ...createServicesReceivedParagraphs(formData.servicesReceived),

                    // Group Topic
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Group Topic: ', bold: true }),
                            new TextRun({ text: formData.groupTopic })
                        ],
                        spacing: { before: 200, after: 400 }
                    }),

                    // Client Information Section (with highlighting)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'CLIENT INFORMATION',
                                bold: true
                            })
                        ],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '(Edit this section for each individual group member)',
                                italics: true,
                                color: 'FF0000'
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Client Name: ', bold: true }),
                            new TextRun({
                                text: formData.clientName || '_____________________________',
                                highlight: 'yellow'
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Subjective: ', bold: true })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: formData.subjectiveStatement || '[Client statement to be added]',
                                highlight: 'yellow'
                            })
                        ],
                        spacing: { after: 400 }
                    }),

                    // Clinical Observations
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'CLINICAL OBSERVATIONS',
                                bold: true
                            })
                        ],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'AFFECT: ', bold: true }),
                            new TextRun({ text: formData.observations.affect.join(', ') })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'BEHAVIOR: ', bold: true }),
                            new TextRun({ text: formData.observations.behavior.join(', ') })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'COGNITION: ', bold: true }),
                            new TextRun({ text: formData.observations.cognition.join(', ') })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'PSYCHOMOTOR ACTIVITY: ', bold: true }),
                            new TextRun({ text: formData.observations.psychomotor.join(', ') })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'MOOD: ', bold: true }),
                            new TextRun({ text: formData.observations.mood.join(', ') })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'APPEARANCE: ', bold: true }),
                            new TextRun({ text: formData.observations.appearance.join(', ') })
                        ],
                        spacing: { after: 400 }
                    }),

                    // Risk Assessment Section (with highlighting)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'RISK ASSESSMENT',
                                bold: true
                            })
                        ],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '(Edit this section for each individual group member)',
                                italics: true,
                                color: 'FF0000'
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Suicidal Ideation: ', bold: true }),
                            new TextRun({
                                text: formData.suicidalIdeation ? 'YES' : 'NO',
                                highlight: 'yellow'
                            }),
                            new TextRun({ text: '        Homicidal Ideation: ', bold: true }),
                            new TextRun({
                                text: formData.homicidalIdeation ? 'YES' : 'NO',
                                highlight: 'yellow'
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Risk: ', bold: true })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: formData.riskNotes || '[To be completed for each client]',
                                highlight: 'yellow'
                            })
                        ],
                        spacing: { after: 400 }
                    }),

                    // Treatment Notes Section (with highlighting)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'TREATMENT NOTES',
                                bold: true
                            })
                        ],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: '(Edit individual sections for each group member)',
                                italics: true,
                                color: 'FF0000'
                            })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Reaction to TX (Include Stage of Change): ', bold: true })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: formData.reactionToTreatment || '[To be completed for each client]',
                                highlight: 'yellow'
                            })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Stage of Change: ', bold: true }),
                            new TextRun({ text: formData.stageOfChange })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Intervention: ', bold: true })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: formData.intervention })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Tx Plan: ', bold: true })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: formData.treatmentPlanChanges })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Justification/Need to continue treatment: ', bold: true })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: formData.justification || '[To be completed for each client]',
                                highlight: 'yellow'
                            })
                        ],
                        spacing: { after: 400 }
                    }),

                    // Signature line
                    new Paragraph({
                        children: [
                            new TextRun({ text: '_________________________________________________________________' })
                        ],
                        spacing: { before: 600, after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Peer Support Specialist Signature                                        Date' })
                        ],
                        spacing: { after: 200 }
                    })
                ]
            }]
        });

        // Generate Word document buffer
        const buffer = await Packer.toBuffer(doc);

        // Convert to Uint8Array for Next.js compatibility
        const uint8Array = new Uint8Array(buffer);

        return new NextResponse(uint8Array, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="Group_Session_Note_${formData.dateOfService}.docx"`
            }
        });

    } catch (error) {
        console.error('Error generating Word document:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate Word document',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

function createServicesReceivedParagraphs(servicesReceived: string[]) {
    const services: Record<string, string> = {
        'individual': 'Individual therapy',
        'group': 'Group therapy',
        'family': 'Family therapy',
        'crisis': 'Crisis intervention',
        'psychoeducation-consumer': 'Psycho-education for consumer',
        'psychoeducation-family': 'Psycho-education for family'
    };

    return Object.entries(services).map(([key, label]) => {
        const checked = servicesReceived.includes(key);
        return new Paragraph({
            children: [
                new TextRun({ text: checked ? '☑ ' : '☐ ' }),
                new TextRun({ text: label })
            ],
            spacing: { after: 50 }
        });
    });
}
