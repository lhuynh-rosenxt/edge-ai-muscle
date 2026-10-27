import { AnalysisRecord } from '../models';

const HEADERS = [
  'id', 'file_name', 'uploaded_at', 'request_id', 'device', 'px_per_cm', 'infer_ms', 'latency_ms', 'quality_score', 'confidence',
  'ai_mt_mm', 'ai_pa_deg', 'ai_fl_mm',
  'final_mt_mm', 'final_pa_deg', 'final_fl_mm',
  'review_status', 'reviewer', 'reviewed_at', 'note',
];

export function recordsToCsv(records: AnalysisRecord[]): string {
  const rows = records.map((r) => {
    const ai = r.result?.metrics;
    const fin = r.review.final;
    return [
      r.id,
      r.fileName,
      r.uploadedAt.toISOString(),
      r.result?.requestId,
      r.result?.device,
      r.result?.pxPerCm,
      r.result?.inferenceMs,
      r.result?.latencyMs,
      r.quality?.score,
      r.result?.confidence,
      ai?.mt, ai?.pa, ai?.fl,
      fin?.mt, fin?.pa, fin?.fl,
      r.review.status,
      r.review.reviewer,
      r.review.reviewedAt?.toISOString(),
      r.review.note,
    ].map(cell);
  });
  return [HEADERS.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function downloadCsv(fileName: string, csv: string): void {
  // BOM so Excel opens UTF-8 Vietnamese text correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function cell(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return String(v);
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
