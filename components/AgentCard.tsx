
import React from 'react';
import { AgentState, AgentStatus } from '../types';
import { AgentIcon } from './Icon';
import Spinner from './Spinner';

interface AgentCardProps {
  agent: AgentState;
}

const statusStyles: { [key in AgentStatus]: { border: string; bg: string; text: string } } = {
  [AgentStatus.Idle]: { border: 'border-slate-600', bg: 'bg-slate-700/50', text: 'text-slate-400' },
  [AgentStatus.Working]: { border: 'border-amber-400', bg: 'bg-amber-900/40', text: 'text-amber-400' },
  [AgentStatus.Done]: { border: 'border-green-400', bg: 'bg-green-900/40', text: 'text-green-400' },
  [AgentStatus.Error]: { border: 'border-red-400', bg: 'bg-red-900/40', text: 'text-red-400' },
};

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const { role, status, output, sources } = agent;
  const styles = statusStyles[status];

  return (
    <div className={`border ${styles.border} ${styles.bg} rounded-lg shadow-lg overflow-hidden transition-all duration-300`}>
      <div className={`px-4 py-3 flex items-center justify-between border-b ${styles.border}`}>
        <div className="flex items-center gap-3">
          <AgentIcon role={role} className={`w-6 h-6 ${styles.text}`} />
          <h3 className="font-bold text-lg text-brand-text">{role}</h3>
        </div>
        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full ${styles.text} ${styles.bg}`}>
          {status === AgentStatus.Working && <Spinner className="w-4 h-4" />}
          <span>{status}</span>
        </div>
      </div>
      <div className="p-4 h-64 overflow-y-auto font-mono text-sm text-brand-subtle">
        {output ? (
          <pre className="whitespace-pre-wrap break-words">{output}</pre>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Waiting to start...
          </div>
        )}
      </div>
      {sources && sources.length > 0 && (
        <div className="border-t border-slate-600 p-4">
            <h4 className="font-bold text-sm text-brand-text mb-2">Sources Found:</h4>
            <ul className="space-y-2">
                {sources.map((source, index) => (
                    <li key={index} className="truncate">
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline text-xs">
                           {source.title || source.uri}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
      )}
    </div>
  );
};

export default AgentCard;
