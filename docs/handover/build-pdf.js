#!/usr/bin/env node
/**
 * Convert admin-guide.md to a polished PDF using marked + puppeteer.
 */

const { marked } = require('marked');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MD_FILE   = path.join(__dirname, 'admin-guide.md');
const HTML_FILE = path.join(__dirname, 'admin-guide.html');
const PDF_FILE  = path.join(__dirname, 'AlgoLend-Admin-Guide.pdf');

(async () => {
  console.log('📖 Reading markdown...');
  const md = fs.readFileSync(MD_FILE, 'utf8');

  console.log('🔄 Converting to HTML...');
  const body = marked.parse(md);

  // Resolve image paths relative to handover folder for the HTML/PDF
  const baseUrl = `file://${__dirname}/`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AlgoLend — Admin Portal User Guide</title>
  <base href="${baseUrl}">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1F2937;
      line-height: 1.65;
      font-size: 11pt;
      background: #fff;
    }
    body { padding: 32pt 40pt 24pt; max-width: 760pt; margin: 0 auto; }

    /* Title page styling */
    h1 {
      font-size: 28pt; font-weight: 800;
      color: #E7762E;
      margin: 0 0 0 0;
      letter-spacing: -0.02em;
      page-break-after: avoid;
    }
    h1 + h2 {
      font-size: 16pt; font-weight: 600;
      color: #6B7280; border: none;
      margin-top: 4pt; padding: 0;
    }
    h2 {
      font-size: 20pt; font-weight: 800;
      color: #111827;
      margin: 32pt 0 14pt;
      padding-bottom: 8pt;
      border-bottom: 2pt solid #E7762E;
      letter-spacing: -0.01em;
      page-break-after: avoid;
    }
    h3 {
      font-size: 14pt; font-weight: 700;
      color: #111827;
      margin: 22pt 0 10pt;
      letter-spacing: -0.01em;
      page-break-after: avoid;
    }
    h4 {
      font-size: 11.5pt; font-weight: 700;
      color: #374151;
      margin: 14pt 0 8pt;
    }
    p { margin: 0 0 10pt; }
    a { color: #E7762E; text-decoration: none; }

    /* Inline & block code */
    code {
      background: #F3F4F6;
      padding: 1pt 5pt;
      border-radius: 3pt;
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      font-size: 9.5pt;
      color: #DC2626;
    }
    pre {
      background: #1F2937; color: #F3F4F6;
      padding: 12pt 14pt;
      border-radius: 6pt;
      overflow-x: auto;
      font-size: 9pt;
      line-height: 1.5;
      page-break-inside: avoid;
    }
    pre code { background: transparent; color: inherit; padding: 0; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th {
      background: #FEF3EC;
      color: #9A3412;
      font-weight: 700;
      text-align: left;
      padding: 8pt 10pt;
      border-bottom: 2pt solid #E7762E;
    }
    td {
      padding: 7pt 10pt;
      border-bottom: 1pt solid #E5E7EB;
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }

    /* Lists */
    ul, ol { margin: 0 0 12pt 24pt; padding: 0; }
    li { margin-bottom: 4pt; }

    /* Images */
    img {
      max-width: 100%;
      height: auto;
      border: 1pt solid #E5E7EB;
      border-radius: 4pt;
      margin: 14pt 0;
      page-break-inside: avoid;
      box-shadow: 0 4pt 12pt rgba(0,0,0,0.06);
    }

    /* Horizontal rules → page breaks */
    hr {
      border: none;
      border-top: 1pt solid #E5E7EB;
      margin: 20pt 0;
    }

    /* Strong & emphasis */
    strong { font-weight: 700; color: #111827; }
    em { font-style: italic; color: #4B5563; }

    /* Blockquotes (used for notes) */
    blockquote {
      border-left: 3pt solid #E7762E;
      background: #FEF3EC;
      margin: 12pt 0;
      padding: 10pt 14pt;
      color: #92400E;
      font-style: italic;
      page-break-inside: avoid;
    }

    /* Page breaks before major H2 sections (except the first) */
    h2:not(:first-of-type) { page-break-before: always; }

    /* Print-only styles */
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;

  fs.writeFileSync(HTML_FILE, html);
  console.log(`💾 HTML saved: ${HTML_FILE}`);

  console.log('🖨️  Rendering PDF...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: PDF_FILE,
    format: 'A4',
    margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%; font-size:8pt; color:#9CA3AF; font-family:Inter,sans-serif; padding:0 16mm; display:flex; justify-content:space-between;">
        <span>AlgoLend — Admin Portal Guide</span>
        <span class="pageNumber"></span>
      </div>`
  });
  await browser.close();
  const stat = fs.statSync(PDF_FILE);
  console.log(`✅ PDF saved: ${PDF_FILE} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
