/**
 * Appwrite Function: Convert URL to Markdown and Plain Text
 */
import { parse } from 'node-html-parser';

const REMOVE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe', 
  'nav', 'header:not(article header)', 'footer:not(article footer)', 
  '.nav', '.navbar', '.menu', '.sidebar', '.advertisement', '.ad',
  '.cookie', '.popup', '.modal', '.comments', '#comments',
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  'button', '.button', '.btn',
  '[aria-label*="Search"]', '[placeholder*="Search"]',
  '.search', '#search',
  '.breadcrumb', '.breadcrumbs',
  '[class*="pagination"]', '[class*="pager"]',
  '.edit-link', '[href*="github.com"][href*="/edit/"]',
  '.prev-next', '.previous', '.next',
  '[class*="loading"]', '[class*="spinner"]',
  '.toc', '.table-of-contents', '#toc',
  '.social', '.share', '.follow',
  '[class*="twitter"]', '[class*="facebook"]', '[class*="linkedin"]',
  '[data-cfemail]', '.__cf_email__', '[href*="/cdn-cgi/l/email-protection"]'
];

const SKIP_TEXT_PATTERNS = [
  /^loading\.{3,}$/i,
  /^search/i,
  /^edit on github$/i,
  /^previous page/i,
  /^next page/i,
  /^\[.*\]$/,  
  /^skip to/i,
  /^table of contents$/i,
  /^on this page$/i,
  /^features$/i,    
  /^ai tooling$/i,  
  /^llms\.txt$/i,   
  /^mcp$/i,         
  /^cli options$/i, 
  /^manual configuration$/i,
  /^\s*\[.*?\]\(.*?\)\s*$/,  
  /^add.*to.*$/i,   
];

function isNavigationElement(node) {
  if (!node || node.nodeType !== 1) return false;
  
  const tagName = (node.tagName || '').toLowerCase();
  const className = node.getAttribute('class') || '';
  const role = node.getAttribute('role') || '';
  const ariaLabel = node.getAttribute('aria-label') || '';
  
  if (['nav', 'header', 'footer', 'aside'].includes(tagName)) return true;
  
  const navClasses = [
    'nav', 'navigation', 'menu', 'sidebar', 'breadcrumb',
    'toc', 'table-of-contents', 'pagination', 'pager',
    'edit-link', 'github-link', 'social', 'share'
  ];
  
  for (const navClass of navClasses) {
    if (className.toLowerCase().includes(navClass)) return true;
  }
  
  if (['navigation', 'banner', 'complementary'].includes(role)) return true;
  
  if (ariaLabel.toLowerCase().includes('navigation') || 
      ariaLabel.toLowerCase().includes('menu')) return true;
  
  if (node.childNodes) {
    const links = node.querySelectorAll('a');
    const text = node.textContent?.trim() || '';
    const linkText = Array.from(links).map(l => l.textContent).join('');
    
    if (text.length > 0 && linkText.length / text.length > 0.7) {
      return true;
    }
  }
  
  return false;
}

const BLOCK_ELEMENTS = [
  'ADDRESS', 'ARTICLE', 'ASIDE', 'AUDIO', 'BLOCKQUOTE', 'BODY', 'CANVAS',
  'CENTER', 'DD', 'DIR', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'FORM', 'FRAMESET', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
  'HGROUP', 'HR', 'HTML', 'ISINDEX', 'LI', 'MAIN', 'MENU', 'NAV', 'NOFRAMES',
  'NOSCRIPT', 'OL', 'OUTPUT', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
  'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
];

function isBlock(node) {
  return node && BLOCK_ELEMENTS.includes((node.tagName || '').toUpperCase());
}

function extractMainContent(root) {
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.article-content',
    '.post-content',
    '.content-wrapper',
    '.markdown-body',
    '.prose',
    '#content',
    '.content'
  ];

  for (const selector of mainSelectors) {
    const main = root.querySelector(selector);
    if (main && main.textContent && main.textContent.trim().length > 200) {
      return main;
    }
  }

  const body = root.querySelector('body');
  if (body) {
    const contentCandidates = body.querySelectorAll('div, section, article');
    let largestContent = body;
    let maxLength = 0;
    
    contentCandidates.forEach(candidate => {
      const text = candidate.textContent?.trim() || '';
      if (text.length > maxLength && text.length > 200) {
        const links = candidate.querySelectorAll('a');
        const linkText = Array.from(links).map(l => l.textContent).join(' ');
        const ratio = linkText.length / text.length;
        
        if (ratio < 0.5) {
          maxLength = text.length;
          largestContent = candidate;
        }
      }
    });
    
    return largestContent;
  }

  return root;
}

