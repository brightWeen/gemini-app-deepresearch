
export enum AgentRole {
  Planner = 'Planner',
  Researcher = 'Researcher',
  Writer = 'Writer',
  Reviewer = 'Reviewer',
}

export enum AgentStatus {
  Idle = 'Idle',
  Working = 'Working',
  Done = 'Done',
  Error = 'Error',
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface AgentState {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  output: string;
  sources?: GroundingSource[];
}

export interface ResearchPlan {
  plan: string[];
  assumptions: string;
}
