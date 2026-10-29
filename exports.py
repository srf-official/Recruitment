"""Generate real XLSX and individual DOCX documents on the authenticated server."""
import io
import re
import zipfile

from docx import Document
from docx.shared import Inches, Pt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

from domain import grade


def filename(value):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', str(value)).rstrip('. ')[:160] or 'candidate'
    return '_' + name if re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', name, re.I) else name


def minutes(a):
    if isinstance(a.get('importedElapsedMinutes'), (int, float)):
        return round(max(0, a['importedElapsedMinutes']), 4)
    return round(max(0, (a['submittedAt'] - a['startedAt']) / 60000), 4) if a.get('submittedAt') else None


def results_rows(test, attempts, minimum_marks=None, minimum_time=None):
    output = []
    for a in attempts:
        g, elapsed = grade(test['questions'], a), minutes(a)
        if minimum_marks is not None and (not a.get('submittedAt') or g['total'] < minimum_marks):
            continue
        if minimum_time is not None and (elapsed is None or elapsed < minimum_time):
            continue
        output.append((a, g, elapsed))
    return sorted(output, key=lambda row: (not bool(row[0].get('submittedAt')), -row[1]['total'], row[2] or 0))


def language_parts(test, grading):
    scores = {result['id']: result['score'] for result in grading['results']}
    values = []
    for group in (test['questions'][:20], test['questions'][20:25]):
        marks = [scores.get(q['id']) for q in group]
        values.append(None if any(mark is None for mark in marks) else round(sum(marks), 6))
    return values


def style_sheet(sheet, widths=None):
    for row in sheet:
        for cell in row:
            if isinstance(cell.value, str):
                cell.data_type = 's'
            cell.alignment = Alignment(vertical='top', wrap_text=True)
    for cell in sheet[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='038681')
    for index in range(1, sheet.max_column + 1):
        sheet.column_dimensions[sheet.cell(1, index).column_letter].width = (widths[index - 1] if widths and index <= len(widths) else 24)
    sheet.freeze_panes = 'A2'
    sheet.auto_filter.ref = sheet.dimensions


def workbook_bytes(book):
    stream = io.BytesIO()
    book.save(stream)
    return stream.getvalue()


def excel(drive, test, rows):
    book = Workbook()
    sheet = book.active
    sheet.title = 'Candidate results'
    language = test['type'] == 'language'
    sheet.append(['Drive name', 'Student name', 'Student ID', 'Total marks' if language else 'Marks obtained'] +
                 (['Language score (20)', 'Reasoning score (5)'] if language else []) +
                 ['Time taken (minutes)', 'Pending questions', 'Shortlisted', 'Assessment', 'Remarks'])
    for a, g, elapsed in rows:
        sheet.append([drive['name'], a['name'], a['studentId'], g['total'] if a.get('submittedAt') else None] +
                     (language_parts(test, g) if language and a.get('submittedAt') else [None, None] if language else []) +
                     [elapsed, g['pending'] if a.get('submittedAt') else None,
                      'Yes' if a.get('shortlisted') else 'No', test['type'], a.get('shortlistRemarks', '')])
    style_sheet(sheet, [34, 28, 20])
    return workbook_bytes(book)


def gd_excel(drive, mode='roster'):
    book = Workbook()
    gd = drive['gd']
    if mode == 'roster':
        sheet = book.active
        sheet.title = 'GD pools'
        sheet.append(['Drive name', 'Pool', '#', 'Candidate name', 'Student ID'])
        for pool in gd['pools']:
            for index, key in enumerate(pool['members'], start=1):
                member = gd['candidates'][key]
                sheet.append([drive['name'], pool['name'], index, member['name'], member['studentId']])
        style_sheet(sheet, [34, 18, 8, 32, 24])
    else:
        book.remove(book.active)
        fields = ('initiative', 'content', 'communication', 'bodyLanguage')
        for index, pool in enumerate(gd['pools'], start=1):
            sheet = book.create_sheet(pool['name'][:31])
            sheet.append(['Drive name', 'Pool', 'Evaluator', '#', 'Candidate name', 'Student ID',
                          'Initiative (5)', 'Content (5)', 'Communication (5)', 'Body Language (5)', 'Total (20)', 'Recommend'])
            for number, key in enumerate(pool['members'], start=1):
                member, score = gd['candidates'][key], gd.get('scores', {}).get(key, {})
                sheet.append([drive['name'], pool['name'], pool.get('evaluatorName', ''), number, member['name'], member['studentId']] +
                             [score.get(field) for field in fields] + [score.get('total'), 'Yes' if score.get('shortlisted') else 'No'])
            style_sheet(sheet, [34, 18, 26, 8, 32, 24])
    return workbook_bytes(book)


def words(drive, test, attempts):
    stream, names = io.BytesIO(), set()
    with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
        for a in attempts:
            doc = Document()
            section = doc.sections[0]
            section.top_margin = section.bottom_margin = Inches(.75)
            doc.styles['Normal'].font.name = 'Calibri'
            doc.styles['Normal'].font.size = Pt(11)
            title = doc.add_paragraph('Prompt Engineering response')
            title.runs[0].bold = True
            doc.add_paragraph(drive['name'])
            doc.add_paragraph(f"Student name: {a['name']}\nStudent ID: {a['studentId']}\nTime taken: {minutes(a):.2f} minutes\nSubmission: {a.get('reason', 'submitted')}")
            for i, q in enumerate(test['questions']):
                p = doc.add_paragraph(f'Question {i + 1}')
                p.runs[0].bold = True
                doc.add_paragraph(q['text'])
                p = doc.add_paragraph('Response')
                p.runs[0].bold = True
                doc.add_paragraph(a.get('responses', {}).get(q['id']) or '(No answer entered)')
            data = io.BytesIO()
            doc.save(data)
            base, suffix = filename(a['name'] + '_' + a['studentId']), 1
            name = base + '.docx'
            while name.casefold() in names:
                suffix += 1
                name = f'{base}_{suffix}.docx'
            names.add(name.casefold())
            archive.writestr(name, data.getvalue())
    return stream.getvalue()



def final_excel(drive, rows):
    book = Workbook()
    sheet = book.active
    sheet.title = 'Final scores'
    sheet.append(['Drive name', 'Candidate name', 'Student ID', 'Aptitude score', 'Shortlisted in Aptitude',
                  'GD score (20)', 'GD recommend', 'GD evaluator', 'Language & Reasoning score', 'Interview shortlisted',
                  'Interview remarks', 'Prompt Engineering score (10)', 'Interviewer', 'Final status'])
    for row in rows:
        sheet.append([drive['name'], row['name'], row['studentId'], row.get('aptitudeScore'),
                      'Yes' if row.get('aptitudeShortlisted') else 'No', row.get('gdScore'),
                      'Yes' if row.get('gdRecommended') else 'No', row.get('gdEvaluator', ''), row.get('languageScore'),
                      'Yes' if row.get('interviewShortlisted') else 'No', row.get('interviewRemarks', ''), row.get('promptScore'),
                      row.get('interviewer', ''),
                      {'none': 'None', 'selected': 'Selected', 'on-hold': 'On hold', 'rejected': 'Rejected'}.get(row.get('outcome'), 'None')])
    style_sheet(sheet, [34, 28, 20, 18, 24, 16, 18, 26, 28, 24, 45, 30, 26, 18])
    return workbook_bytes(book)
