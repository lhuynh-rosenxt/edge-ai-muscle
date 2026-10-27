import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  details?: string[];
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(kind: ToastKind, title: string, details?: string[]): void {
    const id = this.nextId++;
    this.toasts.update((t) => [...t, { id, kind, title, details }]);
    const ttl = kind === 'warning' || kind === 'error' ? 10000 : 5000;
    setTimeout(() => this.dismiss(id), ttl);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
