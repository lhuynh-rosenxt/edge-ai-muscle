import { Component, output, signal } from '@angular/core';
import { ACCEPT_ATTR } from '../services/image-quality.service';

@Component({
  selector: 'app-upload-panel',
  template: `
    <label
      class="drop"
      [class.over]="dragOver()"
      (dragover)="$event.preventDefault(); dragOver.set(true)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <input type="file" [accept]="accept" multiple hidden (change)="onPick($event)" />
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
        <path fill="currentColor" d="M19 15v4H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4zM11 5.83V16h2V5.83l3.59 3.58L18 8l-6-6-6 6 1.41 1.41z"/>
      </svg>
      <strong>Kéo thả ảnh siêu âm vào đây</strong>
      <span>hoặc bấm để chọn tệp (TIF, PNG, JPG · ≤ 20 MB · nhiều ảnh)</span>
    </label>
    <ul class="req">
      <li>Giữ nguyên tên & đuôi tệp gốc (hệ thống dùng để suy ra tỉ lệ px/cm)</li>
      <li>Ảnh B-mode thang xám, mặt cắt dọc bó cơ</li>
      <li>Thấy rõ cân cơ nông & sâu</li>
      <li>Độ phân giải ≥ 256 px, không mờ, không quá tối/sáng</li>
    </ul>
  `,
  styles: `
    .drop {
      display: flex; flex-direction: column; align-items: center; gap: .35rem;
      padding: 1.6rem 1rem; border: 2px dashed var(--border-strong); border-radius: var(--radius);
      background: var(--surface-2); color: var(--muted); text-align: center; cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .drop:hover, .drop.over { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
    strong { color: var(--text); }
    span { font-size: .82rem; }
    .req { margin: .75rem 0 0; padding-left: 1.1rem; font-size: .8rem; color: var(--muted); line-height: 1.6; }
  `,
})
export class UploadPanel {
  readonly files = output<File[]>();
  protected readonly accept = ACCEPT_ATTR;
  protected readonly dragOver = signal(false);

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const list = e.dataTransfer?.files;
    if (list?.length) this.files.emit(Array.from(list));
  }

  protected onPick(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) this.files.emit(Array.from(input.files));
    input.value = '';
  }
}
