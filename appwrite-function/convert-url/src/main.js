/**
 * Appwrite Function: Convert URL to Markdown and Plain Text
 */
import { parse } from 'node-html-parser';

// Elements to remove from content
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

// Text patterns to skip 
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

// Check if a node is likely navigation/UI chrome
function isNavigationElement(node) {
  if (!node || node.nodeType !== 1) return false;
  
  const tagName = (node.tagName || '').toLowerCase();
  const className = node.getAttribute('class') || '';
  const role = node.getAttribute('role') || '';
  const ariaLabel = node.getAttribute('aria-label') || '';
  
  // Check tag names
  if (['nav', 'header', 'footer', 'aside'].includes(tagName)) return true;
  
  // Check classes
  const navClasses = [
    'nav', 'navigation', 'menu', 'sidebar', 'breadcrumb',
    'toc', 'table-of-contents', 'pagination', 'pager',
    'edit-link', 'github-link', 'social', 'share'
  ];
  
  for (const navClass of navClasses) {
    if (className.toLowerCase().includes(navClass)) return true;
  }
  
  // Check roles
  if (['navigation', 'banner', 'complementary'].includes(role)) return true;
  
  // Check aria-labels
  if (ariaLabel.toLowerCase().includes('navigation') || 
      ariaLabel.toLowerCase().includes('menu')) return true;
  
  // Check if it's mostly links (navigation pattern)
  if (node.childNodes) {
    const links = node.querySelectorAll('a');
    const text = node.textContent?.trim() || '';
    const linkText = Array.from(links).map(l => l.textContent).join('');
    
    // If 70%+ of content is links, it's probably navigation
    if (text.length > 0 && linkText.length / text.length > 0.7) {
      return true;
    }
  }
  
  return false;
}

// Block-level elements 
const BLOCK_ELEMENTS = [
  'ADDRESS', 'ARTICLE', 'ASIDE', 'AUDIO', 'BLOCKQUOTE', 'BODY', 'CANVAS',
  'CENTER', 'DD', 'DIR', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'FORM', 'FRAMESET', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER',
  'HGROUP', 'HR', 'HTML', 'ISINDEX', 'LI', 'MAIN', 'MENU', 'NAV', 'NOFRAMES',
  'NOSCRIPT', 'OL', 'OUTPUT', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
  'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
];

// Void elements 
const VOID_ELEMENTS = [
  'AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT',
  'KEYGEN', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
];

// Elements meaningful when blank
const MEANINGFUL_WHEN_BLANK = [
  'A', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TH', 'TD', 'IFRAME', 'SCRIPT',
  'AUDIO', 'VIDEO'
];