function cleanHTML(root) {
  REMOVE_SELECTORS.forEach(selector => {
    try {
      const elements = root.querySelectorAll(selector);
      elements.forEach(el => {
        try {
          el.remove();
        } catch (e) {}
      });
    } catch (e) {}
  });
}

function extractCleanCode(codeElement) {
  if (!codeElement) return '';
  
  let code = codeElement.textContent || '';
  
  code = code
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  code = code
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
  
  code = code.replace(/^\n+/, '').replace(/\n+$/, '');
  
  return code;
}

function extractLanguage(codeElement) {
  if (!codeElement) return '';
  
  let language = codeElement.getAttribute('data-language') || '';
  if (language) return language.trim().split(' ')[0];
  
  const className = codeElement.getAttribute('class') || '';
  
  const patterns = [
    /language-(\S+)/,
    /lang-(\S+)/,
    /hljs-(\S+)/,
    /\b(javascript|typescript|python|java|ruby|go|rust|php|css|html|bash|sh|shell|json|yaml|yml|xml|sql|cpp|c|csharp|swift|kotlin|tsx|jsx|curl)\b/i
  ];
  
  for (const pattern of patterns) {
    const match = className.match(pattern);
    if (match) {
      let lang = match[1].toLowerCase().split(' ')[0];
      
      if (lang === 'sh' || lang === 'shell') lang = 'bash';
      if (lang === 'yml') lang = 'yaml';
      if (lang === 'ts') lang = 'typescript';
      if (lang === 'js') lang = 'javascript';
      
      return lang;
    }
  }
  
  const parent = codeElement.parentNode;
  if (parent) {
    const parentClass = parent.getAttribute('class') || '';
    const parentDataLang = parent.getAttribute('data-language') || '';
    
    if (parentDataLang) return parentDataLang.trim().split(' ')[0];
    
    for (const pattern of patterns) {
      const match = parentClass.match(pattern);
      if (match) {
        let lang = match[1].toLowerCase().split(' ')[0];
        if (lang === 'sh' || lang === 'shell') lang = 'bash';
        if (lang === 'yml') lang = 'yaml';
        return lang;
      }
    }
  }
  
  const code = (codeElement.textContent || '').trim();
  
  if (/^\s*[\{\[]/.test(code) && /[\}\]]\s*$/.test(code)) {
    if (code.includes('"') && (code.includes(':') || code.includes(','))) {
      return 'json';
    }
  }
  
  if (/^curl\s+/m.test(code)) {
    return 'bash';
  }
  
  if (/^(npm|pnpm|yarn|npx|bun|git|cd|ls|mkdir|rm|cp|mv|wget|docker|python|node|pip|cargo|go)\s+/m.test(code)) {
    return 'bash';
  }
  
  return '';
}

