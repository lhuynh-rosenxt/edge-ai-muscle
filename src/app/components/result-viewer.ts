import { Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalysisRecord } from '../models';
import { StatusBadge } from './status-badge';

@Component({
  selector: 'app-result-viewer',
  imports: [DecimalPipe, StatusBadge],
  template: `
    @let r = record();
    <div class="title">
      <h2 [title]="r.fileName">{{ r.fileName }}</h2>
      <app-status-badge [record]="r" />
    </div>

    <div class="image-wrap">
      <img [src]="r.imageUrl" [alt]="r.fileName" />
      @if (showOverlay() && overlay(); as o) {
        <svg [attr.viewBox]="'0 0 ' + r.quality!.width + ' ' + r.quality!.height" preserveAspectRatio="none">
          <line [attr.x1]="o.superficial[0][0]" [attr.y1]="o.superficial[0][1]" [attr.x2]="o.superficial[1][0]" [attr.y2]="o.superficial[1][1]" class="apo" />
          <line [attr.x1]="o.deep[0][0]" [attr.y1]="o.deep[0][1]" [attr.x2]="o.deep[1][0]" [attr.y2]="o.deep[1][1]" class="apo" />
          <line [attr.x1]="o.fascicle[0][0]" [attr.y1]="o.fascicle[0][1]" [attr.x2]="o.fascicle[1][0]" [attr.y2]="o.fascicle[1][1]" class="fas" />
        </svg>
      }
      @if (r.stage === 'processing' || r.stage === 'checking') {
        <div class="busy"><span class="spinner"></span>{{ r.stage === 'checking' ? 'Đang kiểm tra chất lượng ảnh…' : 'Jetson Nano đang suy luận…' }}</div>
      }
    </div>

    @if (overlay()) {
      <div class="legend">
        <label><input type="checkbox" [checked]="showOverlay()" (change)="showOverlay.set(!showOverlay())" /> Hiển thị lớp phủ</label>
        <span><i class="apo"></i>Cân cơ nông / sâu</span>
        <span><i class="fas"></i>Bó cơ</span>
      </div>
    }

    @switch (r.stage) {
      @case ('quality_failed') {
        <div class="alert warn">
          <strong>Ảnh không đạt yêu cầu – không gửi tới thiết bị biên.</strong>
          <ul>@for (i of r.quality?.issues; track $index) { <li>{{ i }}</li> }</ul>
          <p>Vui lòng chụp lại ảnh và tải lên lần nữa.</p>
        </div>
      }
      @case ('error') {
        <div class="alert danger">
          <strong>Không xử lý được ảnh.</strong>
          <p>{{ r.error }}</p>
          <p>Kiểm tra kết nối tới Jetson Nano trong mục Cài đặt.</p>
        </div>
      }
      @case ('done') {
        @let m = r.result!.metrics;
        @let f = r.review.final;
        <div class="metrics">
          <div class="metric">
            <span class="label">MT · Độ dày cơ</span>
            <span class="value">{{ (f?.mt ?? m.mt) | number: '1.2-2' }}<small>mm</small></span>
            @if (f && f.mt !== m.mt) { <span class="ai">AI: {{ m.mt | number: '1.2-2' }} mm</span> }
          </div>
          <div class="metric">
            <span class="label">PA · Góc lông chim</span>
            <span class="value">{{ (f?.pa ?? m.pa) | number: '1.2-2' }}<small>°</small></span>
            @if (f && f.pa !== m.pa) { <span class="ai">AI: {{ m.pa | number: '1.2-2' }}°</span> }
          </div>
          <div class="metric">
            <span class="label">FL · Chiều dài bó cơ</span>
            <span class="value">{{ (f?.fl ?? m.fl) | number: '1.2-2' }}<small>mm</small></span>
            @if (f && f.fl !== m.fl) { <span class="ai">AI: {{ m.fl | number: '1.2-2' }} mm</span> }
          </div>
        </div>
        <div class="facts">
          <span>Độ tin cậy <b [class.low]="r.result!.confidence < 0.75">{{ r.result!.confidence * 100 | number: '1.0-0' }}%</b></span>
          <span>Thời gian suy luận <b>{{ r.result!.inferenceMs | number: '1.0-1' }} ms</b></span>
          <span>Chất lượng ảnh <b>{{ r.quality!.score }}/100</b></span>
          <span>Thiết bị <b>{{ r.result!.device }}</b></span>
        </div>
      }
    }
  `,
  styles: `
    .title { display: flex; align-items: center; gap: .6rem; margin-bottom: .75rem; }
    h2 { font-size: 1.05rem; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .image-wrap { position: relative; background: #000; border-radius: var(--radius); overflow: hidden; line-height: 0; }
    img { width: 100%; max-height: 460px; object-fit: contain; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    img + svg { pointer-events: none; }
    line.apo { stroke: #facc15; stroke-width: 3; vector-effect: non-scaling-stroke; }
    line.fas { stroke: #22d3ee; stroke-width: 3; stroke-dasharray: 8 5; vector-effect: non-scaling-stroke; }
    .busy { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: .6rem; background: rgb(0 0 0 / .55); color: #fff; line-height: 1.4; font-weight: 600; }
    .spinner { width: 22px; height: 22px; border: 3px solid rgb(255 255 255 / .3); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .legend { display: flex; flex-wrap: wrap; gap: 1rem; font-size: .8rem; color: var(--muted); margin-top: .5rem; align-items: center; }
    .legend i { display: inline-block; width: 18px; height: 3px; margin-right: .35rem; vertical-align: middle; }
    .legend i.apo { background: #facc15; }
    .legend i.fas { background: #22d3ee; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; margin-top: 1rem; }
    .metric { background: var(--surface-2); border-radius: var(--radius); padding: .8rem 1rem; display: flex; flex-direction: column; gap: .2rem; border-top: 4px solid var(--primary); }
    .label { font-size: .78rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .02em; }
    .value { font-size: 1.9rem; font-weight: 700; }
    .value small { font-size: .9rem; font-weight: 500; color: var(--muted); margin-left: .2rem; }
    .ai { font-size: .75rem; color: var(--muted); text-decoration: line-through; }
    .facts { display: flex; flex-wrap: wrap; gap: .4rem 1.2rem; margin-top: .75rem; font-size: .82rem; color: var(--muted); }
    .facts b { color: var(--text); }
    .facts b.low { color: var(--warn); }
    .alert { margin-top: 1rem; padding: .9rem 1rem; border-radius: var(--radius); font-size: .88rem; }
    .alert ul { margin: .4rem 0; padding-left: 1.2rem; }
    .alert p { margin: .3rem 0 0; }
    .alert.warn { background: var(--warn-soft); color: #7a4a00; border: 1px solid var(--warn); }
    .alert.danger { background: var(--danger-soft); color: #7f1d1d; border: 1px solid var(--danger); }
    @media (max-width: 640px) { .metrics { grid-template-columns: 1fr; } }
  `,
})
export class ResultViewer {
  readonly record = input.required<AnalysisRecord>();
  protected readonly showOverlay = signal(true);
  protected readonly overlay = computed(() => {
    const r = this.record();
    return r.stage === 'done' && r.quality?.width ? r.result?.overlay ?? null : null;
  });
}
