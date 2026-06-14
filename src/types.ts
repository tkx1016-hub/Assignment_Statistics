export interface StudentScore {
  index?: number;
  name: string;
  submitted: number;
  required: number;
  remarks?: string;
}

export interface ParseResult {
  className?: string;
  subject: string;
  students: StudentScore[];
}

export interface PageItem {
  id: string;
  fileName: string;
  imageUrl: string; // Base64 representation for display and OCR
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: ParseResult;
}

export interface ConsolidatedStudent {
  name: string;
  firstIndex: number;
  scores: Record<string, {
    submitted: number;
    required: number;
    remarks: string;
  }>;
}
