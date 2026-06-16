"""PDF generation utilities using ReportLab."""
from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import os

JSPM_BLUE = colors.HexColor("#1f4287")
JSPM_RED  = colors.HexColor("#e25162")
JSPM_GOLD = colors.HexColor("#f1c40f")
LIGHT_GRAY = colors.HexColor("#f6f7fb")


def _base_doc(buf, title="Report"):
    return SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=1.5*cm, leftMargin=1.5*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        title=title,
    )


def _header_table(title: str, subtitle: str = "", settings: dict = None):
    styles = getSampleStyleSheet()
    
    # 1. Logo Path
    logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "lcs-logo.png")
    
    # 2. Text Styles
    name_style = ParagraphStyle("name", fontSize=26, textColor=colors.HexColor("#2a4e8a"), 
                                fontName="Times-Bold", alignment=TA_LEFT, leading=30)
    desc_style = ParagraphStyle("desc", fontSize=7.5, textColor=colors.HexColor("#555555"), 
                                fontName="Helvetica", alignment=TA_CENTER, leading=9)
    
    # 3. Build Header Table (Logo | Text)
    logo_img = None
    if os.path.exists(logo_path):
        try:
            logo_img = Image(logo_path, width=2.4*cm, height=2.4*cm)
        except: pass

    # Multi-line description to match the image precisely
    desc_text = "The Language Studio — Attendance Management System"
    
    # Using a nested table for the right side to center the desc under the name
    inner_right = Table([[Paragraph("THE LANGUAGE STUDIO", name_style)], 
                         [Paragraph(desc_text, desc_style)]], colWidths=[15*cm])
    inner_right.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,1), (0,1), -2),
    ]))

    header_tbl = Table([[logo_img, inner_right]], colWidths=[2.8*cm, 15.2*cm])
    header_tbl.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))

    # 4. Dual Color Line (Red | Gray)
    line_tbl = Table([["", ""]], colWidths=[5.5*cm, 12.5*cm], rowHeights=[0.12*cm])
    line_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor("#d32f2f")), # Red
        ('BACKGROUND', (1,0), (1,0), colors.HexColor("#999999")), # Gray
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))

    # 5. Report Title & Subtitle
    h1 = ParagraphStyle("h1", fontSize=14, textColor=colors.black, fontName="Helvetica-Bold", alignment=TA_CENTER)
    h2 = ParagraphStyle("h2", fontSize=10, textColor=colors.gray, fontName="Helvetica", alignment=TA_CENTER)
    gen_time = datetime.now().strftime("%d %b %Y, %I:%M %p")

    return [
        header_tbl,
        Spacer(1, 2),
        line_tbl,
        Spacer(1, 15),
        Paragraph(title.upper(), h1),
        Paragraph(subtitle, h2) if subtitle else Spacer(1, 2),
        Paragraph(f"Generated on: {gen_time}", ParagraphStyle("time", fontSize=8, textColor=colors.lightgrey, alignment=TA_CENTER)),
        Spacer(1, 12),
    ]


def _attendance_table(rows, header_extra=""):
    """rows: list of (roll_no, name, total, attended, percent)"""
    data = [["#", "Roll No", "Student Name", "Total", "Attended", "Absent", "% Attendance", "Status"]]
    for i, (roll, name, total, attended, percent) in enumerate(rows, 1):
        absent = total - attended
        status = "✓ OK" if percent >= 75 else "⚠ Low"
        data.append([str(i), roll, name, str(total), str(attended), str(absent),
                      f"{percent:.1f}%", status])

    col_widths = [1.0*cm, 2.5*cm, 5.0*cm, 1.5*cm, 2.0*cm, 1.5*cm, 2.5*cm, 2.0*cm]
    tbl = Table(data, colWidths=col_widths, repeatRows=1)

    style = [
        ("BACKGROUND", (0, 0), (-1, 0), JSPM_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dde2ee")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    # Color low-attendance rows
    for i, (_, _, total, attended, percent) in enumerate(rows, 1):
        if percent < 75:
            style.append(("TEXTCOLOR", (7, i), (7, i), JSPM_RED))
            style.append(("FONTNAME", (7, i), (7, i), "Helvetica-Bold"))
        else:
            style.append(("TEXTCOLOR", (7, i), (7, i), colors.HexColor("#2e7d32")))
    tbl.setStyle(TableStyle(style))
    return tbl


def generate_attendance_pdf(title: str, subtitle: str = "", rows=None, lecture_times=None, settings: dict = None) -> BytesIO:
    buf = BytesIO()
    doc = _base_doc(buf, title)
    story = _header_table(title, subtitle, settings)

    if lecture_times:
        styles = getSampleStyleSheet()
        lt_style = ParagraphStyle("lt", fontSize=8, textColor=colors.gray)
        story.append(Paragraph(f"Lecture Times: {', '.join(lecture_times)}", lt_style))
        story.append(Spacer(1, 6))

    if rows:
        story.append(_attendance_table(rows))
        present_count = sum(1 for r in rows if r[4] >= 75)
        low_count = len(rows) - present_count
        summary_data = [["Total Students", "≥75% Attendance", "<75% (Defaulters)"],
                         [str(len(rows)), str(present_count), str(low_count)]]
        summary_tbl = Table(summary_data, colWidths=[5*cm, 5*cm, 5*cm])
        summary_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), JSPM_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (2, 1), (2, 1), colors.HexColor("#ffebee")),
            ("TEXTCOLOR", (2, 1), (2, 1), JSPM_RED),
        ]))
        story.append(Spacer(1, 12))
        story.append(summary_tbl)

    doc.build(story)
    buf.seek(0)
    return buf


