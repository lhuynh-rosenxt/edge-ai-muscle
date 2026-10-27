import { Injectable, computed, inject, signal } from '@angular/core';
import { AnalysisRecord, QualityRejectedError, Review } from '../models';
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

  addFiles(files: File[]): void {
    for (const file of files) {
      const rec: AnalysisRecord = {
        id: crypto.randomUUID().slice(0, 8),
        fileName: file.name,
        fileSize: file.size,
        imageUrl: URL.createObjectURL(file),
        uploadedAt: new Date(),
        stage: 'checking',
        review: { status: 'pending' },
      };
      this.records.update((rs) => [rec, ...rs]);
      if (!this.selectedId()) this.selectedId.set(rec.id);
      this.queue = this.queue.then(() => this.process(rec.id, file));
    }
  }

  private async process(id: string, file: File): Promise<void> {
    const rec = this.records().find((r) => r.id === id);
    if (!rec) return;

    const quality = await this.qc.check(file, rec.imageUrl);
    if (!quality.ok) {
      this.patch(id, { stage: 'quality_failed', quality });
      this.toast.show('warning', `Ảnh "${file.name}" không đạt yêu cầu`, quality.issues);
      return;
    }

    this.patch(id, { stage: 'processing', quality });
    try {
      const result = await this.api.analyze(file, quality);
      this.patch(id, { stage: 'done', result });
      if (result.confidence < 0.75) {
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
    if (rec) URL.revokeObjectURL(rec.imageUrl);
    this.records.update((rs) => rs.filter((r) => r.id !== id));
    if (this.selectedId() === id) this.selectedId.set(this.records()[0]?.id ?? null);
  }

  private patch(id: string, p: Partial<AnalysisRecord>): void {
    this.records.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
}
