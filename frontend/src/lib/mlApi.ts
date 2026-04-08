import { fetchJson, postJson } from './apiClient';

/** Row from GET /api/ml/residents/current-scores or priority (camelCase from ASP.NET). */
export interface ResidentMlScoreRow {
  residentId?: number | null;
  residentCode: string;
  asOfDate?: string | null;
  reintegrationReadinessScore: number;
  readinessPercentileAmongCurrentResidents?: number | null;
  supportPriorityRank: number;
  operationalBand: string;
  topPositiveFactors: string[];
  topRiskFactors: string[];
  rawScoreNote?: string | null;
  topPositiveFactorsShort?: string[] | null;
  topRiskFactorsShort?: string[] | null;
}

/** Row from GET /api/ml/donors/current-scores or at-risk. */
export interface DonorChurnRow {
  supporterId: number;
  displayName: string;
  churnRiskScore: number;
  outreachPriorityRank: number;
  riskBand: string;
  topDrivers: string[];
  outreachNote?: string | null;
}

export type MlGoal = 'donations' | 'awareness' | 'mixed';

export interface SocialFixedInputsRequest {
  contentTopic?: string | null;
  platform?: string | null;
  postType?: string | null;
  mediaType?: string | null;
  hasCallToAction?: boolean | null;
  callToActionType?: string | null;
  featuresResidentStory?: boolean | null;
  postHour?: number | null;
}

export interface SocialRecommendRequest {
  goal: MlGoal;
  fixedInputs?: SocialFixedInputsRequest;
  topK: number;
}

export interface SocialRecommendation {
  platform: string;
  postType: string;
  mediaType: string;
  postHour: number;
  contentTopic: string;
  hasCallToAction: boolean;
  callToActionType: string;
  featuresResidentStory: boolean;
  predictedEngagementRate: number;
  predictedPAnyReferral: number;
  predictedReferralsCount?: number | null;
  rankingScore: number;
  goal: string;
  whyRecommended: string;
}

export interface SocialRecommendResponse {
  goal: string;
  topK: number;
  recommendations: SocialRecommendation[];
}

/**
 * Join key: ML artifacts use `residentCode` (e.g. LS-0006). Caseload rows use `internalCode` for the same value.
 * Always compare with trim + case-insensitive match.
 */
export function normalizeResidentMlKey(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

export function buildResidentMlMap(rows: ResidentMlScoreRow[]): Map<string, ResidentMlScoreRow> {
  const m = new Map<string, ResidentMlScoreRow>();
  for (const r of rows) {
    m.set(normalizeResidentMlKey(r.residentCode), r);
  }
  return m;
}

export function buildDonorMlMap(rows: DonorChurnRow[]): Map<number, DonorChurnRow> {
  const m = new Map<number, DonorChurnRow>();
  for (const r of rows) {
    m.set(r.supporterId, r);
  }
  return m;
}

export async function getResidentPriority(limit = 10): Promise<ResidentMlScoreRow[]> {
  const q = `?limit=${encodeURIComponent(String(limit))}`;
  return fetchJson<ResidentMlScoreRow[]>(`/api/ml/residents/priority${q}`);
}

export async function getResidentCurrentScores(): Promise<ResidentMlScoreRow[]> {
  return fetchJson<ResidentMlScoreRow[]>('/api/ml/residents/current-scores');
}

export async function getResidentReadiness(residentCode: string): Promise<ResidentMlScoreRow> {
  const enc = encodeURIComponent(residentCode.trim());
  return fetchJson<ResidentMlScoreRow>(`/api/ml/residents/${enc}/readiness`);
}

export async function getAtRiskDonors(limit = 10): Promise<DonorChurnRow[]> {
  const q = `?limit=${encodeURIComponent(String(limit))}`;
  return fetchJson<DonorChurnRow[]>(`/api/ml/donors/at-risk${q}`);
}

export async function getCurrentDonorScores(): Promise<DonorChurnRow[]> {
  return fetchJson<DonorChurnRow[]>('/api/ml/donors/current-scores');
}

export async function getDonorChurn(supporterId: number): Promise<DonorChurnRow> {
  return fetchJson<DonorChurnRow>(`/api/ml/donors/${supporterId}/churn`);
}

/**
 * Maps API ProblemDetails.detail text to friendlier copy when the failure is upstream (not missing config).
 */
export function formatLiveSocialMlUserMessage(message: string): string {
  const m = message.trim();
  if (!m) return 'Request failed.';
  const lower = m.toLowerCase();
  if (
    lower.includes('mlinferenceservice') ||
    lower.includes('not configured') ||
    lower.includes('baseurl is invalid') ||
    lower.includes('http client is not initialized')
  ) {
    return m;
  }
  if (
    lower.includes('unavailable') ||
    lower.includes('could not be reached') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('try again later') ||
    lower.includes('invalid response') ||
    lower.includes('did not respond') ||
    lower.includes('could not complete')
  ) {
    return 'Live recommendation service is temporarily unavailable. If you are on the dev team, ensure the recommendation service is running (e.g. uvicorn ml_service.main:app --port 8001 from the repo root) and try again.';
  }
  return m;
}

export async function recommendSocialPost(body: SocialRecommendRequest): Promise<SocialRecommendResponse> {
  try {
    return await postJson<SocialRecommendResponse>('/api/ml/social/recommend', body);
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(formatLiveSocialMlUserMessage(e.message));
    }
    throw e;
  }
}

/** Optional: GET /api/ml/social/options — returns null if the route is not implemented (404). */
export async function getSocialOptions(): Promise<unknown | null> {
  try {
    return await fetchJson<unknown>('/api/ml/social/options');
  } catch {
    return null;
  }
}
