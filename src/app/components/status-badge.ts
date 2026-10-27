import { Component, computed, input } from '@angular/core';
import { AnalysisRecord } from '../models';

@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [class]="view().cls">{{ view().label }}</span>`,
  styles: `
    .badge { display: inline-block; font-size: .7rem; font-weight: 600; padding: .12rem .5rem; border-radius: 999px; white-space: nowrap; }
    .muted { background: var(--surface-2); color: var(--muted); }
    .info { background: var(--primary-soft); color: var(--primary); }
    .ok { background: var(--ok-soft); color: var(--ok); }
    .warn { background: var(--warn-soft); color: var(--warn); }
    .danger { background: var(--danger-soft); color: var(--danger); }
  `,
})
export class StatusBadge {
  readonly record = input.required<AnalysisRecord>();

  protected readonly view = computed(() => {
    const r = this.record();
    switch (r.stage) {
      case 'checking': return { label: 'Đang kiểm tra ảnh…', cls: 'muted' };
      case 'queued': return { label: 'Đang chờ', cls: 'muted' };
      case 'processing': return { label: 'Jetson đang xử lý…', cls: 'info' };
      case 'quality_failed': return { label: 'Ảnh không đạt', cls: 'warn' };
      case 'error': return { label: 'Lỗi kết nối', cls: 'danger' };
    }
    switch (r.review.status) {
      case 'accepted': return { label: 'Đã chấp nhận', cls: 'ok' };
      case 'edited': return { label: 'Đã hiệu chỉnh', cls: 'ok' };
      case 'rejected': return { label: 'Đã từ chối', cls: 'danger' };
      default: return { label: 'Chờ duyệt', cls: 'info' };
    }
  });
}
