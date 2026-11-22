export interface DomainRule {
  type: 'direct' | 'referral';
  label: string;
}

export const DEFAULT_DOMAIN_MAP: Record<string, DomainRule> = {
  // Search engines -> direct (<name>) per prompt rule:
  // "the user searched 'resqnow' and clicked the link"
  'google.com': { type: 'direct', label: 'google' },
  'google.co.in': { type: 'direct', label: 'google' },
  'bing.com': { type: 'direct', label: 'bing' },
  'duckduckgo.com': { type: 'direct', label: 'duckduckgo' },
  'yahoo.com': { type: 'direct', label: 'yahoo' },
  'search.yahoo.com': { type: 'direct', label: 'yahoo' },
  'baidu.com': { type: 'direct', label: 'baidu' },
  'yandex.com': { type: 'direct', label: 'yandex' },

  // AI tools -> referral (<tool>)
  'chatgpt.com': { type: 'referral', label: 'chatgpt' },
  'chat.openai.com': { type: 'referral', label: 'chatgpt' },
  'perplexity.ai': { type: 'referral', label: 'perplexity' },
  'gemini.google.com': { type: 'referral', label: 'gemini' },
  'claude.ai': { type: 'referral', label: 'claude' },
  'copilot.microsoft.com': { type: 'referral', label: 'copilot' },
};

export const DEFAULT_INTERNAL_HOSTS = [
  'resqnow.org',
  'www.resqnow.org',
  'reqnow.org',
  'www.reqnow.org',
  'localhost',
  '127.0.0.1',
];

export interface ClassifySourceOptions {
  referrer?: string | null;
  currentUrl?: string | null;
  previousInternalPath?: string | null;
  domainMap?: Record<string, DomainRule>;
  internalHosts?: string[];
}

function extractHostname(urlString: string): string {
  try {
    const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractUtmSource(urlString?: string | null): string | null {
  if (!urlString) return null;
  try {
    const url = new URL(urlString.startsWith('http') ? urlString : `https://dummy.local${urlString.startsWith('/') ? '' : '/'}${urlString}`);
    const utmSource = url.searchParams.get('utm_source');
    return utmSource ? utmSource.trim() : null;
  } catch {
    return null;
  }
}

function matchDomainRule(hostname: string, domainMap: Record<string, DomainRule>): DomainRule | null {
  if (!hostname) return null;
  if (domainMap[hostname]) return domainMap[hostname];

  // Try wildcard / domain matching (e.g. google.co.uk or subdomains)
  for (const [key, rule] of Object.entries(domainMap)) {
    if (hostname === key || hostname.endsWith(`.${key}`)) {
      return rule;
    }
    // Handle regional google domains (google.ca, google.de, etc.)
    if (key === 'google.com' && /(^|\.)google\.[a-z.]+$/.test(hostname)) {
      return rule;
    }
  }
  return null;
}

/**
 * Classifies the traffic source into standard labels:
 * - No referrer: 'direct'
 * - Search engine: 'direct (google)', 'direct (bing)', etc.
 * - AI tool: 'referral (chatgpt)', 'referral (perplexity)', etc.
 * - Other external site: 'referral (<domain>)'
 * - Internal site navigation: previous internal path (e.g. '/home', '/services')
 * - UTM source: enriches or overrides the label
 */
export function classifyTrafficSource(options: ClassifySourceOptions = {}): string {
  const {
    referrer,
    currentUrl,
    previousInternalPath,
    domainMap = DEFAULT_DOMAIN_MAP,
    internalHosts = DEFAULT_INTERNAL_HOSTS,
  } = options;

  const utmSource = extractUtmSource(currentUrl);

  // If internal navigation occurred within SPA
  if (previousInternalPath && previousInternalPath.startsWith('/')) {
    const base = previousInternalPath;
    return utmSource ? `${base} [utm: ${utmSource}]` : base;
  }

  // If no referrer was passed
  const rawReferrer = String(referrer || '').trim();
  if (!rawReferrer) {
    return utmSource ? `campaign (${utmSource})` : 'direct';
  }

  let refUrl: URL | null = null;
  try {
    refUrl = new URL(rawReferrer);
  } catch {
    return utmSource ? `campaign (${utmSource})` : 'direct';
  }

  const refHostname = refUrl.hostname.toLowerCase();
  const normalizedRefHost = refHostname.replace(/^www\./, '');

  // Check if referrer is internal
  const isInternal = internalHosts.some(
    (host) => normalizedRefHost === host || normalizedRefHost.endsWith(`.${host}`)
  );

  if (isInternal) {
    const internalPath = `${refUrl.pathname}${refUrl.search ? refUrl.search : ''}` || '/';
    return utmSource ? `${internalPath} [utm: ${utmSource}]` : internalPath;
  }

  // Check domain map for known search engines and AI tools
  const matchedRule = matchDomainRule(normalizedRefHost, domainMap);
  let baseLabel: string;

  if (matchedRule) {
    baseLabel = `${matchedRule.type} (${matchedRule.label})`;
  } else {
    // External generic referral
    baseLabel = `referral (${normalizedRefHost})`;
  }

  if (utmSource) {
    return `${baseLabel} [utm: ${utmSource}]`;
  }

  return baseLabel;
}
