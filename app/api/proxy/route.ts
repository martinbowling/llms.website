import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; SitemapParser/1.0)',
    };

    console.log(`Proxying request for: ${url}`);
    const response = await fetch(url, {
      headers,
      next: { revalidate: 0 }
    });

    const text = await response.text();

    if (!response.ok) {
      return new NextResponse(text, {
        status: response.status,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Return raw text response
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}