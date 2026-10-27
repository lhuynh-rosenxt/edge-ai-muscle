import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeviceStatus } from './models';
import { AnalysisStore } from './services/analysis.store';
import { DEFAULT_BASE_URL, EdgeApiService } from './services/edge-api.service';
import { ToastService } from './services/toast.service';
import { downloadCsv, recordsToCsv } from './services/csv';
import { UploadPanel } from './components/upload-panel';
import { RecordList } from './components/record-list';
import { ResultViewer } from './components/result-viewer';
import { ReviewPanel } from './components/review-panel';
import { Toasts } from './components/toasts';

type ExportScope = 'approved' | 'reviewed' | 'all';

@Component({
  selector: 'app-root',
  imports: [FormsModule, UploadPanel, RecordList, ResultViewer, ReviewPanel, Toasts],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(AnalysisStore);
  protected readonly api = inject(EdgeApiService);
  private readonly toast = inject(ToastService);

  protected readonly device = signal<DeviceStatus | null>(null);
  protected readonly settingsOpen = signal(false);
  protected readonly draftUrl = signal(this.api.settings().baseUrl);
  protected readonly draftMock = signal(this.api.settings().mock);
  protected readonly exportScope = signal<ExportScope>('approved');
  protected readonly defaultUrl = DEFAULT_BASE_URL;

  constructor() {
    this.refreshDevice();
    const timer = setInterval(() => this.refreshDevice(), 10000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected async refreshDevice(): Promise<void> {
    this.device.set(await this.api.health());
  }

  protected openSettings(): void {
    this.draftUrl.set(this.api.settings().baseUrl);
    this.draftMock.set(this.api.settings().mock);
    this.settingsOpen.set(true);
  }

  protected saveSettings(): void {
    const url = this.draftUrl().trim().replace(/\/+$/, '');
    if (!this.draftMock() && !/^(https?:\/\/\S+|\/[\w\-/]*)$/i.test(url)) {
      this.toast.show('error', 'Địa chỉ thiết bị không hợp lệ', ['Ví dụ: /jetson hoặc http://100.80.70.189:8000']);
      return;
    }
    this.api.updateSettings({ baseUrl: url, mock: this.draftMock() });
    this.settingsOpen.set(false);
    this.refreshDevice();
  }

  protected exportCsv(): void {
    const scope = this.exportScope();
    const rows = this.store.records().filter((r) => {
      if (scope === 'all') return true;
      if (r.stage !== 'done') return false;
      if (scope === 'reviewed') return r.review.status !== 'pending';
      return r.review.status === 'accepted' || r.review.status === 'edited';
    });
    if (!rows.length) {
      this.toast.show('warning', 'Không có dữ liệu để xuất', [
        scope === 'approved' ? 'Chưa có kết quả nào được chấp nhận.' : 'Danh sách trống.',
      ]);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsv(`muscle-metrics_${stamp}.csv`, recordsToCsv(rows));
    this.toast.show('success', `Đã tải xuống CSV (${rows.length} dòng)`);
  }
}
