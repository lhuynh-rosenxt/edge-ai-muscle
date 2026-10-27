export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'rejected';
export type RecordStage = 'checking' | 'quality_failed' | 'queued' | 'processing' | 'done' | 'error';

/** MT, FL in millimetres; PA in degrees. */
export interface MuscleMetrics {
  mt: number;
  pa: number;
  fl: number;
}

export interface QualityReport {
  ok: boolean;
  score: number;
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  issues: string[];
}

export type Point = [number, number];

/** Coordinates in natural image pixels. */
export interface Overlay {
  superficial: [Point, Point];
  deep: [Point, Point];
  fascicle: [Point, Point];
}

export interface InferenceResult {
  metrics: MuscleMetrics;
  confidence: number;
  inferenceMs: number;
  device: string;
  overlay?: Overlay;
}

export interface Review {
  status: ReviewStatus;
  final?: MuscleMetrics;
  reviewer?: string;
  note?: string;
  reviewedAt?: Date;
}

export interface AnalysisRecord {
  id: string;
  fileName: string;
  fileSize: number;
  imageUrl: string;
  uploadedAt: Date;
  stage: RecordStage;
  quality?: QualityReport;
  result?: InferenceResult;
  review: Review;
  error?: string;
}

export interface DeviceStatus {
  online: boolean;
  device: string;
  model: string;
  gpuTemp?: number;
  gpuLoad?: number;
  mode: 'mock' | 'live';
}

export interface EdgeSettings {
  baseUrl: string;
  mock: boolean;
}

export class QualityRejectedError extends Error {
  constructor(readonly issues: string[]) {
    super('Thiết bị biên từ chối ảnh do không đạt chất lượng');
  }
}
