'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Globe, Loader2, Download, Copy, CheckCircle } from 'lucide-react';
import { ConfigForm } from './ConfigForm';
import { UrlList } from './UrlList';
import { normalizeUrl, fetchWithProxy, extractUrlsFromSitemap, getCommonSitemapUrls, extractSitemapUrlsFromRobotsTxt } from '@/lib/parser';
import { generateHyperbolicSummary, generateGroqSummary, generateLLMsFullTxt } from '@/lib/ai';
import type { Config, ParserState, UrlSummary } from '@/lib/types';
import { fetchMarkdownerContent } from '@/lib/markdowner';

export function SitemapParser() {
  const [url, setUrl] = useState('');
  const [config, setConfig] = useState<Config>({
    markdownerKey: '',
    hyperbolicKey: '',
    groqKey: '',
    rateLimit: 1000,
    useHyperbolic: true,
    useGroq: false
  });

  const [state, setState] = useState<ParserState>({
    isLoading: false,
    progress: 0,
    urls: [],
    processedUrls: [],
    error: '',
    debug: []
  });

  const [copied, setCopied] = useState(false);
  const [fullContent, setFullContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'full'>('summary');
  const [copiedFull, setCopiedFull] = useState(false);

  const addDebugMessage = (message: string) => {
    console.log(message);
    setState(prev => ({
      ...prev,
      debug: [...prev.debug, `${new Date().toISOString()}: ${message}`]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      setState(prev => ({ ...prev, error: 'Please enter a URL' }));
      return;
    }

    if ((!config.useHyperbolic || !config.hyperbolicKey) && 
        (!config.useGroq || !config.groqKey)) {
      setState(prev => ({ 
        ...prev, 
        error: 'Please enable and provide an API key for at least one LLM provider' 
      }));
      return;
    }

    setState({ 
      ...state, 
      isLoading: true, 
      progress: 0, 
      urls: [], 
      processedUrls: [], 
      error: '',
      debug: []
    });

    try {
      const normalizedUrl = normalizeUrl(url);
      addDebugMessage(`Starting process for URL: ${normalizedUrl}`);

      // Try robots.txt first
      const robotsUrl = new URL('/robots.txt', normalizedUrl).toString();
      addDebugMessage(`Fetching robots.txt from: ${robotsUrl}`);
      
      let sitemapUrls: string[] = [];
      
      try {
        const robotsTxt = await fetchWithProxy(robotsUrl);
        addDebugMessage(`Retrieved robots.txt: ${robotsTxt.length} bytes`);
        sitemapUrls = extractSitemapUrlsFromRobotsTxt(robotsTxt);
        addDebugMessage(`Found ${sitemapUrls.length} sitemaps in robots.txt`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addDebugMessage(`Failed to fetch robots.txt: ${errorMessage}`);
      }
      
      setState(prev => ({ ...prev, progress: 20 }));

      // If no sitemaps found in robots.txt, try common locations
      if (sitemapUrls.length === 0) {
        addDebugMessage('No sitemaps found in robots.txt, trying common locations');
        const commonLocations = getCommonSitemapUrls(normalizedUrl);
        
        for (const sitemapUrl of commonLocations) {
          try {
            addDebugMessage(`Trying sitemap at: ${sitemapUrl}`);
            const content = await fetchWithProxy(sitemapUrl);
            
            if (content.includes('<sitemapindex') || content.includes('<urlset')) {
              sitemapUrls.push(sitemapUrl);
              addDebugMessage(`Found valid sitemap at ${sitemapUrl}`);
              break;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addDebugMessage(`Failed to fetch sitemap at ${sitemapUrl}: ${errorMessage}`);
          }
        }
      }

      if (sitemapUrls.length === 0) {
        throw new Error('No sitemaps found. Please check if the website has a sitemap or try a different URL.');
      }

      setState(prev => ({ ...prev, progress: 40 }));

      // Process each sitemap
      const allUrls: string[] = [];
      for (const sitemapUrl of sitemapUrls) {
        try {
          addDebugMessage(`Processing sitemap: ${sitemapUrl}`);
          const content = await fetchWithProxy(sitemapUrl);
          const urls = await extractUrlsFromSitemap(content);
          allUrls.push(...urls);
          addDebugMessage(`Found ${urls.length} URLs in sitemap ${sitemapUrl}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addDebugMessage(`Error processing sitemap ${sitemapUrl}: ${errorMessage}`);
        }
      }

      if (allUrls.length === 0) {
        throw new Error('No URLs found in sitemaps');
      }

      setState(prev => ({ 
        ...prev, 
        urls: allUrls,
        progress: 60 
      }));

      // Process URLs with AI
      const summaries: UrlSummary[] = [];
      let processed = 0;

      for (const pageUrl of allUrls) {
        try {
          // Get content from Markdowner first
          const content = await fetchMarkdownerContent(pageUrl, config.markdownerKey);
          
          let summary: string;
          if (config.useHyperbolic) {
            summary = await generateHyperbolicSummary(pageUrl, content, config.hyperbolicKey);
            summaries.push({ 
              url: pageUrl, 
              summary, 
              fullContent: content,
              provider: 'hyperbolic' 
            });
          } else if (config.useGroq) {
            summary = await generateGroqSummary(pageUrl, content, config.groqKey);
            summaries.push({ 
              url: pageUrl, 
              summary, 
              fullContent: content,
              provider: 'groq' 
            });
          }

          processed++;
          setState(prev => ({
            ...prev,
            processedUrls: [...prev.processedUrls, pageUrl],
            progress: 60 + Math.floor((processed / allUrls.length) * 40)
          }));

          await new Promise(resolve => setTimeout(resolve, config.rateLimit));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addDebugMessage(`Error processing ${pageUrl}: ${errorMessage}`);
        }
      }

      // After processing is complete, generate both files
      const llmsFullContent = generateLLMsFullTxt(summaries);
      setFullContent(llmsFullContent);

      setState(prev => ({
        ...prev,
        isLoading: false,
        progress: 100,
        result: JSON.stringify(summaries, null, 2)
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error: ${errorMessage}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const generateLLMsTxt = (summaries: UrlSummary[]) => {
    // Find the homepage summary (usually the first URL or one ending with /)
    const homepageSummary = summaries.find(s => 
      s.url.replace(/https?:\/\/[^/]+/, '').length <= 1
    ) || summaries[0];

    let content = `# ${new URL(homepageSummary.url).hostname}

> ${homepageSummary.summary}

## Main Pages

${summaries
  .filter(s => s !== homepageSummary)
  .map(s => `- [${new URL(s.url).pathname}](${s.url}): ${s.summary}`)
  .join('\n')}
`;

    return content;
  };

  const downloadLLMsTxt = () => {
    if (!state.result) return;
    
    const summaries: UrlSummary[] = JSON.parse(state.result);
    const content = generateLLMsTxt(summaries);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${new URL(summaries[0].url).hostname}-llms.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyLLMsTxt = useCallback(async () => {
    if (!state.result) return;
    
    const summaries: UrlSummary[] = JSON.parse(state.result);
    const content = generateLLMsTxt(summaries);
    
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [state.result]);

  const copyLLMsFullTxt = useCallback(async () => {
    if (!fullContent) return;
    
    try {
      await navigator.clipboard.writeText(fullContent);
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    } catch (err) {
      console.error('Failed to copy full content:', err);
    }
  }, [fullContent]);

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.includes('full') 
      ? `${new URL(url).hostname}-llms-full.txt`
      : `${new URL(url).hostname}-llms.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold flex items-center gap-2">
            llms.txt Generator 🤖✨
          </h1>
          <p className="text-muted-foreground">
            Generate AI-powered llms.txt files for any website 🌐 
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter website URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={state.isLoading}>
              {state.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Generate 🚀'
              )}
            </Button>
          </div>
        </form>

        <ConfigForm config={config} onConfigChange={setConfig} />

        {state.isLoading && (
          <div className="space-y-2">
            <Progress value={state.progress} />
            <p className="text-sm text-muted-foreground">
              Progress: {state.progress}%
            </p>
          </div>
        )}

        {state.error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {state.error}
          </div>
        )}

        {state.urls.length > 0 && (
          <UrlList urls={state.urls} processedUrls={state.processedUrls} />
        )}

        {state.debug.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 p-4 bg-muted rounded-lg"
          >
            <h2 className="text-lg font-semibold mb-2">Debug Log:</h2>
            <pre className="text-sm whitespace-pre-wrap">
              {state.debug.join('\n')}
            </pre>
          </motion.div>
        )}

        {state.result && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                onClick={copyLLMsTxt}
                variant="outline"
                className="flex items-center gap-2"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied!' : 'Copy llms.txt'}
              </Button>
              <Button
                onClick={copyLLMsFullTxt}
                variant="outline"
                className="flex items-center gap-2"
              >
                {copiedFull ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiedFull ? 'Copied!' : 'Copy llms-full.txt'}
              </Button>
              <Button
                onClick={() => downloadFile('llms.txt', generateLLMsTxt(JSON.parse(state.result!)))}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download llms.txt
              </Button>
              <Button
                onClick={() => downloadFile('llms-full.txt', fullContent)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download llms-full.txt
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('summary')}
                  className={activeTab === 'summary' ? 'bg-primary/10' : ''}
                >
                  llms.txt
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('full')}
                  className={activeTab === 'full' ? 'bg-primary/10' : ''}
                >
                  llms-full.txt
                </Button>
              </div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 p-4 bg-muted rounded-lg"
              >
                <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
                  {activeTab === 'summary' 
                    ? generateLLMsTxt(JSON.parse(state.result))
                    : fullContent
                  }
                </pre>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}