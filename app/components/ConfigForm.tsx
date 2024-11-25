'use client';

import { Globe, Key } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Config } from '@/lib/types';

interface ConfigFormProps {
  config: Config;
  onConfigChange: (config: Config) => void;
}

export function ConfigForm({ config, onConfigChange }: ConfigFormProps) {
  const handleChange = (key: keyof Config, value: string | boolean) => {
    if (key === 'useHyperbolic' && value === true) {
      // If enabling Hyperbolic, disable Groq
      onConfigChange({ ...config, useGroq: false, useHyperbolic: true });
    } else if (key === 'useGroq' && value === true) {
      // If enabling Groq, disable Hyperbolic
      onConfigChange({ ...config, useHyperbolic: false, useGroq: true });
    } else {
      onConfigChange({ ...config, [key]: value });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <a 
            href="https://md.dhr.wtf/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Markdowner
          </a>
        </div>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            name="markdownerKey"
            placeholder="Markdowner API Key (optional - 5 URLs/min free, 100 URLs/min with key)"
            value={config.markdownerKey}
            onChange={e => handleChange('markdownerKey', e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="useHyperbolic"
            checked={config.useHyperbolic}
            onCheckedChange={checked => handleChange('useHyperbolic', !!checked)}
          />
          <Label htmlFor="useHyperbolic">Use <a 
            href="https://hyperbolic.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Hyperbolic
          </a></Label>
        </div>
        {config.useHyperbolic && (
          <div className="relative">
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              name="hyperbolicKey"
              placeholder="Hyperbolic API Key"
              value={config.hyperbolicKey}
              onChange={e => handleChange('hyperbolicKey', e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="useGroq"
            checked={config.useGroq}
            onCheckedChange={checked => handleChange('useGroq', !!checked)}
          />
          <Label htmlFor="useGroq">Use <a 
            href="https://groq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Groq
          </a></Label>
        </div>
        {config.useGroq && (
          <div className="relative">
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              name="groqKey"
              placeholder="Groq API Key"
              value={config.groqKey}
              onChange={e => handleChange('groqKey', e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>
    </div>
  );
}