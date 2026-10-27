import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="stack" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" role="status">
          <div class="head">
            <strong>{{ t.title }}</strong>
            <button type="button" aria-label="Đóng" (click)="toast.dismiss(t.id)">×</button>
          </div>
          @if (t.details?.length) {
            <ul>
              @for (d of t.details; track $index) { <li>{{ d }}</li> }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; right: 1rem; bottom: 1rem; z-index: 50; display: flex; flex-direction: column; gap: .6rem; width: min(380px, calc(100vw - 2rem)); }
    .toast { background: var(--surface); border-radius: 10px; padding: .75rem .9rem; box-shadow: 0 8px 24px rgb(0 0 0 / .15); border-left: 5px solid var(--primary); animation: in .2s ease-out; }
    .toast.success { border-color: var(--ok); }
    .toast.warning { border-color: var(--warn); }
    .toast.error { border-color: var(--danger); }
    .head { display: flex; justify-content: space-between; gap: .5rem; align-items: start; }
    strong { font-size: .9rem; }
    button { border: 0; background: none; font-size: 1.2rem; line-height: 1; cursor: pointer; color: var(--muted); }
    ul { margin: .4rem 0 0; padding-left: 1.1rem; font-size: .82rem; color: var(--muted); }
    @keyframes in { from { transform: translateY(10px); opacity: 0; } }
  `,
})
export class Toasts {
  protected readonly toast = inject(ToastService);
}
