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

export type KnowledgeCategory = {
  key: string;
  name: string;
  description: string;
  sort_order: number;
  document_count?: number;
};

export type KnowledgeDocument = {
  id: string;
  category_key: string;
  title: string;
  type: string;
  tags: string[];
  summary: string;
  source_filename: string | null;
  stored_path: string | null;
  file_size: number;
  status: string;
  created_at: string;
  updated_at: string;
  download_url: string | null;
};
