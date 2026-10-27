import { Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AnalysisRecord } from '../models';
import { StatusBadge } from './status-badge';

@Component({
  selector: 'app-record-list',
  imports: [DatePipe, DecimalPipe, StatusBadge],
  template: `
    @if (records().length === 0) {
      <p class="empty">Chưa có ảnh nào. Hãy tải ảnh siêu âm lên để bắt đầu.</p>
    } @else {
      <ul>
        @for (r of records(); track r.id) {
          <li [class.active]="r.id === selectedId()" (click)="select.emit(r.id)">
            <img [src]="r.imageUrl" alt="" />
            <div class="info">
              <span class="name" [title]="r.fileName">{{ r.fileName }}</span>
              <span class="meta">
                {{ r.uploadedAt | date: 'HH:mm:ss' }}
                @if (r.result) { · MT {{ r.result.metrics.mt | number: '1.1-1' }} mm }
              </span>
              <app-status-badge [record]="r" />
            </div>
            <button type="button" class="del" title="Xóa" (click)="$event.stopPropagation(); remove.emit(r.id)">×</button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .empty { color: var(--muted); font-size: .85rem; text-align: center; padding: 1.5rem .5rem; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .4rem; }
    li { display: flex; gap: .6rem; align-items: center; padding: .45rem; border-radius: 10px; cursor: pointer; border: 1px solid transparent; }
    li:hover { background: var(--surface-2); }
    li.active { background: var(--primary-soft); border-color: var(--primary); }
    img { width: 56px; height: 44px; object-fit: cover; border-radius: 6px; background: #000; flex: none; }
    .info { display: flex; flex-direction: column; gap: .15rem; min-width: 0; flex: 1; align-items: flex-start; }
    .name { font-weight: 600; font-size: .85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .meta { font-size: .75rem; color: var(--muted); }
    .del { border: 0; background: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; padding: .2rem .4rem; border-radius: 6px; }
    .del:hover { background: var(--danger-soft); color: var(--danger); }
  `,
})
export class RecordList {
  readonly records = input.required<AnalysisRecord[]>();
  readonly selectedId = input<string | null>(null);
  readonly select = output<string>();
  readonly remove = output<string>();
}
