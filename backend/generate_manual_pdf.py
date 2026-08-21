import os
import sys
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# Ensure output directories exist
ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'manual_assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

# -------------------------------------------------------------
# 1. CHART & DIAGRAM GENERATORS (MATPLOTLIB)
# -------------------------------------------------------------

def generate_payoff_chart():
    fig, ax = plt.subplots(figsize=(7, 3.2), dpi=200)
    fig.patch.set_facecolor('#0d1117')
    ax.set_facecolor('#161b22')

    spot = 22500
    strikes = np.linspace(21500, 23500, 500)

    # Iron Condor payoff: Long 21800 PE, Short 22100 PE, Short 22900 CE, Long 23200 CE
    net_credit = 85.0
    payoff_exp = np.zeros_like(strikes)
    for i, s in enumerate(strikes):
        p_long_put = max(0, 21800 - s)
        p_short_put = -max(0, 22100 - s)
        p_short_call = -max(0, s - 22900)
        p_long_call = max(0, s - 23200)
        payoff_exp[i] = (net_credit + p_long_put + p_short_put + p_short_call + p_long_call) * 50

    # Smooth T+0 curve simulation
    payoff_t0 = payoff_exp * 0.45 + np.exp(-((strikes - spot) / 600)**2) * (net_credit * 50 * 0.55) - 350

    ax.plot(strikes, payoff_exp, label='Payoff at Expiry (T+Expiry)', color='#a855f7', linewidth=2.2, linestyle='--')
    ax.plot(strikes, payoff_t0, label='Current Payoff (T+0)', color='#00f2fe', linewidth=2.5)

    ax.axhline(0, color='#475569', linestyle='-', linewidth=0.8)
    ax.axvline(spot, color='#eab308', linestyle=':', linewidth=1.5, label=f'Current Spot ({spot:,})')
    ax.axvline(22100, color='#ef4444', linestyle=':', linewidth=1, alpha=0.7)
    ax.axvline(22900, color='#ef4444', linestyle=':', linewidth=1, alpha=0.7)

    # Shade profit/loss zones
    ax.fill_between(strikes, 0, payoff_exp, where=(payoff_exp >= 0), color='#10b981', alpha=0.15, label='Profit Zone')
    ax.fill_between(strikes, 0, payoff_exp, where=(payoff_exp < 0), color='#ef4444', alpha=0.15, label='Loss Zone')

    ax.set_title('Iron Condor Payoff Simulation (T+0 vs Expiry Curve)', color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax.set_xlabel('Underlying Price (NIFTY Spot)', color='#94a3b8', fontsize=9)
    ax.set_ylabel('Net Profit / Loss (₹)', color='#94a3b8', fontsize=9)
    ax.tick_params(colors='#94a3b8', labelsize=8)
    for spine in ax.spines.values():
        spine.set_color('#334155')

    ax.grid(True, color='#1e293b', linestyle='--', linewidth=0.5, alpha=0.6)
    ax.legend(loc='upper right', facecolor='#0f172a', edgecolor='#334155', fontsize=7.5, labelcolor='#e2e8f0')

    chart_path = os.path.join(ASSETS_DIR, 'payoff_chart.png')
    plt.tight_layout()
    plt.savefig(chart_path, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    return chart_path


def generate_backtest_equity_chart():
    fig, ax1 = plt.subplots(figsize=(7, 3.2), dpi=200)
    fig.patch.set_facecolor('#0d1117')
    ax1.set_facecolor('#161b22')

    days = np.arange(0, 250)
    np.random.seed(42)
    daily_returns = np.random.normal(0.0018, 0.008, size=len(days))
    daily_returns[50:60] -= 0.015
    daily_returns[150:165] -= 0.012

    equity_curve = 100000 * np.cumprod(1 + daily_returns)
    peak = np.maximum.accumulate(equity_curve)
    drawdown = (equity_curve - peak) / peak * 100

    ax1.plot(days, equity_curve, color='#10b981', linewidth=2, label='Portfolio Cumulative Equity (₹)')
    ax1.set_xlabel('Trading Days', color='#94a3b8', fontsize=9)
    ax1.set_ylabel('Portfolio Value (₹)', color='#10b981', fontsize=9)
    ax1.tick_params(colors='#94a3b8', labelsize=8)

    ax2 = ax1.twinx()
    ax2.fill_between(days, 0, drawdown, color='#ef4444', alpha=0.25, label='Drawdown (%)')
    ax2.plot(days, drawdown, color='#ef4444', linewidth=1, linestyle='--')
    ax2.set_ylabel('Drawdown (%)', color='#ef4444', fontsize=9)
    ax2.tick_params(colors='#ef4444', labelsize=8)
    ax2.set_ylim(-30, 5)

    ax1.set_title('Historical Backtester: Equity Curve & Drawdown Profile', color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    for spine in ax1.spines.values():
        spine.set_color('#334155')
    for spine in ax2.spines.values():
        spine.set_color('#334155')

    ax1.grid(True, color='#1e293b', linestyle='--', linewidth=0.5, alpha=0.6)
    
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', facecolor='#0f172a', edgecolor='#334155', fontsize=7.5, labelcolor='#e2e8f0')

    chart_path = os.path.join(ASSETS_DIR, 'backtest_chart.png')
    plt.tight_layout()
    plt.savefig(chart_path, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    return chart_path


def generate_volatility_cone_chart():
    fig, ax = plt.subplots(figsize=(7, 3.2), dpi=200)
    fig.patch.set_facecolor('#0d1117')
    ax.set_facecolor('#161b22')

    windows = np.array([7, 14, 30, 45, 60, 90, 180, 252])
    p90 = np.array([28.5, 26.2, 24.1, 22.8, 21.5, 20.2, 19.1, 18.2])
    p75 = np.array([23.1, 21.5, 19.8, 18.9, 18.0, 17.2, 16.5, 15.8])
    p50 = np.array([17.8, 16.5, 15.2, 14.8, 14.2, 13.9, 13.5, 13.1])
    p25 = np.array([13.2, 12.5, 11.8, 11.5, 11.2, 11.0, 10.8, 10.5])
    p10 = np.array([9.5, 9.2, 8.8, 8.5, 8.3, 8.2, 8.1, 8.0])

    current_iv = np.array([22.5, 20.8, 18.5, 17.2, 16.4, 15.8, 15.2, 14.6])

    ax.fill_between(windows, p10, p90, color='#3b82f6', alpha=0.12, label='10th - 90th Percentile')
    ax.fill_between(windows, p25, p75, color='#3b82f6', alpha=0.22, label='25th - 75th Percentile')
    ax.plot(windows, p50, color='#94a3b8', linestyle='--', linewidth=1.5, label='Median (50th %ile)')
    ax.plot(windows, current_iv, color='#f59e0b', marker='o', linewidth=2.2, label='Current Realized / Implied IV')

    ax.set_title('Volatility Cone: Multi-Horizon IV vs Historical Volatility', color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax.set_xlabel('Lookback Window (Days)', color='#94a3b8', fontsize=9)
    ax.set_ylabel('Annualized Volatility (%)', color='#94a3b8', fontsize=9)
    ax.tick_params(colors='#94a3b8', labelsize=8)
    for spine in ax.spines.values():
        spine.set_color('#334155')

    ax.grid(True, color='#1e293b', linestyle='--', linewidth=0.5, alpha=0.6)
    ax.legend(loc='upper right', facecolor='#0f172a', edgecolor='#334155', fontsize=7.5, labelcolor='#e2e8f0')

    chart_path = os.path.join(ASSETS_DIR, 'volatility_cone_chart.png')
    plt.tight_layout()
    plt.savefig(chart_path, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    return chart_path


def generate_greeks_dynamics_chart():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7, 2.8), dpi=200)
    fig.patch.set_facecolor('#0d1117')
    
    # Subplot 1: Theta Decay vs DTE
    ax1.set_facecolor('#161b22')
    dte = np.linspace(45, 0, 200)
    theta_decay = -1 / (np.sqrt(np.maximum(dte, 0.5))) * 12.0
    ax1.plot(dte, theta_decay, color='#ef4444', linewidth=2)
    ax1.set_title('Theta Decay Acceleration (Time vs Theta)', color='#f8fafc', fontsize=9.5, fontweight='bold')
    ax1.set_xlabel('Days to Expiration (DTE)', color='#94a3b8', fontsize=8)
    ax1.set_ylabel('Theta (Time Decay ₹/day)', color='#94a3b8', fontsize=8)
    ax1.invert_xaxis()
    ax1.tick_params(colors='#94a3b8', labelsize=7.5)
    ax1.grid(True, color='#1e293b', linestyle='--', linewidth=0.5, alpha=0.6)
    for spine in ax1.spines.values():
        spine.set_color('#334155')

    # Subplot 2: Delta S-Curve (Call vs Put)
    ax2.set_facecolor('#161b22')
    moneyness = np.linspace(0.85, 1.15, 200)
    call_delta = 1 / (1 + np.exp(-(moneyness - 1.0) * 28))
    put_delta = call_delta - 1
    ax2.plot(moneyness, call_delta, color='#10b981', linewidth=2, label='Call Delta (0 to +1)')
    ax2.plot(moneyness, put_delta, color='#f59e0b', linewidth=2, label='Put Delta (-1 to 0)')
    ax2.axvline(1.0, color='#64748b', linestyle=':', label='ATM (Moneyness=1.0)')
    ax2.set_title('Delta Sensitivity Curve (OTM to ITM)', color='#f8fafc', fontsize=9.5, fontweight='bold')
    ax2.set_xlabel('Spot / Strike (Moneyness)', color='#94a3b8', fontsize=8)
    ax2.set_ylabel('Delta Value', color='#94a3b8', fontsize=8)
    ax2.tick_params(colors='#94a3b8', labelsize=7.5)
    ax2.grid(True, color='#1e293b', linestyle='--', linewidth=0.5, alpha=0.6)
    ax2.legend(loc='lower right', facecolor='#0f172a', edgecolor='#334155', fontsize=6.5, labelcolor='#e2e8f0')
    for spine in ax2.spines.values():
        spine.set_color('#334155')

    chart_path = os.path.join(ASSETS_DIR, 'greeks_dynamics.png')
    plt.tight_layout()
    plt.savefig(chart_path, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    return chart_path


def generate_system_architecture_diagram():
    fig, ax = plt.subplots(figsize=(7, 3.4), dpi=200)
    fig.patch.set_facecolor('#0d1117')
    ax.set_facecolor('#0d1117')
    ax.axis('off')

    def draw_box(x, y, w, h, title, subtitle, color, bg):
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.04,rounding_size=0.08",
                                      linewidth=1.5, edgecolor=color, facecolor=bg)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h*0.65, title, ha='center', va='center', color='#f8fafc', fontsize=8.5, fontweight='bold')
        ax.text(x + w/2, y + h*0.3, subtitle, ha='center', va='center', color='#94a3b8', fontsize=6.8)

    def draw_arrow(x1, y1, x2, y2, label=""):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", color='#38bdf8', lw=1.5, shrinkA=3, shrinkB=3))
        if label:
            ax.text((x1+x2)/2, (y1+y2)/2 + 0.03, label, color='#38bdf8', fontsize=6.5, ha='center', fontweight='bold')

    # Left: Data Sources
    draw_box(0.05, 0.65, 0.22, 0.26, "Live Market Feeds", "Dhan / Kotak / NSE", "#38bdf8", "#0f172a")
    draw_box(0.05, 0.15, 0.22, 0.26, "Historical DB", "SQLite / Async Engine", "#a855f7", "#0f172a")

    # Center: Backend Core & Math Engine
    draw_box(0.38, 0.40, 0.26, 0.40, "Quant Engine (FastAPI)", "Black-Scholes & Greeks\nAuto-Scanner & Backtest", "#10b981", "#064e3b")

    # Right: Frontend UI & Execution
    draw_box(0.74, 0.65, 0.22, 0.26, "Option Oracle React UI", "Payoff, Chain & Alerts", "#f59e0b", "#0f172a")
    draw_box(0.74, 0.15, 0.22, 0.26, "Order Router", "Live / Paper Trading Book", "#ef4444", "#0f172a")

    # Connections
    draw_arrow(0.27, 0.78, 0.38, 0.65, "Ticks / IV")
    draw_arrow(0.27, 0.28, 0.38, 0.45, "Historical Data")
    draw_arrow(0.64, 0.65, 0.74, 0.78, "WebSocket / REST")
    draw_arrow(0.74, 0.28, 0.64, 0.45, "Basket Orders")
    draw_arrow(0.85, 0.65, 0.85, 0.41, "One-Click Trade")

    ax.set_xlim(0, 1.02)
    ax.set_ylim(0.05, 1.0)

    chart_path = os.path.join(ASSETS_DIR, 'system_architecture.png')
    plt.tight_layout()
    plt.savefig(chart_path, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    return chart_path


# -------------------------------------------------------------
# 2. REPORTLAB NUMBERED CANVAS FOR HEADER & FOOTER
# -------------------------------------------------------------

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_header_footer(self, page_count):
        if self._pageNumber == 1:
            return  # Skip cover page

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header
        self.drawString(54, 750, "Option Chief / Option Oracle — Comprehensive Technical User Manual & Trading Guide")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 744, 558, 744)

        # Running Footer
        self.line(54, 48, 558, 48)
        self.drawString(54, 36, "Confidential & Proprietary — For Option Chief & Quantitative Traders")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.restoreState()


# -------------------------------------------------------------
# 3. BUILD COMPLETE PDF MANUAL
# -------------------------------------------------------------

def build_pdf_manual(output_filepath):
    print("Generating charts and visual diagrams...")
    payoff_img = generate_payoff_chart()
    backtest_img = generate_backtest_equity_chart()
    cone_img = generate_volatility_cone_chart()
    greeks_img = generate_greeks_dynamics_chart()
    arch_img = generate_system_architecture_diagram()

    print("Setting up PDF Document layout...")
    doc = SimpleDocTemplate(
        output_filepath,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0f172a")
    c_brand = colors.HexColor("#0284c7")
    c_accent = colors.HexColor("#0d9488")
    c_text = colors.HexColor("#1e293b")
    c_muted = colors.HexColor("#64748b")
    c_light_bg = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=colors.HexColor("#0f172a"),
        alignment=0
    )
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0284c7"),
        alignment=0
    )
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#0369a1"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_text,
        spaceAfter=5
    )
    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.6,
        leading=12.4,
        textColor=c_text,
        leftIndent=14,
        spaceAfter=3
    )
    callout_style = ParagraphStyle(
        'Callout_Text',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#0f172a")
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=10,
        textColor=c_text
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#0f172a")
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    story = []

    def make_callout(text, bg_color="#f0f9ff", border_color="#0284c7"):
        p = Paragraph(f"<b>KEY TAKEAWAY:</b> {text}", callout_style)
        t = Table([[p]], colWidths=[504])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor(bg_color)),
            ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor(border_color)),
            ('PADDING', (0,0), (-1,-1), 7),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        return t

    # -------------------------------------------------------------
    # COVER PAGE
    # -------------------------------------------------------------
    story.append(Spacer(1, 20))
    badge_table = Table([[Paragraph("<b>QUANTITATIVE TRADING PLATFORM</b>", ParagraphStyle('B', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white))]], colWidths=[180])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_brand),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph("OPTION ORACLE & OPTION CHIEF", title_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph("Complete Technical User Manual & Quantitative Options Strategy Guide", subtitle_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=2, color=c_brand, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "A comprehensive reference manual covering multi-leg algorithmic options scanning, real-time Black-Scholes Greeks analysis, "
        "interactive payoff modeling (T+0 vs Expiry), historical strategy backtesting, volatility cone forecasting, and seamless broker integration.",
        body_style
    ))
    story.append(Spacer(1, 8))

    story.append(Image(arch_img, width=6.8*inch, height=3.2*inch))
    story.append(Spacer(1, 12))

    meta_data = [
        [Paragraph("<b>Version:</b> 2.4.0 (Production Release)", table_cell), Paragraph("<b>Target Markets:</b> NSE / BSE / Global Indices", table_cell)],
        [Paragraph("<b>Execution Layer:</b> Dhan & Kotak Neo APIs", table_cell), Paragraph("<b>Math Engine:</b> Analytical Black-Scholes-Merton", table_cell)],
        [Paragraph("<b>Author:</b> Option Chief Quantitative Engineering Team", table_cell), Paragraph("<b>Published:</b> August 2026", table_cell)]
    ]
    meta_table = Table(meta_data, colWidths=[252, 252])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(meta_table)

    story.append(PageBreak())

    # -------------------------------------------------------------
    # TABLE OF CONTENTS
    # -------------------------------------------------------------
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    toc_data = [
        [Paragraph("<b>Chapter 1: System Overview & Core Architecture</b>", table_cell_bold), Paragraph("Page 3", table_cell)],
        [Paragraph("<b>Chapter 2: Option Chain & Real-Time Analytics</b>", table_cell_bold), Paragraph("Page 4", table_cell)],
        [Paragraph("<b>Chapter 3: Strategy Screener & Algorithmic Scanner</b>", table_cell_bold), Paragraph("Page 5", table_cell)],
        [Paragraph("<b>Chapter 4: Auto-Scanner & Real-Time Strategy Alerts</b>", table_cell_bold), Paragraph("Page 6", table_cell)],
        [Paragraph("<b>Chapter 5: Strategy Builder Sandbox & Payoff Analysis</b>", table_cell_bold), Paragraph("Page 7", table_cell)],
        [Paragraph("<b>Chapter 6: Quantitative Historical Backtester</b>", table_cell_bold), Paragraph("Page 8", table_cell)],
        [Paragraph("<b>Chapter 7: Volatility Cone & Implied Volatility Analysis</b>", table_cell_bold), Paragraph("Page 9", table_cell)],
        [Paragraph("<b>Chapter 8: Multi-Timeframe RSI Momentum Scanner</b>", table_cell_bold), Paragraph("Page 10", table_cell)],
        [Paragraph("<b>Chapter 9: Portfolio Manager & Paper Trading Book</b>", table_cell_bold), Paragraph("Page 11", table_cell)],
        [Paragraph("<b>Chapter 10: Automated Hedging Advisor</b>", table_cell_bold), Paragraph("Page 12", table_cell)],
        [Paragraph("<b>Chapter 11: Broker API Integration (Dhan & Kotak Neo)</b>", table_cell_bold), Paragraph("Page 13", table_cell)],
        [Paragraph("<b>Chapter 12: Options Greeks Masterclass & Mathematical Formulas</b>", table_cell_bold), Paragraph("Page 14", table_cell)],
        [Paragraph("<b>Chapter 13: Keyboard Shortcuts, Settings & FAQ</b>", table_cell_bold), Paragraph("Page 15", table_cell)],
    ]
    toc_table = Table(toc_data, colWidths=[420, 84])
    toc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 4.5),
    ]))
    story.append(toc_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # CHAPTER 1: SYSTEM OVERVIEW & ARCHITECTURE
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 1: System Overview & Core Architecture", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph(
        "<b>Option Oracle / Option Chief</b> is an institutional-grade algorithmic options analytics and trade management platform. "
        "It integrates real-time index and equity options pricing with an analytical Black-Scholes-Merton math core, automated background scanner engine, "
        "multi-leg payoff simulation sandbox, and unified live broker routing.",
        body_style
    ))
    story.append(Paragraph("Key architectural highlights include:", body_style))
    story.append(Paragraph("• <b>Sub-Millisecond Greeks Engine:</b> Computes Delta, Gamma, Theta, Vega, Rho, and Implied Volatility (IV) using vectorized Newton-Raphson iterations.", bullet_style))
    story.append(Paragraph("• <b>T+0 vs Expiry Curve Modeling:</b> Instantaneous payoff projection across spot price shocks, volatility shifts, and temporal decay.", bullet_style))
    story.append(Paragraph("• <b>Algorithmic Auto-Scanner:</b> Background evaluation of hundreds of multi-leg combinations across multiple expiries with custom probability and risk-reward filters.", bullet_style))
    story.append(Paragraph("• <b>Direct Broker Routing:</b> Direct webhook and REST order placement with lot-size normalization for Dhan and Kotak Neo API endpoints.", bullet_style))
    story.append(Spacer(1, 6))
    story.append(make_callout("All calculations, margin estimates, and Greek aggregations run locally or via high-performance microservices, ensuring maximum speed during volatile market hours."))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 2: OPTION CHAIN & REAL-TIME ANALYTICS
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 2: Option Chain & Real-Time Analytics", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Option Chain module displays the complete multi-strike matrix for the selected underlying instrument (e.g. NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY).",
        body_style
    ))
    story.append(Paragraph("<b>Critical Metrics on the Option Chain:</b>", h2_style))
    
    chain_table_data = [
        [Paragraph("Metric", table_header), Paragraph("Formula / Description", table_header), Paragraph("Trading Interpretation", table_header)],
        [Paragraph("<b>PCR (Put-Call Ratio)</b>", table_cell_bold), Paragraph("Total Put Open Interest / Total Call Open Interest", table_cell), Paragraph("PCR > 1.2 indicates Bullish sentiment; PCR < 0.7 indicates Bearish exhaustion.", table_cell)],
        [Paragraph("<b>Max Pain Strike</b>", table_cell_bold), Paragraph("Strike where option buyers lose maximum cumulative premium", table_cell), Paragraph("Gravitational pin price target for market makers on contract expiry day.", table_cell)],
        [Paragraph("<b>IV (Implied Volatility)</b>", table_cell_bold), Paragraph("Annualized standard deviation implied by market option premium", table_cell), Paragraph("High IV implies rich option premium (favors selling); Low IV favors buying.", table_cell)],
        [Paragraph("<b>Delta (Δ)</b>", table_cell_bold), Paragraph("∂V / ∂S (Rate of change of option price per ₹1 spot change)", table_cell), Paragraph("Hedge ratio and proxy for Probability of Expiring In-The-Money (ITM).", table_cell)],
        [Paragraph("<b>Theta (Θ)</b>", table_cell_bold), Paragraph("∂V / ∂t (Rate of decay of option price per calendar day)", table_cell), Paragraph("Daily cash-flow harvest for option sellers; cost of holding for buyers.", table_cell)]
    ]
    ct = Table(chain_table_data, colWidths=[100, 204, 200])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(ct)
    story.append(Spacer(1, 8))
    story.append(Paragraph("<b>Workflow: Adding Legs from Option Chain</b>", h2_style))
    story.append(Paragraph("1. Click the <b>Call Ask/Bid</b> or <b>Put Ask/Bid</b> cell on any strike row to directly append a Buy or Sell leg to the Strategy Builder.", bullet_style))
    story.append(Paragraph("2. Use the <b>Expiry Dropdown</b> to switch between Weekly and Monthly expiration cycles instantly.", bullet_style))
    story.append(Paragraph("3. View real-time color highlights for <b>In-The-Money (ITM)</b>, <b>At-The-Money (ATM)</b>, and <b>Out-Of-The-Money (OTM)</b> zones.", bullet_style))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 3: STRATEGY SCREENER & ALGORITHMIC SCANNER
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 3: Strategy Screener & Algorithmic Scanner", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Strategy Screener automatically scans thousands of strike combinations across multiple strategy archetypes, "
        "filtering them according to statistical profitability criteria and quantitative Greek constraints.",
        body_style
    ))
    story.append(Paragraph("<b>Supported Strategy Templates:</b>", h2_style))

    strat_data = [
        [Paragraph("Strategy", table_header), Paragraph("Leg Structure", table_header), Paragraph("Optimal Market Regime", table_header), Paragraph("Risk Profile", table_header)],
        [Paragraph("<b>Iron Condor</b>", table_cell_bold), Paragraph("Short OTM Put + Long Far OTM Put<br/>Short OTM Call + Long Far OTM Call", table_cell), Paragraph("Low volatility range-bound consolidation", table_cell), Paragraph("Capped Profit & Capped Defined Risk", table_cell)],
        [Paragraph("<b>Iron Butterfly</b>", table_cell_bold), Paragraph("Short ATM Call + Short ATM Put<br/>Long OTM Call + Long OTM Put", table_cell), Paragraph("Pinning near current spot strike", table_cell), Paragraph("High Max Profit, Tight Breakeven zone", table_cell)],
        [Paragraph("<b>Bull Call Spread</b>", table_cell_bold), Paragraph("Long ATM/ITM Call + Short OTM Call", table_cell), Paragraph("Moderate directional upside rally", table_cell), Paragraph("Defined Net Debit, Capped Risk", table_cell)],
        [Paragraph("<b>Bear Put Spread</b>", table_cell_bold), Paragraph("Long ATM/ITM Put + Short OTM Put", table_cell), Paragraph("Moderate directional downside drop", table_cell), Paragraph("Defined Net Debit, Capped Risk", table_cell)],
        [Paragraph("<b>Short Straddle</b>", table_cell_bold), Paragraph("Short ATM Call + Short ATM Put", table_cell), Paragraph("Severe IV crush & tight range expiration", table_cell), Paragraph("High Theta harvest, Undefined Tail Risk", table_cell)],
        [Paragraph("<b>Jade Lizard</b>", table_cell_bold), Paragraph("Short OTM Put + Bear Call Spread (Credit > Spread width)", table_cell), Paragraph("Neutral to Bullish; zero upside risk", table_cell), Paragraph("Defined Upside Risk (₹0), Downside Put Risk", table_cell)]
    ]
    st_table = Table(strat_data, colWidths=[90, 160, 134, 120])
    st_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 4.5),
    ]))
    story.append(st_table)
    story.append(Spacer(1, 8))
    story.append(make_callout("Clicking the 'Sandbox' button on any screener result row immediately ports all strikes, quantities, and expiries into the Payoff Simulator for custom fine-tuning."))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 4: AUTO-SCANNER & REAL-TIME STRATEGY ALERTS
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 4: Auto-Scanner & Real-Time Strategy Alerts", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Auto-Scanner Engine continuously monitors live ticking market feeds in the background. "
        "When market conditions satisfy user-defined alert rules, audio chimes trigger, desktop notifications appear, and matching strategies are logged in real time.",
        body_style
    ))
    story.append(Paragraph("<b>Configuring Alert Criteria:</b>", h2_style))
    story.append(Paragraph("• <b>Probability of Profit (POP):</b> Specify minimum win probability (e.g. POP ≥ 70%).", bullet_style))
    story.append(Paragraph("• <b>Risk-to-Reward Ratio:</b> Enforce maximum loss vs reward thresholds (e.g. Max Loss : Max Profit ≤ 2.5:1).", bullet_style))
    story.append(Paragraph("• <b>Delta-Neutral Envelope:</b> Constrain net strategy Delta within safe boundaries (e.g. -5.0 ≤ Net Δ ≤ +5.0).", bullet_style))
    story.append(Paragraph("• <b>Gamma Cap:</b> Restrict maximum aggregate Gamma to prevent sharp directional vulnerability on large underlying jumps.", bullet_style))
    story.append(Paragraph("• <b>Minimum Yield / Return on Capital (ROC):</b> Filter setups generating at least 3% to 6% on margin collateral per expiry cycle.", bullet_style))
    story.append(Spacer(1, 8))
    
    story.append(Paragraph("<b>Triggered Alerts & Instant Execution:</b>", h2_style))
    story.append(Paragraph(
        "Each alert log entry displays exact Net Credit, Breakevens, Margin Requirement, and Greek exposures. "
        "Users can click the <b>Trade Basket</b> button to route the multi-leg order directly to their connected broker account without manual strike selection.",
        body_style
    ))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 5: STRATEGY BUILDER SANDBOX & PAYOFF ANALYSIS
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 5: Strategy Builder Sandbox & Payoff Analysis", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Strategy Builder Sandbox is the quantitative modeling hub of Option Oracle. "
        "Traders can construct arbitrary multi-leg setups, adjust implied volatility offsets, shift target valuation dates, and inspect real-time Greeks.",
        body_style
    ))
    story.append(Spacer(1, 4))
    
    story.append(Image(payoff_img, width=6.8*inch, height=3.1*inch))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Understanding the Dual Payoff Curves:</b>", h2_style))
    story.append(Paragraph("1. <b>The T+0 Curve (Solid Cyan):</b> Shows your estimated P&L *today* if the underlying spot price shifts. It factors in current time to expiry, IV, and Greeks.", bullet_style))
    story.append(Paragraph("2. <b>The Expiry Curve (Dashed Purple):</b> Represents the final theoretical payoff at contract expiration.", bullet_style))
    story.append(Paragraph("3. <b>IV Offset Slider:</b> Simulates volatility expansion (+IV) or contraction (-IV). Net sellers benefit from IV crush; net buyers profit from IV expansion.", bullet_style))
    story.append(Paragraph("4. <b>Date Decay Slider:</b> Step forward day-by-day to visualize the T+0 curve gravitating toward the Expiry curve as Theta harvests.", bullet_style))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 6: QUANTITATIVE HISTORICAL BACKTESTER
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 6: Quantitative Historical Backtester", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Historical Backtester allows traders to validate options strategies across historical market cycles using high-resolution historical index and options data.",
        body_style
    ))
    story.append(Spacer(1, 4))

    story.append(Image(backtest_img, width=6.8*inch, height=3.1*inch))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Backtest Configuration Parameters:</b>", h2_style))
    story.append(Paragraph("• <b>Entry Timing (DTE):</b> Choose exact entry DTE (e.g. enter every Thursday at 9:30 AM with 7 DTE).", bullet_style))
    story.append(Paragraph("• <b>Stop-Loss & Take-Profit Rules:</b> Exit automatically at 50% max profit, or stop out when loss reaches 100% of collected credit.", bullet_style))
    story.append(Paragraph("• <b>Key Performance Metrics:</b> Total Net Profit (₹), Win Rate (%), Profit Factor, Max Drawdown (%), Sharpe Ratio, and Expectancy per trade.", bullet_style))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 7: VOLATILITY CONE & IMPLIED VOLATILITY ANALYSIS
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 7: Volatility Cone & Implied Volatility Analysis", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Volatility Cone benchmarks current Implied Volatility (IV) against historical realized volatility percentiles (10th, 25th, Median, 75th, 90th) across multi-day horizons.",
        body_style
    ))
    story.append(Spacer(1, 4))

    story.append(Image(cone_img, width=6.8*inch, height=3.1*inch))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Interpreting Volatility Regimes:</b>", h2_style))
    story.append(Paragraph("• <b>Overpriced Volatility (Above 75th/90th Percentile):</b> Option premiums are statistically inflated. Prime regime for credit selling strategies (Iron Condors, Short Straddles, Credit Spreads).", bullet_style))
    story.append(Paragraph("• <b>Underpriced Volatility (Below 25th Percentile):</b> Option premiums are historically cheap. Favorable regime for long volatility (Long Straddles, Calendar Spreads, Debit Spreads).", bullet_style))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 8: MULTI-TIMEFRAME RSI MOMENTUM SCANNER
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 8: Multi-Timeframe RSI Momentum Scanner", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The RSI Scanner identifies momentum divergences and overbought/oversold extremes across 15-minute, 1-hour, and Daily timeframes for all index underlyings and liquid F&O stocks.",
        body_style
    ))
    story.append(Paragraph("<b>Trading Applications:</b>", h2_style))
    story.append(Paragraph("• <b>RSI Overbought (> 70) + High IV:</b> High probability candidate for Bear Call Spreads or Out-Of-The-Money Call Selling.", bullet_style))
    story.append(Paragraph("• <b>RSI Oversold (< 30) + High IV:</b> High probability candidate for Bull Put Spreads or Cash-Secured Put Selling.", bullet_style))
    story.append(Paragraph("• <b>RSI Range-Bound (40 to 60):</b> Ideal candidates for Delta-neutral Iron Condors and Butterfly spreads.", bullet_style))

    story.append(Spacer(1, 14))

    # -------------------------------------------------------------
    # CHAPTER 9: PORTFOLIO MANAGER & PAPER TRADING BOOK
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 9: Portfolio Manager & Paper Trading Book", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Portfolio Manager tracks open paper trades and live broker positions with real-time Mark-to-Market (MTM) calculations, "
        "net portfolio Greeks, and position risk telemetry.",
        body_style
    ))
    story.append(Paragraph("• <b>Aggregated Greek Exposure:</b> Displays total Portfolio Delta, Gamma, Theta (daily portfolio decay), and Vega.", bullet_style))
    story.append(Paragraph("• <b>Paper Trading Execution:</b> Test complex strategies in real-time forward paper trading before deploying live capital.", bullet_style))
    story.append(Paragraph("• <b>One-Click Position Exit:</b> Exit all legs simultaneously to prevent leg-out execution risk during rapid market swings.", bullet_style))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 10: AUTOMATED HEDGING ADVISOR
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 10: Automated Hedging Advisor", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Hedging Advisor monitors your aggregate portfolio directional skew and recommends the optimal, cost-effective hedge legs to restore Delta-neutrality.",
        body_style
    ))
    story.append(Paragraph("<b>Automated Hedging Workflows:</b>", h2_style))
    story.append(Paragraph("1. <b>Delta Neutralizer:</b> Calculates exact number of underlying futures contracts or OTM option legs required to reduce net Delta to zero.", bullet_style))
    story.append(Paragraph("2. <b>Gamma Protection:</b> Suggests long wing structures to cap overnight tail risk ahead of major macro events (e.g. RBI MPC policy, Budget, US Fed).", bullet_style))
    story.append(Paragraph("3. <b>Cost Optimization:</b> Compares option hedge cost vs futures hedge margin to provide the lowest drag on portfolio yield.", bullet_style))

    story.append(Spacer(1, 14))

    # -------------------------------------------------------------
    # CHAPTER 11: BROKER API INTEGRATION (DHAN & KOTAK NEO)
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 11: Broker API Integration (Dhan & Kotak Neo)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Option Oracle features direct REST and WebSocket integrations with leading zero-brokerage algorithmic brokers in India.",
        body_style
    ))
    
    broker_table_data = [
        [Paragraph("Broker", table_header), Paragraph("Required Credentials", table_header), Paragraph("Key Features Supported", table_header)],
        [Paragraph("<b>Dhan HQ</b>", table_cell_bold), Paragraph("• Client ID (6-digit)<br/>• Access Token (JWT)", table_cell), Paragraph("• Multi-leg Basket Orders<br/>• Live Ticking WebSocket Feed<br/>• Margin Relief Verification", table_cell)],
        [Paragraph("<b>Kotak Neo</b>", table_cell_bold), Paragraph("• Consumer Key & Secret<br/>• Mobile & MPIN<br/>• Neo Access Token", table_cell), Paragraph("• Zero brokerage F&O trading<br/>• Direct position sync<br/>• Automated lot normalization", table_cell)]
    ]
    bt = Table(broker_table_data, colWidths=[100, 180, 224])
    bt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(bt)
    story.append(Spacer(1, 8))
    story.append(make_callout("API credentials are encrypted in local secure storage and never exposed in cleartext. Always generate fresh daily session tokens before market open at 9:15 AM."))

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 12: GREEKS MASTERCLASS & MATHEMATICAL FORMULAS
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 12: Options Greeks Masterclass & Mathematical Formulas", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Option Oracle relies on the analytical Black-Scholes-Merton (1973) formulation with Merton dividend extensions for index options valuation.",
        body_style
    ))
    story.append(Spacer(1, 4))

    story.append(Image(greeks_img, width=6.8*inch, height=2.7*inch))
    story.append(Spacer(1, 8))

    greeks_formula_data = [
        [Paragraph("Greek", table_header), Paragraph("Formula", table_header), Paragraph("Description & Sensitivity", table_header)],
        [Paragraph("<b>Delta (Δ)</b>", table_cell_bold), Paragraph("Call: N(d1)<br/>Put: N(d1) - 1", table_cell), Paragraph("Directional velocity. Approximates probability of expiring in-the-money.", table_cell)],
        [Paragraph("<b>Gamma (Γ)</b>", table_cell_bold), Paragraph("N'(d1) / (S · σ · √T)", table_cell), Paragraph("Directional acceleration. Highest for ATM options near expiration (Pin Risk).", table_cell)],
        [Paragraph("<b>Theta (Θ)</b>", table_cell_bold), Paragraph("-(S·N'(d1)·σ)/(2√T) - r·K·e^(-rT)·N(d2)", table_cell), Paragraph("Calendar time decay per day. Accelerates sharply in final 10 days to expiry.", table_cell)],
        [Paragraph("<b>Vega (ν)</b>", table_cell_bold), Paragraph("S · √T · N'(d1)", table_cell), Paragraph("Sensitivity to 1% change in Implied Volatility. Highest for long DTE options.", table_cell)],
        [Paragraph("<b>POP (%)</b>", table_cell_bold), Paragraph("N( (ln(S/K_BE) + (r - σ²/2)T) / (σ√T) )", table_cell), Paragraph("Cumulative normal distribution evaluated at strategy breakeven points.", table_cell)]
    ]
    gt = Table(greeks_formula_data, colWidths=[80, 190, 234])
    gt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(gt)

    story.append(PageBreak())

    # -------------------------------------------------------------
    # CHAPTER 13: KEYBOARD SHORTCUTS, SETTINGS & FAQ
    # -------------------------------------------------------------
    story.append(Paragraph("Chapter 13: Keyboard Shortcuts, Settings & FAQ", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_brand, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("<b>Keyboard Shortcuts:</b>", h2_style))
    hotkey_data = [
        [Paragraph("Shortcut", table_header), Paragraph("Action", table_header)],
        [Paragraph("<b>Alt + 1</b>", table_cell_bold), Paragraph("Switch to Option Chain Tab", table_cell)],
        [Paragraph("<b>Alt + 2</b>", table_cell_bold), Paragraph("Switch to Strategy Screener Tab", table_cell)],
        [Paragraph("<b>Alt + 3</b>", table_cell_bold), Paragraph("Switch to Alerts & Auto-Scanner Tab", table_cell)],
        [Paragraph("<b>Alt + 4</b>", table_cell_bold), Paragraph("Switch to Strategy Builder / Payoff Sandbox", table_cell)],
        [Paragraph("<b>Alt + 5</b>", table_cell_bold), Paragraph("Switch to Historical Backtester", table_cell)],
        [Paragraph("<b>Ctrl + Shift + X</b>", table_cell_bold), Paragraph("Clear All Current Legs in Builder", table_cell)],
        [Paragraph("<b>Spacebar</b>", table_cell_bold), Paragraph("Trigger Manual Instant Scan", table_cell)]
    ]
    hk_table = Table(hotkey_data, colWidths=[140, 364])
    hk_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(hk_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Frequently Asked Questions (FAQ):</b>", h2_style))
    story.append(Paragraph("<b>Q: Why does margin requirement drop drastically when adding outer wing legs?</b>", ParagraphStyle('Q', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor("#0f172a"))))
    story.append(Paragraph("A: Exchange risk management rules (SPAN + Exposure) provide significant margin relief on defined-risk spreads because the long outer wings cap the catastrophic tail risk of naked short options.", body_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Q: How often does the Auto-Scanner evaluate rules?</b>", ParagraphStyle('Q', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor("#0f172a"))))
    story.append(Paragraph("A: The default background interval is 10 seconds. You can configure this between 3 seconds (active intraday) up to 60 seconds in the Alerts Panel.", body_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Q: Can I share simulated strategy setups with colleagues or clients?</b>", ParagraphStyle('Q', fontName='Helvetica-Bold', fontSize=8.5, textColor=colors.HexColor("#0f172a"))))
    story.append(Paragraph("A: Yes. In the Strategy Builder, click 'Share Strategy'. A unique short URL (e.g. <code>/s/x9B2a</code>) is generated containing all legs, strikes, and parameters.", body_style))

    story.append(Spacer(1, 14))
    story.append(make_callout("Need additional technical support or custom algorithmic trading integrations? Contact the Option Chief engineering desk or visit the interactive in-app Help Center."))

    print(f"Building document to {output_filepath}...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print("PDF build complete successfully!")

if __name__ == '__main__':
    frontend_public_dest = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'Option_Oracle_Complete_User_Manual.pdf'))
    backend_static_dest = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static', 'Option_Oracle_Complete_User_Manual.pdf'))
    os.makedirs(os.path.dirname(backend_static_dest), exist_ok=True)

    build_pdf_manual(frontend_public_dest)
    import shutil
    shutil.copy(frontend_public_dest, backend_static_dest)
    print(f"Copied PDF manual to:\n1. {frontend_public_dest}\n2. {backend_static_dest}")
