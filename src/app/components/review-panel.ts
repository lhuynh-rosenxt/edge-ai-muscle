import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalysisRecord, MuscleMetrics, ReviewStatus } from '../models';
import { AnalysisStore } from '../services/analysis.store';
import { ToastService } from '../services/toast.service';

const REVIEWER_KEY = 'edge-ai.reviewer';

@Component({
  selector: 'app-review-panel',
  imports: [FormsModule, DatePipe],
  template: `
    @let r = record();
    <h3>Human-in-the-loop · Thẩm định kết quả</h3>

    @if (r.review.status !== 'pending') {
      <div class="decided" [class.rej]="r.review.status === 'rejected'">
        <strong>{{ statusLabel[r.review.status] }}</strong> bởi {{ r.review.reviewer }}
        lúc {{ r.review.reviewedAt | date: 'HH:mm:ss dd/MM/yyyy' }}
        @if (r.review.note) { <p>Ghi chú: {{ r.review.note }}</p> }
        <button type="button" class="btn ghost sm" (click)="reopen()">Mở lại để thẩm định</button>
      </div>
    } @else {
      <p class="hint">Kiểm tra lớp phủ trên ảnh. Có thể hiệu chỉnh giá trị trước khi chấp nhận.</p>

      <div class="grid">
        <label>MT (mm)
          <input type="number" step="0.01" min="0" [(ngModel)]="mt" [class.changed]="mt() !== ai().mt" />
        </label>
        <label>PA (°)
          <input type="number" step="0.01" min="0" max="90" [(ngModel)]="pa" [class.changed]="pa() !== ai().pa" />
        </label>
        <label>FL (mm)
          <input type="number" step="0.01" min="0" [(ngModel)]="fl" [class.changed]="fl() !== ai().fl" />
        </label>
      </div>

      <label>Người thẩm định *
        <input type="text" maxlength="60" [(ngModel)]="reviewer" placeholder="VD: BS. Nguyễn Văn A" />
      </label>
      <label>Ghi chú {{ edited() ? '' : '(bắt buộc khi từ chối)' }}
        <textarea rows="2" maxlength="300" [(ngModel)]="note" placeholder="Lý do hiệu chỉnh / từ chối…"></textarea>
      </label>

      @if (error()) { <p class="err">{{ error() }}</p> }

      <div class="actions">
        @if (edited()) {
          <button type="button" class="btn primary" (click)="decide('edited')">Lưu hiệu chỉnh & chấp nhận</button>
          <button type="button" class="btn ghost" (click)="resetValues()">Khôi phục giá trị AI</button>
        } @else {
          <button type="button" class="btn ok" (click)="decide('accepted')">✓ Chấp nhận kết quả AI</button>
        }
        <button type="button" class="btn danger" (click)="decide('rejected')">✕ Từ chối</button>
      </div>
    }
  `,
  styles: `
    h3 { font-size: .95rem; margin: 0 0 .5rem; }
    .hint { font-size: .8rem; color: var(--muted); margin: 0 0 .75rem; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    label { display: flex; flex-direction: column; gap: .25rem; font-size: .78rem; font-weight: 600; color: var(--muted); margin-bottom: .6rem; }
    input, textarea { font: inherit; font-size: .9rem; font-weight: 500; color: var(--text); padding: .45rem .55rem; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); resize: vertical; }
    input:focus, textarea:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
    input.changed { border-color: var(--warn); background: var(--warn-soft); }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .err { color: var(--danger); font-size: .82rem; margin: 0 0 .5rem; }
    .decided { background: var(--ok-soft); border: 1px solid var(--ok); border-radius: var(--radius); padding: .75rem; font-size: .85rem; }
    .decided.rej { background: var(--danger-soft); border-color: var(--danger); }
    .decided p { margin: .35rem 0 0; }
    .decided .btn { margin-top: .6rem; }
  `,
})
export class ReviewPanel {
  private readonly store = inject(AnalysisStore);
  private readonly toast = inject(ToastService);

  readonly record = input.required<AnalysisRecord>();

  protected readonly ai = computed(() => this.record().result!.metrics);
  protected readonly mt = linkedSignal(() => this.ai().mt);
  protected readonly pa = linkedSignal(() => this.ai().pa);
  protected readonly fl = linkedSignal(() => this.ai().fl);
  protected readonly note = linkedSignal({ source: () => this.record().id, computation: () => '' });
  protected readonly error = linkedSignal({ source: () => this.record().id, computation: () => '' });
  protected readonly reviewer = signal(localStorage.getItem(REVIEWER_KEY) ?? '');

  protected readonly edited = computed(
    () => this.mt() !== this.ai().mt || this.pa() !== this.ai().pa || this.fl() !== this.ai().fl,
  );

  protected readonly statusLabel: Record<ReviewStatus, string> = {
    pending: 'Chờ duyệt',
    accepted: 'Đã chấp nhận',
    edited: 'Đã hiệu chỉnh & chấp nhận',
    rejected: 'Đã từ chối',
  };

  protected resetValues(): void {
    this.mt.set(this.ai().mt);
    this.pa.set(this.ai().pa);
    this.fl.set(this.ai().fl);
  }

  protected decide(status: Exclude<ReviewStatus, 'pending'>): void {
    const reviewer = this.reviewer().trim();
    const note = this.note().trim();
    if (!reviewer) return this.error.set('Vui lòng nhập tên người thẩm định.');
    if (status === 'rejected' && !note) return this.error.set('Vui lòng ghi lý do từ chối.');

    let final: MuscleMetrics | undefined;
    if (status === 'accepted') final = { ...this.ai() };
    if (status === 'edited') {
      final = { mt: Number(this.mt()), pa: Number(this.pa()), fl: Number(this.fl()) };
      const valid = final.mt > 0 && final.mt <= 100 && final.pa > 0 && final.pa < 90 && final.fl > 0 && final.fl <= 300;
      if (!valid) return this.error.set('Giá trị không hợp lệ (MT 0–100 mm, PA 0–90°, FL 0–300 mm).');
    }

    localStorage.setItem(REVIEWER_KEY, reviewer);
    this.error.set('');
    this.store.setReview(this.record().id, { status, final, reviewer, note: note || undefined, reviewedAt: new Date() });
    this.toast.show(status === 'rejected' ? 'warning' : 'success', `${this.statusLabel[status]}: ${this.record().fileName}`);
  }

  protected reopen(): void {
    this.store.setReview(this.record().id, { status: 'pending' });
  }
}
