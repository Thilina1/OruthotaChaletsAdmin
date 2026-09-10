import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const input = path.join(root, 'docs', 'COMPLETE_USER_MANUAL.md');
const htmlOutput = path.join(root, 'docs', 'COMPLETE_USER_MANUAL_BOOK.html');
const pdfOutput = path.join(root, 'docs', 'Oruthota_Chalets_Complete_User_Manual.pdf');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const inline = (value) => escapeHtml(value)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let listType = null;
  let table = null;

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listType) output.push(`</${listType}>`);
    listType = null;
  };
  const flushTable = () => {
    if (!table) return;
    const [header, ...rows] = table;
    output.push('<table><thead><tr>');
    header.forEach(cell => output.push(`<th>${inline(cell)}</th>`));
    output.push('</tr></thead><tbody>');
    rows.forEach(row => {
      output.push('<tr>');
      row.forEach(cell => output.push(`<td>${inline(cell)}</td>`));
      output.push('</tr>');
    });
    output.push('</tbody></table>');
    table = null;
  };
  const flushBlocks = () => { flushParagraph(); flushList(); flushTable(); };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    const next = (lines[index + 1] || '').trim();

    if (/^\|.*\|$/.test(line)) {
      flushParagraph(); flushList();
      if (/^\|?[\s:|-]+\|?$/.test(next)) {
        table = [line.slice(1, -1).split('|').map(cell => cell.trim())];
        index += 1;
        continue;
      }
      if (table) {
        table.push(line.slice(1, -1).split('|').map(cell => cell.trim()));
        continue;
      }
    } else {
      flushTable();
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      const text = heading[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      output.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushBlocks(); output.push('<hr>'); continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    if (ordered || unordered) {
      flushParagraph(); flushTable();
      const wanted = ordered ? 'ol' : 'ul';
      if (listType !== wanted) {
        flushList(); output.push(`<${wanted}>`); listType = wanted;
      }
      output.push(`<li>${inline((ordered || unordered)[1])}</li>`);
      continue;
    }

    if (!line) { flushBlocks(); continue; }
    paragraph.push(line.replace(/\s{2}$/, ''));
  }
  flushBlocks();
  return output.join('\n');
}

const markdown = fs.readFileSync(input, 'utf8');
const body = markdownToHtml(markdown);
const toc = [...markdown.matchAll(/^(##|###)\s+(.+)$/gm)]
  .filter(([, , title]) => title !== 'Complete User Manual and Feature Guide')
  .map(([, marks, title]) => {
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `<li class="toc-${marks.length}"><a href="#${id}">${inline(title)}</a></li>`;
  }).join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Oruthota Chalets — Complete User Manual</title>
<style>
  @page { size: A4; margin: 19mm 17mm 20mm; }
  @page:first { margin: 0; }
  :root { --ink:#26312d; --green:#294f42; --gold:#b5893f; --mist:#edf3ef; --line:#cad7d0; }
  * { box-sizing: border-box; }
  html { font-size: 10.3pt; }
  body { margin: 0; color: var(--ink); font-family: Georgia, 'Times New Roman', serif; line-height: 1.48; }
  body::before { content:''; display:block; height:297mm; margin:0 0 18mm; background:linear-gradient(150deg,#17392f 0%,#2f6654 58%,#d2a354 58.2%,#eddbc0 100%); page-break-after:always; }
  body::after { content:'ORUTHOTA CHALETS  •  COMPLETE USER MANUAL'; position:absolute; top:87mm; left:21mm; width:165mm; color:white; font-family:Arial,sans-serif; font-size:28pt; font-weight:800; line-height:1.18; letter-spacing:.04em; white-space:pre-wrap; }
  h1:first-of-type, h2:first-of-type { display:none; }
  h1 { color:var(--green); font:700 25pt/1.15 Georgia,serif; border-bottom:3px solid var(--gold); padding-bottom:7mm; margin:0 0 9mm; }
  h2 { color:var(--green); font:700 17pt/1.2 Georgia,serif; margin:12mm 0 5mm; break-after:avoid; }
  h2:not(:nth-of-type(1)) { page-break-before:always; }
  h3 { color:#355d50; font:700 12.5pt/1.25 Arial,sans-serif; margin:7mm 0 2.5mm; break-after:avoid; }
  p { margin:0 0 3.2mm; orphans:3; widows:3; }
  ul, ol { margin:2mm 0 4mm 6mm; padding-left:5mm; }
  li { padding-left:1.5mm; margin-bottom:1.3mm; break-inside:avoid; }
  strong { color:#213f35; }
  code { font:8.8pt Menlo,monospace; background:#eef2ef; padding:.2mm 1mm; border-radius:2px; }
  hr { border:0; border-top:1px solid var(--line); margin:8mm 0; }
  table { width:100%; border-collapse:collapse; margin:4mm 0 6mm; font-family:Arial,sans-serif; font-size:8.6pt; break-inside:auto; }
  tr { break-inside:avoid; }
  th { color:white; background:var(--green); text-align:left; }
  th, td { border:1px solid var(--line); padding:2.2mm; vertical-align:top; }
  tbody tr:nth-child(even) { background:var(--mist); }
  h2 + p, h3 + p { break-before:avoid; }
  .contents { page-break-after:always; }
  .contents h1 { page-break-before:avoid; }
  .contents ol { columns:2; column-gap:12mm; list-style:none; margin:0; padding:0; }
  .contents li { margin:0 0 2.2mm; break-inside:avoid; font-family:Arial,sans-serif; }
  .contents .toc-2 { color:var(--green); font-weight:700; }
  .contents .toc-3 { padding-left:4mm; color:#52635c; font-size:8.5pt; }
  .contents a { color:inherit; text-decoration:none; }
  @media print { a { color:inherit; text-decoration:none; } }
</style>
</head>
<body><section class="contents"><h1>Contents</h1><ol>${toc}</ol></section>${body}</body>
</html>`;

fs.writeFileSync(htmlOutput, html);

const result = spawnSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${pdfOutput}`,
  `file://${htmlOutput}`,
], { encoding: 'utf8' });

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'PDF generation failed.\n');
  process.exit(result.status || 1);
}

console.log(pdfOutput);
