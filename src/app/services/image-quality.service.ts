import { Injectable } from '@angular/core';
import { QualityReport } from '../models';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/bmp'];
export const MAX_BYTES = 10 * 1024 * 1024;

const MIN_SIDE = 256;
const BRIGHTNESS_RANGE: [number, number] = [25, 210];
const MIN_CONTRAST = 18;
const MIN_SHARPNESS = 40;
const MAX_CHROMA = 30;

/** Client-side pre-check so obviously bad images never reach the Jetson Nano. */
@Injectable({ providedIn: 'root' })
export class ImageQualityService {
  async check(file: File, url: string): Promise<QualityReport> {
    const empty: QualityReport = {
      ok: false, score: 0, width: 0, height: 0, brightness: 0, contrast: 0, sharpness: 0, issues: [],
    };

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { ...empty, issues: [`Định dạng "${file.type || 'không rõ'}" không được hỗ trợ (chỉ JPG, PNG, BMP).`] };
    }
    if (file.size > MAX_BYTES) {
      return { ...empty, issues: [`Dung lượng ${(file.size / 1048576).toFixed(1)} MB vượt quá giới hạn 10 MB.`] };
    }

    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      return { ...empty, issues: ['Không đọc được nội dung ảnh (tệp hỏng?).'] };
    }

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const scale = Math.min(1, 512 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const gray = new Float32Array(w * h);
    let sum = 0;
    let chroma = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[p] = y;
      sum += y;
      chroma += Math.max(r, g, b) - Math.min(r, g, b);
    }
    const n = w * h;
    const brightness = sum / n;
    chroma /= n;

    let varSum = 0;
    for (let p = 0; p < n; p++) varSum += (gray[p] - brightness) ** 2;
    const contrast = Math.sqrt(varSum / n);

    // Variance of the Laplacian: low values indicate a blurred image.
    let lapSum = 0, lapSq = 0, lapN = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const lap = gray[p - w] + gray[p + w] + gray[p - 1] + gray[p + 1] - 4 * gray[p];
        lapSum += lap;
        lapSq += lap * lap;
        lapN++;
      }
    }
    const lapMean = lapN ? lapSum / lapN : 0;
    const sharpness = lapN ? lapSq / lapN - lapMean * lapMean : 0;

    const issues: string[] = [];
    let score = 100;
    if (Math.min(width, height) < MIN_SIDE) {
      issues.push(`Độ phân giải quá thấp (${width}×${height}px, tối thiểu ${MIN_SIDE}px mỗi cạnh).`);
      score -= 35;
    }
    if (brightness < BRIGHTNESS_RANGE[0]) {
      issues.push(`Ảnh quá tối (độ sáng TB ${brightness.toFixed(0)}). Hãy tăng Gain trên máy siêu âm.`);
      score -= 25;
    } else if (brightness > BRIGHTNESS_RANGE[1]) {
      issues.push(`Ảnh quá sáng / bão hòa (độ sáng TB ${brightness.toFixed(0)}).`);
      score -= 25;
    }
    if (contrast < MIN_CONTRAST) {
      issues.push(`Độ tương phản thấp (${contrast.toFixed(1)}), khó phân biệt cân cơ và bó cơ.`);
      score -= 20;
    }
    if (sharpness < MIN_SHARPNESS) {
      issues.push(`Ảnh bị mờ / rung đầu dò (độ nét ${sharpness.toFixed(0)} < ${MIN_SHARPNESS}).`);
      score -= 25;
    }
    if (chroma > MAX_CHROMA) {
      issues.push('Ảnh có nhiều màu, không giống ảnh siêu âm B-mode thang xám.');
      score -= 30;
    }

    return {
      ok: issues.length === 0,
      score: Math.max(0, score),
      width,
      height,
      brightness,
      contrast,
      sharpness,
      issues,
    };
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