// Escape patterns 
const ESCAPE_PATTERNS = [
  [/\\/g, '\\\\'],
  [/\*/g, '\\*'],
  [/^-/gm, '\\-'],
  [/^\+ /gm, '\\+ '],
  [/^(=+)/gm, '\\$1'],
  [/^(#{1,6}) /gm, '\\$1 '],
  [/`/g, '\\`'],
  [/^~~~/gm, '\\~~~'],
  [/\[/g, '\\['],
  [/\]/g, '\\]'],
  [/^>/gm, '\\>'],
  [/_/g, '\\_'],
  [/^(\d+)\. /gm, '$1\\. ']
];

// Utility functions 
function repeat(character, count) {
  return Array(count + 1).join(character);
}

function trimLeadingNewlines(string) {
  return string.replace(/^\n*/, '');
}

function trimTrailingNewlines(string) {
  let indexEnd = string.length;
  while (indexEnd > 0 && string[indexEnd - 1] === '\n') indexEnd--;
  return string.substring(0, indexEnd);
}

function trimNewlines(string) {
  return trimTrailingNewlines(trimLeadingNewlines(string));
}

function isBlock(node) {
  return node && BLOCK_ELEMENTS.includes((node.tagName || '').toUpperCase());
}

function isVoid(node) {
  return node && VOID_ELEMENTS.includes((node.tagName || '').toUpperCase());
}

function isMeaningfulWhenBlank(node) {
  return node && MEANINGFUL_WHEN_BLANK.includes((node.tagName || '').toUpperCase());
}

// Check if node is blank 
function isBlank(node) {
  return (
    !isVoid(node) &&
    !isMeaningfulWhenBlank(node) &&
    /^\s*$/i.test(node.textContent || '') &&
    !hasVoid(node) &&
    !hasMeaningfulWhenBlank(node)
  );
}

function hasVoid(node) {
  if (!node.querySelectorAll) return false;
  return VOID_ELEMENTS.some(tagName => {
    return node.querySelectorAll(tagName.toLowerCase()).length > 0;
  });
}

function hasMeaningfulWhenBlank(node) {
  if (!node.querySelectorAll) return false;
  return MEANINGFUL_WHEN_BLANK.some(tagName => {
    return node.querySelectorAll(tagName.toLowerCase()).length > 0;
  });
}

// Escape markdown 
function escape(string) {
  return ESCAPE_PATTERNS.reduce((acc, pattern) => {
    return acc.replace(pattern[0], pattern[1]);
  }, string);
}

// Join with proper newlines 
function join(output, replacement) {
  const s1 = trimTrailingNewlines(output);
  const s2 = trimLeadingNewlines(replacement);
  const nls = Math.max(output.length - s1.length, replacement.length - s2.length);
  const separator = '\n\n'.substring(0, nls);
  return s1 + separator + s2;
}

// Extract main content from HTML
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

  // If no main content found, try to find the largest content block
  const body = root.querySelector('body');
  if (body) {
    // Remove obvious non-content elements first
    const contentCandidates = body.querySelectorAll('div, section, article');
    let largestContent = body;
    let maxLength = 0;
    
    contentCandidates.forEach(candidate => {
      const text = candidate.textContent?.trim() || '';
      if (text.length > maxLength && text.length > 200) {
        // Check if it's not mostly navigation
        const links = candidate.querySelectorAll('a');
        const linkText = Array.from(links).map(l => l.textContent).join(' ');
        const ratio = linkText.length / text.length;
        
        // If less than 50% is links, it's probably content
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

// Remove unwanted elements
function cleanHTML(root) {
  REMOVE_SELECTORS.forEach(selector => {
    try {
      const elements = root.querySelectorAll(selector);
      elements.forEach(el => {
        try {
          el.remove();
        } catch (e) {
          // Element might already be removed
        }
      });
    } catch (e) {
      // Skip
    }
  });
}

// Collapse whitespace 
function collapseWhitespace(element) {
  if (!element || !element.childNodes) return;

  const nodesToRemove = [];
  
  function processTextNode(node) {
    if (node.nodeType === 3) {
      // Collapse multiple spaces/tabs/newlines to single space
      let text = (node.textContent || '').replace(/[ \r\n\t]+/g, ' ');
      
      // If text is only whitespace, mark for removal
      if (!/\S/.test(text)) {
        nodesToRemove.push(node);
      } else {
        node.textContent = text;
      }
    } else if (node.nodeType === 1 && node.childNodes) {
      Array.from(node.childNodes).forEach(processTextNode);
    }
  }

  processTextNode(element);
  
  // Remove empty text nodes
  nodesToRemove.forEach(node => {
    try {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    } catch (e) {
      // Node might already be removed
    }
  });
}

// Extract clean code text from code blocks (strips ALL HTML/styling)
function extractCleanCode(codeElement) {
  if (!codeElement) return '';
  
  // Use textContent to strip ALL HTML tags and get pure text
  let code = codeElement.textContent || '';
  
  // Remove any residual HTML entities
  code = code
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Clean up excessive whitespace but preserve code structure
  code = code
    .split('\n')
    .map(line => line.trimEnd())  // Remove trailing spaces from each line
    .join('\n');
  
  // Remove leading/trailing empty lines
  code = code.replace(/^\n+/, '').replace(/\n+$/, '');
  
  return code;
}

// Extract language from code element
function extractLanguage(codeElement) {
  if (!codeElement) return '';
  
  // Try data-language attribute first
  let language = codeElement.getAttribute('data-language') || '';
  if (language) return language.trim().split(' ')[0]; // Take first word only
  
  // Try class attribute
  const className = codeElement.getAttribute('class') || '';
  
  // Match common patterns: language-*, lang-*, hljs-*
  const patterns = [
    /language-(\S+)/,
    /lang-(\S+)/,
    /hljs-(\S+)/,
    /\b(javascript|typescript|python|java|ruby|go|rust|php|css|html|bash|sh|shell|json|yaml|yml|xml|sql|cpp|c|csharp|swift|kotlin|tsx|jsx|curl)\b/i
  ];
  
  for (const pattern of patterns) {
    const match = className.match(pattern);
    if (match) {
      let lang = match[1].toLowerCase().split(' ')[0]; // Take first word only
      
      // Normalize language names
      if (lang === 'sh' || lang === 'shell') lang = 'bash';
      if (lang === 'yml') lang = 'yaml';
      if (lang === 'ts') lang = 'typescript';
      if (lang === 'js') lang = 'javascript';
      
      return lang;
    }
  }
  
  // Check parent or sibling for language hints (some sites use divs with language classes)
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
  
  // Try to infer language from content for common patterns
  const code = (codeElement.textContent || '').trim();
  
  // Check for JSON (starts with { or [)
  if (/^\s*[\{\[]/.test(code) && /[\}\]]\s*$/.test(code)) {
    // Likely JSON - verify it's not a code block
    if (code.includes('"') && (code.includes(':') || code.includes(','))) {
      return 'json';
    }
  }
  
  // Check for curl commands
  if (/^curl\s+/m.test(code)) {
    return 'bash';
  }
  
  // Check for shell commands
  if (/^(npm|pnpm|yarn|npx|bun|git|cd|ls|mkdir|rm|cp|mv|wget|docker|python|node|pip|cargo|go)\s+/m.test(code)) {
    return 'bash';
  }
  
  return '';
}

// Convert HTML to Plain Text with structure
function htmlToPlainText(html) {
  const root = parse(html, { script: false, style: false, pre: true });
  if (!root) return '';

  cleanHTML(root);
  const mainContent = extractMainContent(root);

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

// Convert HTML element to Markdown 
function convertElementToMarkdown(node) {
  if (!node) return '';
  
  // Text nodes
  if (node.nodeType === 3) {
    let text = node.textContent || '';
    // Collapse multiple spaces
    text = text.replace(/[ \t]+/g, ' ');
    // Escape markdown special characters
    return escape(text);
  }
  
  // Comment nodes
  if (node.nodeType === 8) {
    return '';
  }
  
  // Only process element nodes
  if (node.nodeType !== 1) {
    return '';
  }
  
  const tagName = (node.tagName || '').toLowerCase();
  
  // Process children first
  function getChildrenText() {
    if (!node.childNodes) return '';
    let result = '';
    Array.from(node.childNodes).forEach(child => {
      result += convertElementToMarkdown(child);
    });
    return result;
  }
  
  // Rule-based conversion 
  switch (tagName) {
    // Headings
    case 'h1': return '\n\n# ' + getChildrenText() + '\n\n';
    case 'h2': return '\n\n## ' + getChildrenText() + '\n\n';
    case 'h3': return '\n\n### ' + getChildrenText() + '\n\n';
    case 'h4': return '\n\n#### ' + getChildrenText() + '\n\n';
    case 'h5': return '\n\n##### ' + getChildrenText() + '\n\n';
    case 'h6': return '\n\n###### ' + getChildrenText() + '\n\n';
    
    // Paragraphs
    case 'p': return '\n\n' + getChildrenText() + '\n\n';
    
    // Line breaks
    case 'br': return '  \n';
    
    // Horizontal rules
    case 'hr': return '\n\n---\n\n';
    
    // Strong/Bold
    case 'strong':
    case 'b':
      return '**' + getChildrenText() + '**';
    
    // Emphasis/Italic
    case 'em':
    case 'i':
      return '*' + getChildrenText() + '*';
    
    // Strikethrough
    case 'del':
    case 's':
    case 'strike':
      return '~~' + getChildrenText() + '~~';
    
    // Inline code
    case 'code': {
      // Check if parent is PRE (then it's a code block, handled separately)
      if (node.parentNode && node.parentNode.tagName && 
          node.parentNode.tagName.toLowerCase() === 'pre') {
        return getChildrenText();
      }
      // Inline code - use textContent to avoid HTML
      const code = node.textContent || '';
      return '`' + code + '`';
    }
    
    // Code blocks
    case 'pre': {
      const codeNode = node.querySelector('code');
      if (codeNode) {
        // Extract pure text content (NO HTML tags) 
        const code = codeNode.textContent || '';
        
        // Extract language from class attribute 
        let language = codeNode.getAttribute('data-language') || '';
        if (!language) {
          const className = codeNode.className || '';
          const match = className.match(/language-(\S+)/);
          language = match ? match[1] : '';
        }
        
        // Trim trailing newline 
        const cleanCode = code.replace(/\n$/, '');
        
        // Return fenced code block
        return '\n\n```' + language + '\n' + cleanCode + '\n```\n\n';
      } else {
        // PRE without CODE - treat as indented code block
        const code = node.textContent || '';
        return '\n\n```\n' + code.replace(/\n$/, '') + '\n```\n\n';
      }
    }
    
    // Blockquotes
    case 'blockquote': {
      const text = getChildrenText().trim();
      return '\n\n' + text.split('\n').map(line => '> ' + line).join('\n') + '\n\n';
    }
    
    // Lists
    case 'ul': {
      let result = '\n\n';
      if (node.childNodes) {
        Array.from(node.childNodes).forEach(child => {
          if (child.tagName && child.tagName.toLowerCase() === 'li') {
            const itemText = convertElementToMarkdown(child).trim();
            result += '- ' + itemText + '\n';
          }
        });
      }
      return result + '\n';
    }
    
    case 'ol': {
      let result = '\n\n';
      let index = parseInt(node.getAttribute('start') || '1');
      if (node.childNodes) {
        Array.from(node.childNodes).forEach(child => {
          if (child.tagName && child.tagName.toLowerCase() === 'li') {
            const itemText = convertElementToMarkdown(child).trim();
            result += index + '. ' + itemText + '\n';
            index++;
          }
        });
      }
      return result + '\n';
    }
    
    case 'li': return getChildrenText();
    
    // Links
    case 'a': {
      const href = node.getAttribute('href') || '';
      const text = getChildrenText();
      const title = node.getAttribute('title');
      if (title) {
        return '[' + text + '](' + href + ' "' + title + '")';
      }
      return '[' + text + '](' + href + ')';
    }
    
    // Images
    case 'img': {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      const title = node.getAttribute('title');
      if (title) {
        return '![' + alt + '](' + src + ' "' + title + '")';
      }
      return '![' + alt + '](' + src + ')';
    }
    
    // Tables
    case 'table': {
      let md = '\n\n';
      const rows = node.querySelectorAll('tr');
      let hasHeader = false;
      
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('th, td');
        const isHeader = row.querySelector('th') !== null;
        
        if (isHeader) hasHeader = true;
        
        md += '|';
        cells.forEach(cell => {
          const cellText = convertElementToMarkdown(cell).trim().replace(/\n/g, ' ');
          md += ' ' + cellText + ' |';
        });
        md += '\n';
        
        // Add separator after header
        if (isHeader && hasHeader) {
          md += '|';
          cells.forEach(() => {
            md += ' --- |';
          });
          md += '\n';
        }
      });
      
      return md + '\n';
    }
    
    // Skip these tags but process children
    case 'div':
    case 'span':
    case 'article':
    case 'section':
    case 'header':
    case 'footer':
    case 'main':
    case 'aside':
    case 'nav':
      return getChildrenText();
    
    // Default: just get children text
    default:
      return getChildrenText();
  }
}

// Convert HTML to Markdown
function htmlToMarkdown(html) {
  const root = parse(html, { script: false, style: false, pre: true });
  if (!root) return '';

  cleanHTML(root);
  const mainContent = extractMainContent(root);

  let markdown = '';
  let inCodeBlock = false;

  function processNode(node) {
    const type = node.nodeType;
    
    // Skip navigation elements entirely
    if (type === 1 && isNavigationElement(node)) {
      return;
    }
    
    // Text node
    if (type === 3) {
      let text = node.rawText || node.textContent || '';
      text = text.trim();
      
      // Skip UI clutter text patterns
      if (text && !inCodeBlock) {
        for (const pattern of SKIP_TEXT_PATTERNS) {
          if (pattern.test(text)) {
            return; // Skip this text node
          }
        }
      }
      
      if (text) {
        // Don't escape text inside code blocks, and collapse whitespace
        if (inCodeBlock) {
          markdown += text;
        } else {
          // Collapse multiple spaces and add single space at end
          text = text.replace(/\s+/g, ' ');
          // Don't escape markdown characters in normal text - let them through
          markdown += text + ' ';
        }
      }
      return;
    }

    if (type !== 1) return;

    const tagName = (node.tagName || '').toLowerCase();

    // Track code context
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
          // Use textContent directly to avoid nested processing
          markdown += `[${linkText}](${href})`;
        }
        // Don't process children - we already got textContent
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
        // Definition list - common in API docs for parameters
        markdown += '\n\n';
        node.childNodes?.forEach(processNode);
        markdown += '\n';
        break;
      case 'dt':
        // Definition term - parameter name
        markdown += '\n**';
        node.childNodes?.forEach(processNode);
        markdown += '**\n';
        break;
      case 'dd':
        // Definition description - parameter description
        node.childNodes?.forEach(processNode);
        markdown += '\n';
        break;
      case 'code':
        const parentTag = (node.parentNode?.tagName || '').toLowerCase();
        if (parentTag !== 'pre') {
          // Inline code - extract clean text without HTML
          const cleanCode = extractCleanCode(node);
          markdown += '`' + cleanCode + '`';
        } else {
          // Part of a pre block - will be handled by pre case
          // Do nothing here
        }
        break;
      case 'pre':
        // Find code child if exists
        const codeChild = node.querySelector('code');
        if (codeChild) {
          // Extract clean code without ANY HTML/styling
          const cleanCode = extractCleanCode(codeChild);
          
          // Skip empty code blocks
          if (!cleanCode.trim()) break;
          
          // Extract language
          let language = extractLanguage(codeChild);
          
          // If no language detected, try to infer from content
          if (!language) {
            // Check for JSON
            if (/^\s*[\{\[]/.test(cleanCode) && /[\}\]]\s*$/.test(cleanCode)) {
              language = 'json';
            }
            // Check for curl commands
            else if (/^curl\s+/m.test(cleanCode)) {
              language = 'bash';
            }
            // Check for shell commands
            else if (cleanCode.match(/^(npm|pnpm|yarn|npx|bun|git|cd|ls|mkdir|rm|cp|mv|curl|wget|docker|python|node)\s/m)) {
              language = 'bash';
            }
          }
          
          // Check if there's a language hint in a preceding text node or sibling
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
          // No code child, extract clean text from pre
          const cleanCode = extractCleanCode(node);
          
          // Skip empty code blocks
          if (!cleanCode.trim()) break;
          
          let language = extractLanguage(node);
          
          if (!language) {
            // Try to infer from content
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
        // Simple table handling - could be enhanced
        markdown += '\n\n';
        node.childNodes.forEach(processNode);
        markdown += '\n\n';
        break;
      case 'div':
      case 'span':
      case 'section':
      case 'article':
        // Pass through - just process children without adding markers
        node.childNodes?.forEach(processNode);
        break;
      default:
        // For unknown elements, just process children
        node.childNodes?.forEach(processNode);
        break;
    }

    // Restore code context
    inCodeBlock = wasInCodeBlock;
  }

  mainContent.childNodes.forEach(processNode);

  // Clean up excessive newlines and whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')      // Max 2 newlines
    .replace(/ +/g, ' ')              // Collapse multiple spaces
    .replace(/\n /g, '\n')            // Remove leading spaces on lines
    .replace(/^ +/gm, '')             // Remove spaces at start of lines
    .replace(/ +$/gm, '')             // Remove trailing spaces
    .trim();
  
  // Remove any remaining HTML artifacts
  markdown = markdown
    .replace(/<\/?[^>]+(>|$)/g, '')   // Remove any remaining HTML tags
    .replace(/&lt;/g, '<')             // Decode HTML entities
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...');
  
  // Clean up UI clutter patterns
  markdown = markdown
    .replace(/\[Edit on GitHub\]/gi, '')
    .replace(/\[Previous Page.*?\]/gi, '')
    .replace(/\[Next Page.*?\]/gi, '')
    .replace(/Loading\.{3,}/gi, '')
    .replace(/Search documentation\.{3}/gi, '')
    .replace(/Skip to content/gi, '');
  
  // Remove "terminal", "bash", "shell" labels that appear before code blocks
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
    .replace(/\]\([^)]+\)\([^)]+\)/g, '') // Remove double parentheses links
    .replace(/\)\(/g, ') (');             // Add space between adjacent links
  
  // Remove navigation link clusters 
  markdown = markdown
    .replace(/(\[.*?\]\(#.*?\)){3,}/g, '') // Remove 3+ adjacent anchor links
    .replace(/^\s*\[.*?\]\(#.*?\)\s*$/gm, ''); // Remove standalone anchor links
  
  // Clean up broken markdown link patterns
  markdown = markdown
    .replace(/\]\s*\[/g, '] [')        // Space between adjacent links
    .replace(/\)\s*\[/g, ') [');       // Space after link before next link
  
  // Fix parameter formatting (common in API docs)
  markdown = markdown
    .replace(/^-\s*$/gm, '')           // Remove empty list items
    .replace(/^####\s*$/gm, '');       // Remove empty h4 headers
  
  // Clean up code block spacing
  markdown = markdown
    .replace(/```\n\n+/g, '```\n')     // Remove extra newlines after code fence
    .replace(/\n\n+```/g, '\n\n```');  // Ensure double newline before code blocks
  
  // Add space between headers and content for better readability
  markdown = markdown
    .replace(/(#{1,6} [^\n]+)\n([^\n#\-\*])/g, '$1\n\n$2')  // Add blank line after headers
    .replace(/\n(#{1,6} )/g, '\n\n$1')                       // Add blank line before headers
    .replace(/\n{3,}/g, '\n\n');                             // Re-collapse excessive newlines
  
  return markdown.trim();
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
