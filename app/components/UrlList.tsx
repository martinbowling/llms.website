'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock } from 'lucide-react';

interface UrlListProps {
  urls: string[];
  processedUrls: string[];
}

export function UrlList({ urls, processedUrls }: UrlListProps) {
  return (
    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
      {urls.map((url, index) => (
        <motion.div
          key={url}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex items-center space-x-2 p-2 rounded-lg bg-white/10"
        >
          {processedUrls.includes(url) ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Clock className="w-4 h-4 text-yellow-400" />
          )}
          <span className="text-sm truncate">{url}</span>
        </motion.div>
      ))}
    </div>
  );
}