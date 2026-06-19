/**
 * PDF Export Functionality
 * Generates professional PDF from transcript data
 * Matches the modern styling from TranscriptPreview
 */

import type { TranscriptData, TestScore } from './types';
import { formatGPA, formatCredits, calculateAcademicSummary, calculateYearSummary, calculateTotalCredits, formatDateLocal, DEFAULT_GRADING_SCALE } from './utils';

/**
 * Escape user-controlled values before interpolating into the print HTML.
 * The PDF/print window builds raw HTML via template strings + document.write, so
 * unescaped fields (names, notes, course titles, school info, etc.) would allow
 * HTML/script injection.
 */
function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Export transcript to PDF using browser print functionality
 * Uses the same modern styling as TranscriptPreview
 */
export function exportToPDF(transcript: TranscriptData): void {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow pop-ups to export PDF');
        return;
    }

    const html = generatePrintHTML(transcript);
    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
}

/**
 * Generate print-ready HTML matching TranscriptPreview styling
 */
function generatePrintHTML(transcript: TranscriptData): string {
    const studentName = esc(`${transcript.studentInfo.firstName} ${transcript.studentInfo.middleName || ''} ${transcript.studentInfo.lastName}`.trim());

    const formatDate = (dateStr?: string): string => esc(formatDateLocal(dateStr));

    // Calculate academic summary — honor the user's grading settings, exactly like
    // the on-screen TranscriptPreview, so the PDF GPA matches what was shown.
    const academicSummary = calculateAcademicSummary(
        transcript.courses.filter(c => c.included !== false),
        transcript.gradingSettings,
    );

    // Year summaries for year-based template
    const yearSummaries = [9, 10, 11, 12].map(gradeLevel => {
        const yearCourses = transcript.courses.filter(
            c => c.gradeLevel === gradeLevel && c.included !== false
        );
        return calculateYearSummary(gradeLevel, yearCourses, transcript.gradingSettings);
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${studentName} - Official Transcript</title>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      margin: 0;
      padding: 0;
      background: white;
    }
    
    .transcript-container {
      padding: 1rem;
      max-width: 100%;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 3px solid #383A57;
    }
    
    .header h1 {
      font-size: 1.25rem;
      font-weight: bold;
      color: #383A57;
      margin: 0 0 0.25rem 0;
      letter-spacing: 0.1em;
    }
    
    .header h2 {
      font-size: 1rem;
      font-weight: 600;
      color: #563963;
      margin: 0.25rem 0 0 0;
    }
    
    /* Info Sections */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .info-section {
      border-left: 4px solid #563963;
      padding-left: 0.75rem;
    }
    
    .info-title {
      font-weight: bold;
      color: #563963;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    
    .info-item {
      display: flex;
      align-items: baseline;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
      font-size: 0.75rem;
    }
    
    .info-label {
      font-weight: 600;
      color: #383A57;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      min-width: 100px;
    }
    
    .info-value {
      color: #1f2937;
    }
    
    .info-value-mono {
      font-family: monospace;
      font-size: 0.75rem;
    }
    
    /* Course Tables */
    .year-section,
    .subject-section {
      margin-bottom: 2rem;
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid rgba(56, 58, 87, 0.2);
    }
    
    .section-title {
      font-size: 1rem;
      font-weight: bold;
      color: #563963;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .section-stats {
      font-size: 0.75rem;
      color: #4b5563;
      font-weight: 500;
    }
    
    .section-stats strong {
      font-weight: bold;
      color: #383A57;
    }
    
    .course-table {
      width: 100%;
      border: 1px solid #d1d5db;
      border-radius: 0.125rem;
      overflow: hidden;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    
    .course-table thead tr {
      background-color: rgba(86, 57, 99, 0.05);
      border-bottom: 2px solid rgba(56, 58, 87, 0.2);
    }
    
    .course-table th {
      padding: 0.625rem 1rem;
      text-align: left;
      font-weight: bold;
      color: #383A57;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .course-table th.text-center {
      text-align: center;
      width: 80px;
    }
    
    .course-table tbody tr {
      border-bottom: 1px solid rgba(209, 213, 219, 0.6);
    }
    
    .course-table tbody tr:nth-child(even) {
      background-color: rgba(249, 250, 251, 0.5);
    }
    
    .course-table tbody tr:nth-child(odd) {
      background-color: white;
    }
    
    .course-table td {
      padding: 0.625rem 1rem;
      color: #1f2937;
    }
    
    .course-table td.text-center {
      text-align: center;
    }
    
    .course-table td.grade {
      font-weight: bold;
      color: #383A57;
    }
    
    /* Academic Summary */
    .academic-summary {
      margin-bottom: 1rem;
      padding: 0.75rem;
      background-color: rgba(86, 57, 99, 0.05);
      border: 2px solid rgba(86, 57, 99, 0.2);
      border-radius: 0.125rem;
    }
    
    .summary-title {
      font-size: 0.75rem;
      font-weight: bold;
      color: #563963;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 2px solid rgba(86, 57, 99, 0.3);
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      font-size: 0.75rem;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-label {
      color: #4b5563;
      font-size: 0.625rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    
    .summary-value {
      font-size: 1.125rem;
      font-weight: bold;
      color: #383A57;
    }
    
    .summary-divider {
      grid-column: 1 / -1;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 2px solid rgba(86, 57, 99, 0.2);
    }
    
    .credits-by-subject {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem 0.5rem;
      font-size: 0.625rem;
    }
    
    .subject-credit-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.125rem;
      border-bottom: 1px solid rgba(209, 213, 219, 0.6);
    }
    
    /* Test Scores */
    .test-scores {
      margin-bottom: 1rem;
    }
    
    .test-title {
      font-size: 0.75rem;
      font-weight: bold;
      color: #563963;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 2px solid rgba(86, 57, 99, 0.3);
    }
    
    .test-card {
      border: 2px solid #d1d5db;
      border-radius: 0.125rem;
      padding: 0.5rem;
      background: white;
      margin-bottom: 0.5rem;
    }
    
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.375rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .test-name {
      font-weight: bold;
      color: #383A57;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .test-date {
      font-size: 0.65rem;
      color: #4b5563;
      font-weight: 500;
    }
    
    .test-scores-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
      font-size: 0.7rem;
    }
    
    .test-score-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.125rem;
      border-bottom: 1px solid rgba(209, 213, 219, 0.6);
    }
    
    .test-score-label {
      color: #4b5563;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    
    .test-score-value {
      font-weight: bold;
      color: #383A57;
    }
    
    /* Activities */
    .activities {
      margin-bottom: 2rem;
    }
    
    .activities-title {
      font-size: 1rem;
      font-weight: bold;
      color: #563963;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid rgba(86, 57, 99, 0.3);
    }
    
    .activity-card {
      border-left: 4px solid #CCAF60;
      padding-left: 1rem;
      padding-top: 0.75rem;
      padding-bottom: 0.75rem;
      background: white;
      border-right: 1px solid #e5e7eb;
      border-top: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      border-radius: 0.125rem;
      margin-bottom: 0.75rem;
    }
    
    .activity-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 0.5rem;
    }
    
    .activity-name {
      font-weight: bold;
      color: #383A57;
      font-size: 0.875rem;
    }
    
    .activity-years {
      font-size: 0.75rem;
      color: #4b5563;
      font-weight: 500;
      margin-left: 1rem;
    }
    
    .activity-position {
      font-size: 0.75rem;
      color: #CCAF60;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }
    
    .activity-description {
      font-size: 0.875rem;
      color: #1f2937;
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    
    .activity-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      font-size: 0.75rem;
      color: #4b5563;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(209, 213, 219, 0.6);
    }
    
    .activity-meta strong {
      font-weight: bold;
      color: #383A57;
    }
    
    .activity-meta .award {
      color: #CCAF60;
      font-weight: 600;
    }
    
    /* Grading Scale */
    .grading-scale {
      margin-bottom: 1rem;
    }
    
    .grading-title {
      font-size: 0.75rem;
      font-weight: bold;
      color: #563963;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 2px solid rgba(86, 57, 99, 0.3);
    }
    
    .grading-scale-content {
      border: 2px solid #d1d5db;
      border-radius: 0.125rem;
      padding: 0.5rem;
      background-color: rgba(86, 57, 99, 0.05);
      font-size: 0.7rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1rem;
      align-items: center;
    }
    
    .grading-scale-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    
    .grading-scale-range {
      color: #1f2937;
    }
    
    .grading-scale-points {
      font-weight: bold;
      color: #383A57;
    }
    
    .grading-scale-separator {
      color: #9ca3af;
      margin: 0 0.25rem;
    }
    
    /* Signature */
    .signature-section {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 3px solid #383A57;
    }
    
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    
    .signature-label {
      font-weight: bold;
      color: #563963;
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    
    .signature-handwritten {
      font-family: 'Dancing Script', 'Brush Script MT', 'Lucida Handwriting', cursive;
      font-weight: 500;
      font-size: 1.125rem;
      color: #383A57;
      border-bottom: 2px solid #383A57;
      padding-bottom: 0.375rem;
      padding-top: 0.125rem;
    }
    
    .signature-date {
      color: #1f2937;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    /* Notes */
    .notes-section {
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 2px solid rgba(86, 57, 99, 0.2);
    }
    
    .notes-title {
      font-size: 0.75rem;
      font-weight: bold;
      color: #563963;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
      padding-bottom: 0.25rem;
      border-bottom: 2px solid rgba(86, 57, 99, 0.3);
    }
    
    .note-item {
      font-size: 0.7rem;
      color: #1f2937;
      line-height: 1.3;
      border-left: 4px solid rgba(204, 175, 96, 0.4);
      padding-left: 0.5rem;
      padding-top: 0.125rem;
      padding-bottom: 0.125rem;
      margin-bottom: 0.375rem;
    }
  </style>
</head>
<body>
  <div class="transcript-container">
    <!-- Header -->
    <div class="header">
      <h1>OFFICIAL HIGH SCHOOL TRANSCRIPT</h1>
      <h2>${studentName}</h2>
    </div>

    <!-- Student and School Information -->
    <div class="info-grid">
      <div class="info-section">
        <div class="info-title">STUDENT INFORMATION</div>
        <div class="info-item">
          <span class="info-label">NAME:</span>
          <span class="info-value">${studentName}</span>
        </div>
        ${transcript.studentInfo.email ? `
        <div class="info-item">
          <span class="info-label">EMAIL:</span>
          <span class="info-value">${esc(transcript.studentInfo.email)}</span>
        </div>
        ` : ''}
        ${transcript.studentInfo.gender ? `
        <div class="info-item">
          <span class="info-label">GENDER:</span>
          <span class="info-value">${esc(transcript.studentInfo.gender)}</span>
        </div>
        ` : ''}
        ${transcript.studentInfo.birthDate ? `
        <div class="info-item">
          <span class="info-label">DATE OF BIRTH:</span>
          <span class="info-value">${formatDate(transcript.studentInfo.birthDate)}</span>
        </div>
        ` : ''}
        ${transcript.studentInfo.graduationDate ? `
        <div class="info-item">
          <span class="info-label">GRADUATION DATE:</span>
          <span class="info-value">${formatDate(transcript.studentInfo.graduationDate)}</span>
        </div>
        ` : ''}
      </div>
      <div class="info-section">
        <div class="info-title">SCHOOL INFORMATION</div>
        <div class="info-item">
          <span class="info-label">NAME:</span>
          <span class="info-value">${esc(transcript.schoolInfo.name)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">ADDRESS:</span>
          <span class="info-value">${esc(transcript.schoolInfo.address)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">ADMINISTRATOR:</span>
          <span class="info-value">${esc(transcript.schoolInfo.administrator)}</span>
        </div>
        ${transcript.schoolInfo.email ? `
        <div class="info-item">
          <span class="info-label">EMAIL:</span>
          <span class="info-value">${esc(transcript.schoolInfo.email)}</span>
        </div>
        ` : ''}
        ${transcript.schoolInfo.phone ? `
        <div class="info-item">
          <span class="info-label">PHONE:</span>
          <span class="info-value">${esc(transcript.schoolInfo.phone)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Academic Summary - Compact, Centered, Above Courses -->
    <div style="margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: center; align-items: center; border-bottom: 2px solid rgba(56, 58, 87, 0.2); padding-bottom: 0.25rem;">
        <div style="display: flex; gap: 1.5rem; font-size: 0.5625rem;">
          <div>
            <span style="color: #4b5563; font-weight: 500;">Weighted GPA: </span>
            <span style="font-weight: bold; color: #383A57;">${formatGPA(academicSummary.weightedGPA)}</span>
          </div>
          <div>
            <span style="color: #4b5563; font-weight: 500;">Unweighted GPA: </span>
            <span style="font-weight: bold; color: #383A57;">${formatGPA(academicSummary.unweightedGPA)}</span>
          </div>
          <div>
            <span style="color: #4b5563; font-weight: 500;">Total Credits: </span>
            <span style="font-weight: bold; color: #383A57;">${formatCredits(academicSummary.totalCredits)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Courses - Four Square Layout -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
      ${yearSummaries.map(summary => {
        const sortedCourses = [...summary.courses].sort((a, b) => a.courseName.localeCompare(b.courseName));

        if (sortedCourses.length === 0) {
            return `
          <div style="border: 2px solid #d1d5db; border-radius: 0.125rem; background: white;">
            <div style="background-color: rgba(86, 57, 99, 0.05); border-bottom: 2px solid rgba(56, 58, 87, 0.2); padding: 0.375rem 0.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.625rem; font-weight: bold; color: #563963; text-transform: uppercase; letter-spacing: 0.05em;">
                  ${summary.yearLabel} ${summary.yearRange.start} - ${summary.yearRange.end}
                </div>
                <div style="font-size: 0.5625rem; color: #4b5563; font-weight: 500;">
                  <span style="margin-right: 0.5rem;">GPA: <strong style="color: #383A57;">0.0</strong></span>
                  <span>Cr: <strong style="color: #383A57;">0.0</strong></span>
                </div>
              </div>
            </div>
            <div style="padding: 0.5rem;">
              <p style="color: #6b7280; font-style: italic; font-size: 0.5625rem; margin-bottom: 0.25rem;">No courses recorded.</p>
              <div style="font-size: 0.5625rem; color: #4b5563; font-weight: 500;">
                <span style="margin-right: 0.5rem;">GPA: <strong style="color: #383A57;">0.0</strong></span>
                <span>Cr: <strong style="color: #383A57;">0.0</strong></span>
              </div>
            </div>
          </div>
          `;
        }

        return `
        <div style="border: 2px solid #d1d5db; border-radius: 0.125rem; background: white;">
          <div style="background-color: rgba(86, 57, 99, 0.05); border-bottom: 2px solid rgba(56, 58, 87, 0.2); padding: 0.375rem 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.625rem; font-weight: bold; color: #563963; text-transform: uppercase; letter-spacing: 0.05em;">
                ${summary.yearLabel} ${summary.yearRange.start} - ${summary.yearRange.end}
              </div>
              <div style="font-size: 0.5625rem; color: #4b5563; font-weight: 500;">
                <span style="margin-right: 0.5rem;">GPA: <strong style="color: #383A57;">${formatGPA(summary.weightedGPA)}</strong></span>
                <span>Cr: <strong style="color: #383A57;">${formatCredits(summary.creditTotal)}</strong></span>
              </div>
            </div>
          </div>
          <div style="padding: 0.375rem;">
            <table style="width: 100%; font-size: 0.5625rem; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(209, 213, 219, 0.6);">
                  <th style="text-align: left; padding: 0.125rem 0.25rem; font-weight: 600; color: #383A57; text-transform: uppercase; font-size: 0.5625rem; letter-spacing: 0.05em;">Course</th>
                  <th style="text-align: center; padding: 0.125rem 0.25rem; font-weight: 600; color: #383A57; text-transform: uppercase; font-size: 0.5625rem; letter-spacing: 0.05em; width: 2rem;">Gr</th>
                  <th style="text-align: center; padding: 0.125rem 0.25rem; font-weight: 600; color: #383A57; text-transform: uppercase; font-size: 0.5625rem; letter-spacing: 0.05em; width: 2rem;">Cr</th>
                </tr>
              </thead>
              <tbody>
                ${sortedCourses.map((course, idx) => `
                <tr style="border-bottom: 1px solid rgba(209, 213, 219, 0.4); ${idx % 2 === 0 ? 'background: white;' : 'background: rgba(249, 250, 251, 0.3);'}">
                  <td style="padding: 0.125rem 0.25rem; color: #1f2937;">${esc(course.courseName)}</td>
                  <td style="padding: 0.125rem 0.25rem; text-align: center; font-weight: bold; color: #383A57;">${esc(course.grade) || '—'}</td>
                  <td style="padding: 0.125rem 0.25rem; text-align: center; color: #4b5563;">${formatCredits(course.credits)}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        `;
    }).join('')}
    </div>

    <!-- Test Scores -->
    ${transcript.tests && transcript.tests.length > 0 ? `
    <div class="test-scores">
      <div class="test-title">TEST SCORES</div>
      ${transcript.tests.map((test: TestScore) => `
      <div class="test-card">
        <div class="test-header">
          <div class="test-name">${esc(test.testType)}</div>
          ${test.date ? `<div class="test-date">Date: ${formatDate(test.date)}</div>` : ''}
        </div>
        <div class="test-scores-grid">
          ${generateTestScoresHTML(test)}
        </div>
      </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Grading Scale - Above Activities -->
    <div class="grading-scale">
      <div class="grading-scale-content">
        <span style="font-weight: bold; color: #563963; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.7rem; margin-right: 0.5rem;">GRADING SCALE:</span>
        ${((transcript.gradingScale && transcript.gradingScale.length > 0) ? transcript.gradingScale : DEFAULT_GRADING_SCALE).map((scale, idx, arr) => `
        <span class="grading-scale-item">
          <span class="grading-scale-range">${scale.range}:</span>
          <span class="grading-scale-points">${scale.points}</span>
          ${idx < arr.length - 1 ? '<span class="grading-scale-separator">|</span>' : ''}
        </span>
        `).join('')}
      </div>
    </div>

    <!-- Activities & Notes Grid -->
    <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
      <!-- Activities -->
      ${transcript.activities && transcript.activities.length > 0 ? `
      <div class="activities">
        <div class="activities-title">ACTIVITIES & AWARDS</div>
        ${transcript.activities.map((activity: any) => `
        <div class="activity-card">
          <div class="activity-header">
            <div class="activity-name">${esc(activity.title)}</div>
            ${activity.position ? `<div class="activity-position">${esc(activity.position)}</div>` : ''}
            ${activity.years ? `<div class="activity-years">${esc(activity.years)}</div>` : ''}
          </div>
          ${activity.description ? `<div class="activity-description">${esc(activity.description)}</div>` : ''}
          ${(activity.hours || activity.awards) ? `
          <div class="activity-meta">
            ${activity.hours ? `<span><strong>Hours:</strong> ${esc(activity.hours)}</span>` : ''}
            ${activity.awards ? `<span class="award"><strong>Awards:</strong> ${esc(activity.awards)}</span>` : ''}
          </div>
          ` : ''}
        </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- Notes - Conditional -->
      ${transcript.notes && transcript.notes.length > 0 ? `
      <div class="notes-section">
        <div class="notes-title">ADDITIONAL NOTES</div>
        ${transcript.notes.map((note: any) => `
        <div class="note-item">
          ${esc(note.content)}
        </div>
        `).join('')}
      </div>
      ` : ''}
    </div>

    <!-- Signature -->
    ${transcript.signed && transcript.signature ? `
    <div class="signature-section">
      <div class="signature-grid">
        <div>
          <div class="signature-label">SCHOOL ADMINISTRATOR SIGNATURE</div>
          ${transcript.signature.type === 'draw'
                ? `<img src="${/^data:image\//.test(transcript.signature.data || '') ? esc(transcript.signature.data) : ''}" alt="Signature" style="height: 40px; border-bottom: 2px solid #383A57; margin-bottom: 0.25rem;" />`
                : `<div class="signature-handwritten">${esc(transcript.signature.data)}</div>`
            }
          <div class="signature-date">Date: ${formatDate(transcript.signature.date)}</div>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column; justify-content: flex-end;">
          <div style="font-size: 0.65rem; color: #4b5563;">Official Transcript generated by Quill & Compass</div>
        </div>
      </div>
    </div>
    ` : ''}

  </div>
</body>
</html>
  `;
}

function generateTestScoresHTML(test: TestScore): string {
    if (!test.scores) return '';

    return Object.entries(test.scores).map(([key, value]) => `
    <div class="test-score-item">
      <span class="test-score-label">${esc(key)}:</span>
      <span class="test-score-value">${esc(value)}</span>
    </div>
  `).join('');
}
