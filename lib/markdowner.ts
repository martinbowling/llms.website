export async function fetchMarkdownerContent(url: string, markdownerKey?: string): Promise<string> {
  try {
    const response = await fetch('/api/markdowner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        apiKey: markdownerKey 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Markdowner API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Markdowner API error: ${response.status} ${errorText}`);
    }

    const text = await response.text();
    if (!text || text.length < 10) {
      throw new Error('Empty or invalid response from Markdowner');
    }
    return text;
  } catch (error: any) {
    console.error('Markdowner fetch error:', error);
    throw new Error(`Markdowner fetch failed: ${error.message}`);
  }
} 