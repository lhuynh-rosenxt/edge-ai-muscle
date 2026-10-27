import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import {
  DeviceStatus, EdgeSettings, InferenceResult, Overlay, Point, QualityRejectedError, QualityReport,
} from '../models';

const SETTINGS_KEY = 'edge-ai.settings';

/** Expected JSON from the Jetson Nano inference server (POST /api/analyze). */
interface AnalyzeResponse {
  quality?: { ok: boolean; issues?: string[] };
  mt_mm: number;
  pa_deg: number;
  fl_mm: number;
  confidence: number;
  inference_ms: number;
  device?: string;
  overlay?: Overlay;
}

interface HealthResponse {
  status: string;
  device?: string;
  model?: string;
  gpu_temp?: number;
  gpu_load?: number;
}

@Injectable({ providedIn: 'root' })
export class EdgeApiService {
  private readonly http = inject(HttpClient);

  readonly settings = signal<EdgeSettings>(loadSettings());

  updateSettings(s: EdgeSettings): void {
    this.settings.set(s);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  async health(): Promise<DeviceStatus> {
    const { baseUrl, mock } = this.settings();
    if (mock) {
      return {
        online: true,
        device: 'Jetson Nano 4GB (giả lập)',
        model: 'MuscleNet-UNet TensorRT FP16',
        gpuTemp: 42 + Math.round(Math.random() * 8),
        gpuLoad: Math.round(Math.random() * 30),
        mode: 'mock',
      };
    }
    try {
      const r = await firstValueFrom(
        this.http.get<HealthResponse>(`${baseUrl}/api/health`).pipe(timeout(4000)),
      );
      return {
        online: r.status === 'ok',
        device: r.device ?? 'Jetson Nano',
        model: r.model ?? '—',
        gpuTemp: r.gpu_temp,
        gpuLoad: r.gpu_load,
        mode: 'live',
      };
    } catch {
      return { online: false, device: 'Jetson Nano', model: '—', mode: 'live' };
    }
  }

  async analyze(file: File, quality: QualityReport): Promise<InferenceResult> {
    const { baseUrl, mock } = this.settings();
    if (mock) return mockAnalyze(quality);

    const form = new FormData();
    form.append('file', file, file.name);
    const r = await firstValueFrom(
      this.http.post<AnalyzeResponse>(`${baseUrl}/api/analyze`, form).pipe(timeout(30000)),
    );
    if (r.quality && !r.quality.ok) throw new QualityRejectedError(r.quality.issues ?? []);
    return {
      metrics: { mt: r.mt_mm, pa: r.pa_deg, fl: r.fl_mm },
      confidence: r.confidence,
      inferenceMs: r.inference_ms,
      device: r.device ?? 'Jetson Nano',
      overlay: r.overlay,
    };
  }
}

function loadSettings(): EdgeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as EdgeSettings;
  } catch { /* ignore corrupted storage */ }
  return { baseUrl: 'http://192.168.55.1:8000', mock: true };
}

/** Simulates the edge model so the UI can be demoed without hardware. */
async function mockAnalyze(q: QualityReport): Promise<InferenceResult> {
  const inferenceMs = 45 + Math.random() * 40;
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));

  const mt = round(14 + Math.random() * 10, 2);
  const pa = round(11 + Math.random() * 12, 2);
  const fl = round(mt / Math.sin((pa * Math.PI) / 180), 2);

  // Assume 50 mm imaging depth across the image height.
  const pxPerMm = q.height / 50;
  const supY = q.height * 0.2;
  const tilt = q.height * 0.02;
  const deepY = supY + mt * pxPerMm;
  const superficial: [Point, Point] = [[q.width * 0.05, supY], [q.width * 0.95, supY + tilt]];
  const deep: [Point, Point] = [[q.width * 0.05, deepY + tilt], [q.width * 0.95, deepY]];
  const dx = (deepY - supY) / Math.tan((pa * Math.PI) / 180);
  const x0 = q.width * 0.3;
  const fascicle: [Point, Point] = [[x0, deepY + tilt * 0.7], [Math.min(q.width * 0.98, x0 + dx), supY + tilt * 0.3]];

  return {
    metrics: { mt, pa, fl },
    confidence: round(0.6 + Math.random() * 0.38, 3),
    inferenceMs: round(inferenceMs, 1),
    device: 'Jetson Nano 4GB (giả lập)',
    overlay: { superficial, deep, fascicle },
  };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
