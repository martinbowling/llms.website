import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { url, apiKey } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Accept': 'text/plain',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; SitemapParser/1.0)',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    console.log(`Proxying Markdowner request for: ${url}`);
    const response = await fetch(`https://md.dhr.wtf/?url=${encodeURIComponent(url)}`, {
      headers,
      next: { revalidate: 0 }
    });

    const text = await response.text();

    if (!response.ok) {
      console.error('Markdowner API error:', {
        status: response.status,
        statusText: response.statusText,
        text
      });
      return NextResponse.json({ error: text }, { status: response.status });
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked'
      },
    });
  } catch (error: any) {
    console.error('Markdowner proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 