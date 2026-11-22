import { describe, expect, it } from 'vitest';
import { classifyTrafficSource, DEFAULT_DOMAIN_MAP } from './trafficSource';

describe('classifyTrafficSource', () => {
  it('returns "direct" when no referrer or UTM is provided', () => {
    expect(classifyTrafficSource({})).toBe('direct');
    expect(classifyTrafficSource({ referrer: '' })).toBe('direct');
    expect(classifyTrafficSource({ referrer: null })).toBe('direct');
  });

  it('classifies search engine referrers as direct (<engine>)', () => {
    expect(classifyTrafficSource({ referrer: 'https://www.google.com/' })).toBe('direct (google)');
    expect(classifyTrafficSource({ referrer: 'https://google.co.in/search?q=resqnow' })).toBe('direct (google)');
    expect(classifyTrafficSource({ referrer: 'https://www.bing.com/search?q=resqnow' })).toBe('direct (bing)');
    expect(classifyTrafficSource({ referrer: 'https://duckduckgo.com/?q=resqnow' })).toBe('direct (duckduckgo)');
    expect(classifyTrafficSource({ referrer: 'https://search.yahoo.com/' })).toBe('direct (yahoo)');
  });

  it('classifies AI tools as referral (<tool>)', () => {
    expect(classifyTrafficSource({ referrer: 'https://chatgpt.com/' })).toBe('referral (chatgpt)');
    expect(classifyTrafficSource({ referrer: 'https://chat.openai.com/' })).toBe('referral (chatgpt)');
    expect(classifyTrafficSource({ referrer: 'https://www.perplexity.ai/' })).toBe('referral (perplexity)');
    expect(classifyTrafficSource({ referrer: 'https://gemini.google.com/' })).toBe('referral (gemini)');
    expect(classifyTrafficSource({ referrer: 'https://claude.ai/' })).toBe('referral (claude)');
    expect(classifyTrafficSource({ referrer: 'https://copilot.microsoft.com/' })).toBe('referral (copilot)');
  });

  it('classifies other external sites as referral (<domain>)', () => {
    expect(classifyTrafficSource({ referrer: 'https://www.linkedin.com/feed/' })).toBe('referral (linkedin.com)');
    expect(classifyTrafficSource({ referrer: 'https://github.com/resqnow' })).toBe('referral (github.com)');
  });

  it('returns previous internal path for SPA or internal site navigation', () => {
    expect(classifyTrafficSource({ previousInternalPath: '/home' })).toBe('/home');
    expect(classifyTrafficSource({ previousInternalPath: '/services' })).toBe('/services');
    expect(classifyTrafficSource({ referrer: 'https://resqnow.org/about' })).toBe('/about');
    expect(classifyTrafficSource({ referrer: 'http://localhost:5173/emergency' })).toBe('/emergency');
  });

  it('enriches with utm_source when present', () => {
    expect(classifyTrafficSource({ currentUrl: 'https://resqnow.org/?utm_source=newsletter' })).toBe('campaign (newsletter)');
    expect(classifyTrafficSource({ referrer: 'https://www.google.com/', currentUrl: '/?utm_source=cpc' })).toBe('direct (google) [utm: cpc]');
    expect(classifyTrafficSource({ referrer: 'https://chatgpt.com/', currentUrl: '/?utm_source=ai_promo' })).toBe('referral (chatgpt) [utm: ai_promo]');
    expect(classifyTrafficSource({ previousInternalPath: '/services', currentUrl: '/contact?utm_source=footer' })).toBe('/services [utm: footer]');
  });

  it('supports custom domain-to-label map', () => {
    const customMap = {
      ...DEFAULT_DOMAIN_MAP,
      'news.ycombinator.com': { type: 'referral' as const, label: 'hackernews' },
    };
    expect(classifyTrafficSource({ referrer: 'https://news.ycombinator.com/', domainMap: customMap })).toBe('referral (hackernews)');
  });
});