function htmlToPlainText(html) {
  const root = parse(html, { script: false, style: false, pre: true });
  if (!root) return '';

  cleanHTML(root);
  const mainContent = extractMainContent(root);

  let plainText = '';

  function processNode(node) {
    const type = node.nodeType;
    
    if (type === 3) {
      const text = (node.rawText || '').trim();
      if (text) plainText += text + ' ';
      return;
    }

    if (type !== 1) return;

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
        node.childNodes.forEach(processNode);
        plainText += '\n\n';
        break;
      case 'div':
        node.childNodes.forEach(processNode);
        if (isBlock(node.parentNode)) {
          plainText += '\n';
        }
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
      default:
        node.childNodes?.forEach(processNode);
        break;
    }
  }

  mainContent.childNodes.forEach(processNode);

  return plainText
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function htmlToMarkdown(html) {
  const root = parse(html, { script: false, style: false, pre: true });
  if (!root) return '';

  cleanHTML(root);
  const mainContent = extractMainContent(root);

  let markdown = '';
  let inCodeBlock = false;

  function processNode(node) {
    const type = node.nodeType;
    
    if (type === 1 && isNavigationElement(node)) {
      return;
    }
    
    if (type === 3) {
      let text = node.rawText || node.textContent || '';
      text = text.trim();
      
      if (text && !inCodeBlock) {
        for (const pattern of SKIP_TEXT_PATTERNS) {
          if (pattern.test(text)) {
            return;
          }
        }
      }
      
      if (text) {
        if (inCodeBlock) {
          markdown += text;
        } else {
          text = text.replace(/\s+/g, ' ');
          markdown += text + ' ';
        }
      }
      return;
    }

    if (type !== 1) return;

    const tagName = (node.tagName || '').toLowerCase();

    const wasInCodeBlock = inCodeBlock;
    if (tagName === 'code' || tagName === 'pre') {
      inCodeBlock = true;
    }

    switch (tagName) {
      case 'h1':
        markdown += '\n\n# ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h2':
        markdown += '\n\n## ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h3':
        markdown += '\n\n### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h4':
        markdown += '\n\n#### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h5':
        markdown += '\n\n##### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'h6':
        markdown += '\n\n###### ';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'p':
        markdown += '\n\n';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'br':
        markdown += '  \n';
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
      case 'del':
      case 's':
      case 'strike':
        markdown += '~~';
        node.childNodes.forEach(processNode);
        markdown += '~~';
        break;
      case 'a':
        const href = node.getAttribute('href') || '';
        const linkText = node.textContent?.trim() || '';
        if (href && linkText) {
          markdown += `[${linkText}](${href})`;
        }
        break;
      case 'ul':
        markdown += '\n\n';
        let ulItems = node.childNodes.filter(child => 
          (child.tagName || '').toLowerCase() === 'li'
        );
        ulItems.forEach((child) => {
          markdown += '- ';
          child.childNodes.forEach(processNode);
          markdown += '\n';
        });
        markdown += '\n';
        break;
      case 'ol':
        markdown += '\n\n';
        let olItems = node.childNodes.filter(child => 
          (child.tagName || '').toLowerCase() === 'li'
        );
        const startNum = parseInt(node.getAttribute('start')) || 1;
        olItems.forEach((child, index) => {
          markdown += `${startNum + index}. `;
          child.childNodes.forEach(processNode);
          markdown += '\n';
        });
        markdown += '\n';
        break;
      case 'dl':
        markdown += '\n\n';
        node.childNodes?.forEach(processNode);
        markdown += '\n';
        break;
      case 'dt':
        markdown += '\n**';
        node.childNodes?.forEach(processNode);
        markdown += '**\n';
        break;
      case 'dd':
        node.childNodes?.forEach(processNode);
        markdown += '\n';
        break;
      case 'code':
        const parentTag = (node.parentNode?.tagName || '').toLowerCase();
        if (parentTag !== 'pre') {
          const cleanCode = extractCleanCode(node);
          markdown += '`' + cleanCode + '`';
        }
        break;
      case 'pre':
        const codeChild = node.querySelector('code');
        if (codeChild) {
          const cleanCode = extractCleanCode(codeChild);
          
          if (!cleanCode.trim()) break;
          
          let language = extractLanguage(codeChild);
          
          if (!language) {
            if (/^\s*[\{\[]/.test(cleanCode) && /[\}\]]\s*$/.test(cleanCode)) {
              language = 'json';
            } else if (/^curl\s+/m.test(cleanCode)) {
              language = 'bash';
            } else if (cleanCode.match(/^(npm|pnpm|yarn|npx|bun|git|cd|ls|mkdir|rm|cp|mv|curl|wget|docker|python|node)\s/m)) {
              language = 'bash';
            }
          }
          
          if (!language && node.previousSibling) {
            const prevText = node.previousSibling.textContent?.trim().toLowerCase() || '';
            if (prevText === 'terminal' || prevText === 'bash' || prevText === 'shell' || prevText === 'sh') {
              language = 'bash';
            } else if (prevText.match(/^(javascript|typescript|json|yaml|python|java|ruby|go|rust|php|css|html|xml|sql|curl)$/)) {
              language = prevText;
            }
          }
          
          markdown += '\n\n```' + language + '\n';
          markdown += cleanCode;
          markdown += '\n```\n\n';
        } else {
          const cleanCode = extractCleanCode(node);
          
          if (!cleanCode.trim()) break;
          
          let language = extractLanguage(node);
          
          if (!language) {
            if (/^\s*[\{\[]/.test(cleanCode) && /[\}\]]\s*$/.test(cleanCode)) {
              language = 'json';
            } else if (/^curl\s+/m.test(cleanCode)) {
              language = 'bash';
            } else if (cleanCode.match(/^(npm|pnpm|yarn|npx|bun|git|cd|ls)\s/m)) {
              language = 'bash';
            }
          }
          
          markdown += '\n\n```' + language + '\n';
          markdown += cleanCode;
          markdown += '\n```\n\n';
        }
        break;
      case 'blockquote':
        markdown += '\n\n> ';
        const quoteContent = node.textContent.trim().replace(/\n/g, '\n> ');
        markdown += quoteContent + '\n\n';
        break;
      case 'hr':
        markdown += '\n\n---\n\n';
        break;
      case 'img':
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        if (src) {
          markdown += `![${alt}](${src})`;
        }
        break;
      case 'table':
        markdown += '\n\n';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'div':
      case 'span':
      case 'section':
      case 'article':
        node.childNodes?.forEach(processNode);
        break;
      default:
        node.childNodes?.forEach(processNode);
        break;
    }

    inCodeBlock = wasInCodeBlock;
  }

  mainContent.childNodes.forEach(processNode);

  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +/g, ' ')
    .replace(/\n /g, '\n')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
    .trim();
  
  markdown = markdown
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...');
  
  markdown = markdown
    .replace(/\[Edit on GitHub\]/gi, '')
    .replace(/\[Previous Page.*?\]/gi, '')
    .replace(/\[Next Page.*?\]/gi, '')
    .replace(/Loading\.{3,}/gi, '')
    .replace(/Search documentation\.{3}/gi, '')
    .replace(/Skip to content/gi, '');
  
  markdown = markdown
    .replace(/\bterminal\s*\n```/gi, '```bash\n')
    .replace(/\bshell\s*\n```/gi, '```bash\n')
    .replace(/\bbash\s*\n```bash/gi, '```bash')
    .replace(/\bterminal\s+```/gi, '```bash')
    .replace(/\n\s*terminal\s*\n/gi, '\n')
    .replace(/\n\s*shell\s*\n/gi, '\n')
    .replace(/\n\s*bash\s*\n```/gi, '\n```bash\n')
    .replace(/\n\s*json\s*\n```/gi, '\n```json\n')
    .replace(/\n\s*javascript\s*\n```/gi, '\n```javascript\n')
    .replace(/\n\s*typescript\s*\n```/gi, '\n```typescript\n')
    .replace(/\n\s*python\s*\n```/gi, '\n```python\n')
    .replace(/\n\s*curl\s*\n```/gi, '\n```bash\n');
  
  markdown = markdown
    .replace(/\]\([^)]+\)\([^)]+\)/g, '')
    .replace(/\)\(/g, ') (');
  
  markdown = markdown
    .replace(/(\[.*?\]\(#.*?\)){3,}/g, '')
    .replace(/^\s*\[.*?\]\(#.*?\)\s*$/gm, '');
  
  markdown = markdown
    .replace(/\]\s*\[/g, '] [')
    .replace(/\)\s*\[/g, ') [');
  
  markdown = markdown
    .replace(/^-\s*$/gm, '')
    .replace(/^####\s*$/gm, '');
  
  markdown = markdown
    .replace(/```\n\n+/g, '```\n')
    .replace(/\n\n+```/g, '\n\n```');
  
  markdown = markdown
    .replace(/(#{1,6} [^\n]+)\n([^\n#\-\*])/g, '$1\n\n$2')
    .replace(/\n(#{1,6} )/g, '\n\n$1')
    .replace(/\n{3,}/g, '\n\n');
  
  return markdown.trim();
}

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
