export type Opportunity = {
  id: string;
  title: string;
  type: string;
  stage: string;
  city: string;
  industry: string;
  budget: string;
  buyer: string;
  deadline: string;
  match: number;
  summary: string;
  reasons: string[];
  nextAction: string;
  favorite: boolean;
  watching: boolean;
};

export type ChatResponse = {
  reply: string;
  opportunities: Opportunity[];
};
