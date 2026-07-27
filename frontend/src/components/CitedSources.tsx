import React from 'react';
import { BookOpen } from 'lucide-react';

export interface CitedSource {
  id: string | number;
  title: string;
  publication: string;
  summary: string;
  url: string;
  relevance: number;
}

interface CitedSourcesProps {
  sources: CitedSource[];
}

export const CitedSources: React.FC<CitedSourcesProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="font-headline-sm text-headline-sm mb-4 text-on-surface flex items-center gap-2 font-semibold">
        <BookOpen className="w-5 h-5 text-on-surface-variant" />
        <span>Cited Sources</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sources.map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface-container rounded-2xl p-5 hover:bg-surface-container-high hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col gap-3 shadow-sm hover:shadow-md border border-white/5"
          >
            {/* Title & Relevance Tag */}
            <div className="flex justify-between items-start gap-4">
              <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                {source.title}
              </h4>
              <span className="bg-secondary-container/20 text-secondary text-[10px] px-2 py-0.5 rounded-md font-bold flex-shrink-0">
                {source.relevance}% REL
              </span>
            </div>

            {/* Publication & Summary */}
            <div className="text-xs leading-relaxed text-on-surface-variant flex-grow">
              <span className="font-semibold block mb-0.5 text-on-surface/80">{source.publication}</span>
              <p className="line-clamp-2 text-on-surface-variant/80">{source.summary}</p>
            </div>

            {/* Relevance Level Bar */}
            <div className="w-full bg-surface-variant h-1.5 rounded-full mt-1 overflow-hidden">
              <div
                className="bg-secondary h-full rounded-full transition-all duration-700"
                style={{ width: `${source.relevance}%` }}
              ></div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
export default CitedSources;
