import { parseStringPromise } from 'xml2js';

export function normalizeUrl(url: string): string {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const urlObj = new URL(url);
    return urlObj.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error('Invalid URL format');
  }
}

async function fetchMarkdownerContent(url: string, apiKey?: string): Promise<string> {
  try {
    const response = await fetch('/api/markdowner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        apiKey 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Markdowner API error: ${response.status} ${errorText}`);
    }

    const text = await response.text();
    return text;
  } catch (error: any) {
    console.warn('Markdowner fetch error:', error);
    throw error;
  }
}

export async function fetchWithProxy(url: string, markdownerKey?: string) {
  try {
    // Try Markdowner first for HTML content
    if (url.endsWith('.html') || (!url.endsWith('.xml') && !url.endsWith('robots.txt'))) {
      try {
        return await fetchMarkdownerContent(url, markdownerKey);
      } catch (error) {
        console.warn('Markdowner failed, falling back to proxy:', error);
      }
    }

    // Fall back to proxy for XML files, robots.txt, or if Markdowner fails
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    // Always get the raw text first
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    // For XML content, validate it but return the original text
    if (url.endsWith('.xml')) {
      try {
        await parseStringPromise(text, { explicitArray: true });
      } catch (e) {
        throw new Error('Invalid XML response');
      }
    }

    return text;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch resource');
  }
}

export async function extractUrlsFromSitemap(sitemapContent: string, depth: number = 0): Promise<string[]> {
  if (depth > 5) {
    console.warn('Maximum sitemap depth reached');
    return [];
  }

  try {
    // First check if the content looks like XML
    if (!sitemapContent.trim().startsWith('<?xml') && !sitemapContent.trim().startsWith('<')) {
      throw new Error('Invalid XML format');
    }

    const parsed = await parseStringPromise(sitemapContent, {
      explicitArray: true,
      normalizeTags: true,
      ignoreAttrs: true,
      tagNameProcessors: [(name) => name.toLowerCase()],
      valueProcessors: [(value) => value.trim()]
    });

    const urls: string[] = [];

    // Handle sitemap index
    if (parsed.sitemapindex) {
      const sitemaps = parsed.sitemapindex.sitemap || [];
      for (const sitemap of sitemaps) {
        if (sitemap.loc && sitemap.loc[0]) {
          try {
            const subSitemapContent = await fetchWithProxy(sitemap.loc[0]);
            const subUrls = await extractUrlsFromSitemap(subSitemapContent, depth + 1);
            urls.push(...subUrls);
          } catch (error) {
            console.error(`Failed to fetch sub-sitemap ${sitemap.loc[0]}:`, error);
          }
        }
      }
      return urls;
    }

    // Handle regular sitemap
    if (parsed.urlset && parsed.urlset.url) {
      const entries = parsed.urlset.url;
      for (const entry of entries) {
        if (entry.loc && entry.loc[0]) {
          urls.push(entry.loc[0]);
        }
      }
    }

    return urls.filter(url => url && !url.includes('script'));
  } catch (error) {
    console.error('Error processing sitemap:', error);
    throw new Error(`Failed to parse sitemap XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getCommonSitemapUrls(baseUrl: string): string[] {
  const url = new URL(baseUrl);
  const domain = url.hostname;
  
  return [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap.php`,
    `${baseUrl}/sitemap/${domain}-sitemap.xml`,
    `${baseUrl}/wp-sitemap.xml`,
    `${baseUrl}/sitemap/sitemap-index.xml`,
    `${baseUrl}/blog-sitemap.xml`,
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/page-sitemap.xml`,
    `${baseUrl}/category-sitemap.xml`,
    `${baseUrl}/sitemap/master-sitemap.xml`,
    `${baseUrl}/sitemapindex.xml`,
    `${baseUrl}/sitemap.gz`,
    `${baseUrl}/sitemap.txt`
  ];
}

export function extractSitemapUrlsFromRobotsTxt(robotsTxt: string): string[] {
  try {
    // Basic validation that this looks like a robots.txt file
    if (!robotsTxt.toLowerCase().includes('user-agent')) {
      throw new Error('Invalid robots.txt format');
    }

    return robotsTxt
      .split('\n')
      .filter(line => line.toLowerCase().trim().startsWith('sitemap:'))
      .map(line => {
        const parts = line.split(/:\s+/);
        if (parts.length < 2) return null;
        const url = parts[1].trim();
        try {
          // Validate that it's a valid URL
          new URL(url);
          return url;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];
  } catch (error) {
    console.error('Error processing robots.txt:', error);
    throw new Error(`Failed to parse robots.txt: ${error instanceof Error ? error.message : String(error)}`);
  }
}