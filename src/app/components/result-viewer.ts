import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalysisRecord } from '../models';
import { AnalysisStore } from '../services/analysis.store';
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
      @if (r.imageUrl) {
        <img [src]="r.imageUrl" [alt]="r.fileName" />
      } @else {
        <div class="no-preview">{{ r.stage === 'checking' ? 'Đang giải mã ảnh…' : 'Không hiển thị được ảnh xem trước' }}</div>
      }
      @if (showOverlay() && overlay(); as o) {
        <svg [attr.viewBox]="'0 0 ' + r.quality!.width + ' ' + r.quality!.height" preserveAspectRatio="none">
          <line [attr.x1]="o.superficial[0][0]" [attr.y1]="o.superficial[0][1]" [attr.x2]="o.superficial[1][0]" [attr.y2]="o.superficial[1][1]" class="apo" />
          <line [attr.x1]="o.deep[0][0]" [attr.y1]="o.deep[0][1]" [attr.x2]="o.deep[1][0]" [attr.y2]="o.deep[1][1]" class="apo" />
          <line [attr.x1]="o.fascicle[0][0]" [attr.y1]="o.fascicle[0][1]" [attr.x2]="o.fascicle[1][0]" [attr.y2]="o.fascicle[1][1]" class="fas" />
        </svg>
      }
      @if (r.stage === 'processing' || r.stage === 'checking' || r.stage === 'queued') {
        <div class="busy"><span class="spinner"></span>{{ busyLabel[r.stage] }}</div>
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
          <strong>Ảnh không đạt yêu cầu.</strong>
          <ul>@for (i of r.quality?.issues; track $index) { <li>{{ i }}</li> }</ul>
          <p>Vui lòng chụp lại ảnh và tải lên lần nữa, hoặc nếu bạn chắc chắn ảnh dùng được:</p>
          @if (r.quality?.width) {
            <button type="button" class="btn ghost sm" (click)="store.forceAnalyze(r.id)">Vẫn gửi tới Jetson Nano</button>
          }
        </div>
      }
      @case ('error') {
        <div class="alert danger">
          <strong>Không xử lý được ảnh.</strong>
          <p>{{ r.error }}</p>
          <p>Kiểm tra kết nối tới Jetson Nano trong mục Cài đặt.</p>
          <button type="button" class="btn ghost sm" (click)="store.forceAnalyze(r.id)">Thử lại</button>
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
            <span class="label">PA · Góc lông vũ</span>
            <span class="value">{{ (f?.pa ?? m.pa) | number: '1.2-2' }}<small>°</small></span>
            @if (f && f.pa !== m.pa) { <span class="ai">AI: {{ m.pa | number: '1.2-2' }}°</span> }
          </div>
          <div class="metric">
            <span class="label">FL · Chiều dài bó cơ</span>
            <span class="value">{{ (f?.fl ?? m.fl) | number: '1.2-2' }}<small>mm</small></span>
            @if (f && f.fl !== m.fl) { <span class="ai">AI: {{ m.fl | number: '1.2-2' }} mm</span> }
          </div>
        </div>
        @let res = r.result!;
        <div class="facts">
          @if (res.confidence !== undefined) {
            <span>Độ tin cậy <b [class.low]="res.confidence < 0.75">{{ res.confidence * 100 | number: '1.0-0' }}%</b></span>
          }
          <span>Suy luận <b>{{ res.inferenceMs | number: '1.0-1' }} ms</b></span>
          @if (res.latencyMs !== undefined) { <span>Tổng độ trễ <b>{{ res.latencyMs | number: '1.0-1' }} ms</b></span> }
          @if (res.pxPerCm !== undefined) { <span>Tỉ lệ <b>{{ res.pxPerCm | number: '1.0-1' }} px/cm</b></span> }
          <span>Chất lượng ảnh <b>{{ r.quality!.score }}/100</b></span>
          <span>Thiết bị <b>{{ res.device }}</b></span>
          @if (res.requestId) { <span>Request <b>{{ res.requestId }}</b></span> }
        </div>
        @if (res.resources; as hw) {
          <div class="facts hw">
            @if (hw.gpuLoadPct !== undefined) { <span>GPU <b>{{ hw.gpuLoadPct | number: '1.0-0' }}%</b></span> }
            @if (hw.gpuFreqMhz !== undefined) { <span>GPU freq <b>{{ hw.gpuFreqMhz | number: '1.0-0' }} MHz</b></span> }
            @if (hw.cpuSystemPct !== undefined) { <span>CPU <b>{{ hw.cpuSystemPct | number: '1.0-0' }}%</b></span> }
            @if (hw.ramUsedMb !== undefined) { <span>RAM <b>{{ hw.ramUsedMb | number: '1.0-0' }} MB</b></span> }
            @if (hw.cpuTemp !== undefined) { <span>CPU <b>{{ hw.cpuTemp }}°C</b></span> }
            @if (hw.gpuTemp !== undefined) { <span>GPU <b>{{ hw.gpuTemp }}°C</b></span> }
          </div>
        }
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
    .facts.hw { margin-top: .35rem; padding-top: .35rem; border-top: 1px dashed var(--border); }
    .no-preview { height: 260px; display: grid; place-items: center; color: #94a3b8; line-height: 1.4; }
    .alert .btn { margin-top: .6rem; }
    .alert { margin-top: 1rem; padding: .9rem 1rem; border-radius: var(--radius); font-size: .88rem; }
    .alert ul { margin: .4rem 0; padding-left: 1.2rem; }
    .alert p { margin: .3rem 0 0; }
    .alert.warn { background: var(--warn-soft); color: #7a4a00; border: 1px solid var(--warn); }
    .alert.danger { background: var(--danger-soft); color: #7f1d1d; border: 1px solid var(--danger); }
    @media (max-width: 640px) { .metrics { grid-template-columns: 1fr; } }
  `,
})
export class ResultViewer {
  protected readonly store = inject(AnalysisStore);
  readonly record = input.required<AnalysisRecord>();
  protected readonly busyLabel: Record<string, string> = {
    checking: 'Đang kiểm tra chất lượng ảnh…',
    queued: 'Đang chờ gửi tới Jetson…',
    processing: 'Jetson Nano đang suy luận…',
  };
  protected readonly showOverlay = signal(true);
  protected readonly overlay = computed(() => {
    const r = this.record();
    return r.stage === 'done' && r.quality?.width ? r.result?.overlay ?? null : null;
  });
}
