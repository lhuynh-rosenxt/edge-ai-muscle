import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import {
  DeviceResources, DeviceStatus, EdgeSettings, InferenceResult, Point, QualityRejectedError, QualityReport,
} from '../models';

const SETTINGS_KEY = 'edge-ai.settings.v2';
export const DEFAULT_BASE_URL = '/jetson';

/** Response of POST /predict (see README_API.md). */
interface PredictResponse {
  request_id?: string;
  image_id?: string;
  pa_deg: number;
  fl_mm: number;
  mt_mm: number;
  px_per_cm?: number;
  decode_ms?: number;
  infer_ms?: number;
  latency_ms?: number;
  resources?: Record<string, unknown>;
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
        model: 'Demo model',
        gpuTemp: 38 + Math.round(Math.random() * 8),
        gpuLoad: Math.round(Math.random() * 30),
        mode: 'mock',
      };
    }
    try {
      const r = await firstValueFrom(
        this.http.get<Record<string, unknown>>(`${baseUrl}/health`).pipe(timeout(5000)),
      );
      const status = r['status'];
      const res = parseResources(isObject(r['resources']) ? r['resources'] : r);
      return {
        online: status === undefined || /ok|healthy|ready|up|running/i.test(String(status)),
        device: str(r['device']) ?? str(r['platform']) ?? 'Jetson Nano',
        model: str(r['model']) ?? str(r['model_name']) ?? str(r['engine']) ?? 'Muscle Architecture API',
        gpuTemp: res.gpuTemp,
        gpuLoad: res.gpuLoadPct,
        cpuTemp: res.cpuTemp,
        ramUsedMb: res.ramUsedMb,
        mode: 'live',
      };
    } catch {
      return { online: false, device: 'Jetson Nano', model: baseUrl, mode: 'live' };
    }
  }

  async analyze(file: File, quality: QualityReport): Promise<InferenceResult> {
    const { baseUrl, mock } = this.settings();
    if (mock) return mockAnalyze(quality);

    // The server derives px_per_cm from the original file name/extension, so keep it intact.
    const form = new FormData();
    form.append('file', file, file.name);

    let r: PredictResponse;
    try {
      r = await firstValueFrom(
        this.http.post<PredictResponse>(`${baseUrl}/predict`, form).pipe(timeout(30000)),
      );
    } catch (e) {
      if (e instanceof TimeoutError) throw new Error('Quá thời gian chờ phản hồi từ Jetson (30 s).');
      if (e instanceof HttpErrorResponse) {
        if (e.status === 0) {
          throw new Error(`Không kết nối được tới ${baseUrl} (mạng, CORS hoặc tường lửa chặn).`);
        }
        const detail = errorDetail(e.error);
        if ([400, 415, 422].includes(e.status)) {
          throw new QualityRejectedError([detail ?? 'Ảnh không hợp lệ hoặc không giải mã được.']);
        }
        throw new Error(`HTTP ${e.status}: ${detail ?? e.statusText}`);
      }
      throw e;
    }

    if (![r.pa_deg, r.fl_mm, r.mt_mm].every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new QualityRejectedError(['Mô hình không trích xuất được MT/PA/FL từ ảnh này.']);
    }

    const resources = r.resources ? parseResources(r.resources) : undefined;
    return {
      metrics: { mt: r.mt_mm, pa: r.pa_deg, fl: r.fl_mm },
      inferenceMs: r.infer_ms ?? r.latency_ms ?? 0,
      latencyMs: r.latency_ms,
      decodeMs: r.decode_ms,
      pxPerCm: r.px_per_cm,
      requestId: r.request_id,
      device: 'Jetson Nano',
      resources,
    };
  }
}

function loadSettings(): EdgeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as EdgeSettings;
  } catch { /* ignore corrupted storage */ }
  return { baseUrl: DEFAULT_BASE_URL, mock: false };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(...vs: unknown[]): number | undefined {
  return vs.find((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function parseResources(o: Record<string, unknown>): DeviceResources {
  const temps = isObject(o['temps_c']) ? o['temps_c'] : {};
  return {
    gpuLoadPct: num(o['gpu_load_avg_pct'], o['gpu_load_pct'], o['gpu_load']),
    gpuFreqMhz: num(o['gpu_freq_mhz']),
    cpuSystemPct: num(o['cpu_system_pct'], o['cpu_pct']),
    ramUsedMb: num(o['ram_used_peak_mb'], o['ram_used_mb']),
    cpuTemp: num(temps['CPU-therm'], o['cpu_temp']),
    gpuTemp: num(temps['GPU-therm'], o['gpu_temp']),
  };
}

/** FastAPI errors look like {detail: string} or {detail: [{msg}]}. */
function errorDetail(body: unknown): string | undefined {
  if (typeof body === 'string') return body.slice(0, 200) || undefined;
  if (!isObject(body)) return undefined;
  const d = body['detail'] ?? body['error'] ?? body['message'];
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => (isObject(x) ? String(x['msg'] ?? '') : String(x))).join('; ');
  return undefined;
}

/** Simulates the edge model so the UI can be demoed without hardware. */
async function mockAnalyze(q: QualityReport): Promise<InferenceResult> {
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

  const inferMs = round(30 + Math.random() * 20, 1);
  return {
    metrics: { mt, pa, fl },
    confidence: round(0.6 + Math.random() * 0.38, 3),
    inferenceMs: inferMs,
    latencyMs: round(inferMs + 8, 1),
    pxPerCm: round(pxPerMm * 10, 1),
    device: 'Jetson Nano 4GB (giả lập)',
    overlay: { superficial, deep, fascicle },
  };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
