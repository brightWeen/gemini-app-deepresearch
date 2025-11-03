
import React, { useState, useCallback, useRef } from 'react';
import { AgentState, AgentStatus, AgentRole, ResearchPlan, GroundingSource } from './types';
import { runPlannerAgent, runResearcherAgent, runWriterAgent, runReviewerAgent } from './services/geminiService';
import AgentCard from './components/AgentCard';
import Spinner from './components/Spinner';

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [finalReport, setFinalReport] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const finalReportRef = useRef<HTMLDivElement>(null);

  const initializeAgents = () => {
    const initialAgents: AgentState[] = [
      { id: 'planner', role: AgentRole.Planner, status: AgentStatus.Idle, output: '' },
      { id: 'researcher-1', role: AgentRole.Researcher, status: AgentStatus.Idle, output: '' },
      { id: 'researcher-2', role: AgentRole.Researcher, status: AgentStatus.Idle, output: '' },
      { id: 'researcher-3', role: AgentRole.Researcher, status: AgentStatus.Idle, output: '' },
      { id: 'writer', role: AgentRole.Writer, status: AgentStatus.Idle, output: '' },
      { id: 'reviewer', role: AgentRole.Reviewer, status: AgentStatus.Idle, output: '' },
    ];
    setAgents(initialAgents);
    setFinalReport('');
    setError(null);
  };
  
  const updateAgentState = (id: string, newStatus: AgentStatus, newOutput?: string, newSources?: GroundingSource[]) => {
      setAgents(prev => prev.map(agent => {
          if (agent.id === id) {
              const updatedAgent = { ...agent, status: newStatus, output: newOutput !== undefined ? agent.output + newOutput : agent.output };
              if (newSources) {
                  updatedAgent.sources = newSources;
              }
              return updatedAgent;
          }
          return agent;
      }));
  };

  const setAgentOutput = (id: string, output: string, status?: AgentStatus, sources?: GroundingSource[]) => {
    setAgents(prev => prev.map(agent => {
        if (agent.id === id) {
            const updatedAgent = { ...agent, output: output };
            if (status) updatedAgent.status = status;
            if (sources) updatedAgent.sources = sources;
            return updatedAgent;
        }
        return agent;
    }));
};


  const handleStartResearch = useCallback(async () => {
    if (!topic.trim()) {
      setError("Please enter a research topic.");
      return;
    }
    if (!process.env.API_KEY) {
      setError("API_KEY is not configured. This application cannot run.");
      return;
    }

    setIsLoading(true);
    initializeAgents();

    try {
      // 1. Planner Agent
      updateAgentState('planner', AgentStatus.Working);
      const plan: ResearchPlan = await runPlannerAgent(topic, (chunk) => {
          setAgentOutput('planner', chunk);
      });
      updateAgentState('planner', AgentStatus.Done);
      
      const researchTopics = plan.plan.slice(0, 3); // Use up to 3 researchers
      setAgents(prev => {
          const newAgents = [...prev];
          for(let i = 0; i < 3; i++) {
              if(!researchTopics[i]) {
                const researcherId = `researcher-${i+1}`;
                const researcherIndex = newAgents.findIndex(a => a.id === researcherId);
                if (researcherIndex !== -1) {
                    newAgents[researcherIndex] = {...newAgents[researcherIndex], status: AgentStatus.Idle, output: 'Not needed for this plan.'}
                }
              }
          }
          return newAgents;
      });


      // 2. Researcher Agents (in parallel)
      const researchPromises = researchTopics.map(async (subTopic, index) => {
        const researcherId = `researcher-${index + 1}`;
        updateAgentState(researcherId, AgentStatus.Working);
        setAgentOutput(researcherId, `Query: ${subTopic}\n\n`);
        const result = await runResearcherAgent(subTopic, (chunk) => updateAgentState(researcherId, AgentStatus.Working, chunk));
        const sources = result.sources.map(s => ({ uri: s.web?.uri || '', title: s.web?.title || '' }));
        updateAgentState(researcherId, AgentStatus.Done, undefined, sources);
        return `Sub-topic: ${subTopic}\nSummary:\n${result.summary}`;
      });
      const researchResults = await Promise.all(researchPromises);

      // 3. Writer Agent
      updateAgentState('writer', AgentStatus.Working);
      const report = await runWriterAgent(topic, researchResults, (chunk) => updateAgentState('writer', AgentStatus.Working, chunk));
      updateAgentState('writer', AgentStatus.Done);

      // 4. Reviewer Agent
      updateAgentState('reviewer', AgentStatus.Working);
      const review = await runReviewerAgent(report, (chunk) => updateAgentState('reviewer', AgentStatus.Working, chunk));
      updateAgentState('reviewer', AgentStatus.Done);

      // 5. Final Report
      setFinalReport(report);
      setTimeout(() => finalReportRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Research failed: ${errorMessage}`);
      setAgents(prev => prev.map(a => a.status === AgentStatus.Working ? {...a, status: AgentStatus.Error, output: a.output + `\n\nERROR: ${errorMessage}`} : a));
    } finally {
      setIsLoading(false);
    }

  }, [topic]);

  return (
    <div className="min-h-screen bg-brand-primary/90 bg-[radial-gradient(#2d3748_1px,transparent_1px)] [background-size:16px_16px]">
      <div className="container mx-auto px-4 py-8 md:py-12">
        
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-brand-text mb-2">DeepResearch AI</h1>
          <p className="text-lg text-brand-subtle max-w-2xl mx-auto">
            A multi-agent system to research topics, from plan to final report.
          </p>
        </header>

        <div className="max-w-3xl mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The future of quantum computing"
              className="w-full pl-4 pr-32 py-4 bg-brand-secondary/80 border-2 border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent focus:outline-none transition-all duration-300 backdrop-blur-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleStartResearch}
              disabled={isLoading || !topic.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand-accent text-white font-bold py-2 px-6 rounded-md hover:bg-sky-400 transition-all duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? <><Spinner /> Researching...</> : 'Start'}
            </button>
          </div>
          {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
        </div>

        {agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {finalReport && (
          <div ref={finalReportRef} className="bg-brand-secondary/50 border border-slate-700 rounded-lg shadow-2xl p-6 md:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-brand-text mb-6 border-b border-slate-600 pb-4">Final Report</h2>
            <article className="prose prose-invert prose-lg max-w-none prose-h1:text-brand-text prose-h2:text-brand-subtle prose-a:text-brand-accent prose-strong:text-brand-text">
                <pre className="whitespace-pre-wrap font-sans">{finalReport}</pre>
            </article>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