def generate_defaulters_pdf(title: str, rows, settings: dict = None) -> BytesIO:
    """rows: (roll_no, name, class_, attended, total, percent)"""
    buf = BytesIO()
    doc = _base_doc(buf, title)
    story = _header_table(title, "Students with Attendance < 75%", settings)

    data = [["#", "Roll No", "Name", "Class", "Attended", "Total", "% Attendance"]]
    for i, (roll, name, cls, attended, total, percent) in enumerate(rows, 1):
        data.append([str(i), roll, name, cls, str(attended), str(total), f"{percent:.1f}%"])

    col_widths = [1.0*cm, 2.5*cm, 5.5*cm, 3.0*cm, 2.0*cm, 2.0*cm, 2.0*cm]
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), JSPM_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TEXTCOLOR", (6, 1), (6, -1), JSPM_RED),
        ("FONTNAME", (6, 1), (6, -1), "Helvetica-Bold"),
    ]))
    story.append(tbl)
    doc.build(story)
    buf.seek(0)
    return buf


def generate_student_report_pdf(name: str, roll_no: str, class_name: str,
                                  subject_data, start: str, end: str, settings: dict = None) -> BytesIO:
    """subject_data: [(subject, attended, total, percent), ...]"""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    story = _header_table(f"My Attendance Report", f"{name}  |  {roll_no}  |  {class_name}", settings)
    story.append(Paragraph(f"Period: {start} to {end}",
                           ParagraphStyle("sub", fontSize=9, textColor=colors.gray, alignment=TA_CENTER)))
    story.append(Spacer(1, 12))

    data = [["Subject", "Attended", "Total", "% Attendance", "Status"]]
    for sub, attended, total, percent in subject_data:
        status = "✓ OK" if percent >= 75 else "⚠ Low"
        data.append([sub, str(attended), str(total), f"{percent:.1f}%", status])

    tbl = Table(data, colWidths=[6.5*cm, 2*cm, 2*cm, 3.5*cm, 3*cm], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), JSPM_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    for i, (_, _, _, percent) in enumerate(subject_data, 1):
        color = colors.HexColor("#2e7d32") if percent >= 75 else JSPM_RED
        style.append(("TEXTCOLOR", (4, i), (4, i), color))
        style.append(("FONTNAME", (4, i), (4, i), "Helvetica-Bold"))
    tbl.setStyle(TableStyle(style))
    story.append(tbl)
    doc.build(story)
    buf.seek(0)
    return buf


def generate_teacher_report_pdf(title: str, subtitle: str, rows, settings: dict = None) -> BytesIO:
    """rows: (name, dept, phone, sessions, last_active)"""
    buf = BytesIO()
    doc = _base_doc(buf, title)
    story = _header_table(title, subtitle, settings)

    data = [["#", "Teacher Name", "Department", "Phone", "Sessions", "Last Activity"]]
    for i, (name, dept, phone, sessions, last) in enumerate(rows, 1):
        data.append([str(i), name, dept, phone, str(sessions), last or "Never"])

    col_widths = [1.0*cm, 5.0*cm, 4.0*cm, 3.0*cm, 2.0*cm, 3.0*cm]
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), JSPM_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tbl)
    doc.build(story)
    buf.seek(0)
    return buf
