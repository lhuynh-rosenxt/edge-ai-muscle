import { Injectable, computed, inject, signal } from '@angular/core';
import { AnalysisRecord, QualityRejectedError, QualityReport, Review } from '../models';
import { EdgeApiService } from './edge-api.service';
import { ImageQualityService } from './image-quality.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class AnalysisStore {
  private readonly api = inject(EdgeApiService);
  private readonly qc = inject(ImageQualityService);
  private readonly toast = inject(ToastService);

  readonly records = signal<AnalysisRecord[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.records().find((r) => r.id === this.selectedId()) ?? null);

  readonly stats = computed(() => {
    const rs = this.records();
    const done = rs.filter((r) => r.stage === 'done');
    return {
      total: rs.length,
      done: done.length,
      qualityFailed: rs.filter((r) => r.stage === 'quality_failed').length,
      pending: done.filter((r) => r.review.status === 'pending').length,
      approved: done.filter((r) => r.review.status === 'accepted' || r.review.status === 'edited').length,
      rejected: done.filter((r) => r.review.status === 'rejected').length,
      busy: rs.some((r) => r.stage === 'queued' || r.stage === 'processing' || r.stage === 'checking'),
    };
  });

  // Jetson Nano handles one inference at a time.
  private queue: Promise<void> = Promise.resolve();
  private readonly files = new Map<string, File>();

  addFiles(files: File[]): void {
    for (const file of files) {
      const rec: AnalysisRecord = {
        id: crypto.randomUUID().slice(0, 8),
        fileName: file.name,
        fileSize: file.size,
        imageUrl: '',
        uploadedAt: new Date(),
        stage: 'checking',
        review: { status: 'pending' },
      };
      this.files.set(rec.id, file);
      this.records.update((rs) => [rec, ...rs]);
      if (!this.selectedId()) this.selectedId.set(rec.id);
      const preview = this.qc.toDisplayUrl(file).then((imageUrl) => {
        this.patch(rec.id, { imageUrl });
        return imageUrl;
      });
      this.queue = this.queue.then(async () => this.process(rec.id, file, await preview));
    }
  }

  /** Human override: send an image that failed the local pre-check to the device anyway. */
  forceAnalyze(id: string): void {
    const file = this.files.get(id);
    const rec = this.records().find((r) => r.id === id);
    if (!file || !rec?.quality) return;
    const quality = rec.quality;
    this.patch(id, { stage: 'queued', error: undefined });
    this.queue = this.queue.then(() => this.infer(id, file, quality));
  }

  private async process(id: string, file: File, imageUrl: string): Promise<void> {
    if (!this.records().some((r) => r.id === id)) return;

    const quality = await this.qc.check(file, imageUrl);
    if (!quality.ok) {
      this.patch(id, { stage: 'quality_failed', quality });
      this.toast.show('warning', `Ảnh "${file.name}" không đạt yêu cầu`, quality.issues);
      return;
    }
    await this.infer(id, file, quality);
  }

  private async infer(id: string, file: File, quality: QualityReport): Promise<void> {
    if (!this.records().some((r) => r.id === id)) return;
    this.patch(id, { stage: 'processing', quality });
    try {
      const result = await this.api.analyze(file, quality);
      this.patch(id, { stage: 'done', result });
      if (result.confidence !== undefined && result.confidence < 0.75) {
        this.toast.show('info', `"${file.name}": độ tin cậy thấp (${(result.confidence * 100).toFixed(0)}%)`, [
          'Cần chuyên gia kiểm tra kỹ trước khi chấp nhận kết quả.',
        ]);
      } else {
        this.toast.show('success', `Đã xử lý "${file.name}" trong ${result.inferenceMs} ms`);
      }
    } catch (e) {
      if (e instanceof QualityRejectedError) {
        this.patch(id, { stage: 'quality_failed', quality: { ...quality, ok: false, issues: e.issues } });
        this.toast.show('warning', `Thiết bị biên từ chối ảnh "${file.name}"`, e.issues);
      } else {
        const msg = e instanceof Error ? e.message : 'Lỗi không xác định';
        this.patch(id, { stage: 'error', error: msg });
        this.toast.show('error', `Không kết nối được thiết bị biên khi xử lý "${file.name}"`, [msg]);
      }
    }
  }

  setReview(id: string, review: Review): void {
    this.patch(id, { review });
  }

  remove(id: string): void {
    const rec = this.records().find((r) => r.id === id);
    if (rec?.imageUrl) URL.revokeObjectURL(rec.imageUrl);
    this.files.delete(id);
    this.records.update((rs) => rs.filter((r) => r.id !== id));
    if (this.selectedId() === id) this.selectedId.set(this.records()[0]?.id ?? null);
  }

  private patch(id: string, p: Partial<AnalysisRecord>): void {
    this.records.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
}
