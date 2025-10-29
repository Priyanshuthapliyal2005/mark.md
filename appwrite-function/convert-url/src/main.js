/**
 * Appwrite Function: Convert URL to Markdown and Plain Text
 */
import { parse } from 'node-html-parser';

// Convert HTML to Plain Text with structure
function htmlToPlainText(html) {
  const root = parse(html, { script: false, style: false, pre: true });
  if (!root) return '';

  let plainText = '';

  function processNode(node) {
    const type = node.nodeType;
    // Text node
    if (type === 3) {
      const text = (node.rawText || '').trim();
      if (text) plainText += text + ' ';
      return;
    }

    if (type !== 1) return; // only element nodes

    const tagName = (node.tagName || '').toLowerCase();

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        plainText += '\n\n';
        node.childNodes.forEach(processNode);
        plainText += '\n\n';
        break;
      case 'p':
      case 'div':
        node.childNodes.forEach(processNode);
        plainText += '\n\n';
        break;
      case 'br':
        plainText += '\n';
        break;
      case 'li':
        plainText += '\n• ';
        node.childNodes.forEach(processNode);
        break;
      case 'ul':
      case 'ol':
        plainText += '\n';
        node.childNodes.forEach(processNode);
        plainText += '\n';
        break;
      case 'blockquote':
        plainText += '\n';
        node.childNodes.forEach(processNode);
        plainText += '\n';
        break;
      case 'hr':
        plainText += '\n---\n';
        break;
      case 'script':
      case 'style':
      case 'noscript':
        // skip
        break;
      default:
        node.childNodes?.forEach(processNode);
        break;
    }
  }

  const body = root.querySelector('body') || root;
  body.childNodes.forEach(processNode);

  return plainText
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// Convert HTML to Markdown
function htmlToMarkdown(html) {
  const root = parse(html, { script: false, style: false, pre: true });
  if (!root) return '';

  let markdown = '';

  function processNode(node) {
    const type = node.nodeType;
    if (type === 3) {
      const text = (node.rawText || '').trim();
      if (text) markdown += text + ' ';
      return;
    }

    if (type !== 1) return;

    const tagName = (node.tagName || '').toLowerCase();

    switch (tagName) {
      case 'h1':
        markdown += '\n# ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h2':
        markdown += '\n## ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h3':
        markdown += '\n### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h4':
        markdown += '\n#### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h5':
        markdown += '\n##### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h6':
        markdown += '\n###### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'p':
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'br':
        markdown += '\n';
        break;
      case 'strong':
      case 'b':
        markdown += '**';
        node.childNodes.forEach(processNode);
        markdown += '**';
        break;
      case 'em':
      case 'i':
        markdown += '*';
        node.childNodes.forEach(processNode);
        markdown += '*';
        break;
      case 'a':
        markdown += '[';
        node.childNodes.forEach(processNode);
        markdown += `](${node.getAttribute('href') || ''})`;
        break;
      case 'ul':
        markdown += '\n';
        node.childNodes.forEach((child) => {
          if ((child.tagName || '').toLowerCase() === 'li') {
            markdown += '- ';
            child.childNodes.forEach(processNode);
            markdown += '\n';
          }
        });
        markdown += '\n';
        break;
      case 'ol':
        markdown += '\n';
        let index = 1;
        node.childNodes.forEach((child) => {
          if ((child.tagName || '').toLowerCase() === 'li') {
            markdown += `${index}. `;
            child.childNodes.forEach(processNode);
            markdown += '\n';
            index++;
          }
        });
        markdown += '\n';
        break;
      case 'code':
        if (node.parentNode && (node.parentNode.tagName || '').toLowerCase() !== 'pre') {
          markdown += '`';
          node.childNodes.forEach(processNode);
          markdown += '`';
        } else {
          node.childNodes.forEach(processNode);
        }
        break;
      case 'pre':
        markdown += '\n```\n';
        node.childNodes.forEach(processNode);
        markdown += '\n```\n\n';
        break;
      case 'blockquote':
        markdown += '\n> ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'hr':
        markdown += '\n---\n\n';
        break;
      case 'img':
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        markdown += `![${alt}](${src})`;
        break;
      case 'script':
      case 'style':
      case 'noscript':
        // skip
        break;
      default:
        node.childNodes?.forEach(processNode);
        break;
    }
  }

  const body = root.querySelector('body') || root;
  body.childNodes.forEach(processNode);

  return markdown.trim().replace(/\n{3,}/g, '\n\n');
}

// Main function handler (Appwrite function signature)
export default async ({ req, res, log, error }) => {
  try {
    const payload = JSON.parse(req.body || '{}');
    const { url } = payload;

    if (!url) {
      return res.json({ error: 'URL is required' }, 400);
    }

    log(`Fetching URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IntoMdBot/1.0)',
      },
    });

    if (!response.ok) {
      const msg = `Failed to fetch URL: ${response.statusText}`;
      error(msg);
      return res.json({ error: msg }, response.status);
    }

    const html = await response.text();
    const markdown = htmlToMarkdown(html);
    const plainText = htmlToPlainText(html);

    return res.json({ success: true, html, markdown, plainText, url }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error && error(`Error converting URL: ${message}`);
    return res.json({ error: message, details: err?.stack }, 500);
  }
};
