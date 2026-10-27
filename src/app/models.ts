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

export interface DeviceResources {
  gpuLoadPct?: number;
  gpuFreqMhz?: number;
  cpuSystemPct?: number;
  ramUsedMb?: number;
  cpuTemp?: number;
  gpuTemp?: number;
}

export interface InferenceResult {
  metrics: MuscleMetrics;
  /** Not provided by the Jetson API; only set in demo mode. */
  confidence?: number;
  inferenceMs: number;
  latencyMs?: number;
  decodeMs?: number;
  pxPerCm?: number;
  requestId?: string;
  device: string;
  resources?: DeviceResources;
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
  cpuTemp?: number;
  ramUsedMb?: number;
  mode: 'mock' | 'live';
  error?: string;
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
