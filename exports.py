"""Generate real XLSX and individual DOCX documents on the authenticated server."""
import io
import re
import zipfile

from docx import Document
from docx.shared import Inches, Pt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

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


def excel(drive, test, rows):
    book = Workbook()
    sheet = book.active
    sheet.title = 'Candidate results'
    sheet.append(['Drive name', 'Student name', 'Student ID', 'Marks obtained', 'Time taken (minutes)',
                  'Pending questions', 'Shortlisted', 'Assessment'])
    for a, g, elapsed in rows:
        sheet.append([drive['name'], a['name'], a['studentId'], g['total'] if a.get('submittedAt') else None,
                      elapsed, g['pending'] if a.get('submittedAt') else None,
                      'Yes' if a.get('shortlisted') else 'No', test['type']])
        for cell in sheet[sheet.max_row]:
            if isinstance(cell.value, str):
                cell.data_type = 's'  # Candidate names/IDs can never become Excel formulas.
    for cell in sheet[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='038681')
    for column, width in zip('ABCDEFGH', [34, 28, 20, 20, 24, 20, 18, 24]):
        sheet.column_dimensions[column].width = width
    sheet.freeze_panes = 'A2'
    sheet.auto_filter.ref = sheet.dimensions
    stream = io.BytesIO()
    book.save(stream)
    return stream.getvalue()


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
    headers = ['Drive name', 'Candidate name', 'Student ID', 'Aptitude score', 'Shortlisted in Aptitude',
               'GD score (20)', 'GD recommend', 'Language & Reasoning score', 'Prompt Engineering score (10)',
               'Interview shortlisted', 'Final status']
    sheet.append(headers)
    for row in rows:
        sheet.append([drive['name'], row['name'], row['studentId'], row.get('aptitudeScore'),
                      'Yes' if row.get('aptitudeShortlisted') else 'No', row.get('gdScore'),
                      'Yes' if row.get('gdRecommended') else 'No', row.get('languageScore'),
                      row.get('promptScore'), 'Yes' if row.get('interviewShortlisted') else 'No',
                      {'none': 'None', 'selected': 'Selected', 'on-hold': 'On hold', 'rejected': 'Rejected'}.get(row.get('outcome'), 'None')])
        for cell in sheet[sheet.max_row]:
            if isinstance(cell.value, str):
                cell.data_type = 's'
    for cell in sheet[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor='038681')
    widths = [34, 28, 20, 18, 24, 16, 18, 28, 30, 24, 18]
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[sheet.cell(1, index).column_letter].width = width
    sheet.freeze_panes = 'A2'
    sheet.auto_filter.ref = sheet.dimensions
    stream = io.BytesIO()
    book.save(stream)
    return stream.getvalue()
