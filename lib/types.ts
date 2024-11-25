export interface Config {
  markdownerKey: string;
  hyperbolicKey: string;
  groqKey: string;
  rateLimit: number;
  useHyperbolic: boolean;
  useGroq: boolean;
}

export interface ParserState {
  isLoading: boolean;
  progress: number;
  urls: string[];
  processedUrls: string[];
  error?: string;
  result?: string;
  debug: string[];
}

export interface UrlSummary {
  url: string;
  summary: string;
  fullContent: string;
  provider: 'hyperbolic' | 'groq';
}