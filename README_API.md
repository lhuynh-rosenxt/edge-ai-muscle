# Hướng Dẫn Sử Dụng API (Muscle Architecture Inference API)

**Base URL:** `http://netbird.kiromerlab.com:8000` *(hoặc `http://100.80.70.189:8000`)*

> **Lưu ý:** Khi gửi ảnh (`.tif` hoặc `.png`), cần giữ nguyên **tên file / đuôi file gốc** vì hệ thống dựa vào đuôi file để giải mã tỉ lệ thước đo (`px_per_cm`).

---

## 1. Tổng Quan Các Endpoint

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra trạng thái hoạt động của API và tài nguyên thiết bị tức thời |
| `POST` | `/predict` | Suy luận **1 ảnh** (trả về `pa_deg`, `fl_mm`, `mt_mm` và tài nguyên tiêu thụ) |
| `POST` | `/predict_batch` | Suy luận **nhiều ảnh** cùng lúc (tối đa 64 ảnh/request) |
| `GET` | `/metrics` | Xem thống kê hiệu năng tổng hợp (`?n=20` để lấy thêm 20 request gần nhất) |

---

## 2. Chi Tiết Cách Gọi Từng Endpoint

### 2.1. Kiểm tra trạng thái (`GET /health`)

```bash
curl http://netbird.kiromerlab.com:8000/health
```

---

### 2.2. Dự đoán 1 ảnh (`POST /predict`)

* **Tham số đầu vào:**
  * Cách 1 (`multipart/form-data`): trường `file` chứa file ảnh.
  * Cách 2 (`raw binary`): gửi raw bytes của ảnh trong body kèm query `?filename=IMG_00001.tif`.

#### Gọi bằng `curl`:
```bash
# Linux / macOS / Windows CMD:
curl -X POST -F "file=@IMG_00001.tif" http://netbird.kiromerlab.com:8000/predict

# Windows PowerShell:
curl.exe -X POST -F "file=@IMG_00001.tif" http://netbird.kiromerlab.com:8000/predict
```

#### Gọi bằng Python (`requests`):
```python
import requests

url = "http://netbird.kiromerlab.com:8000/predict"
img_path = "data/test_set_v2/IMG_00001.tif"

with open(img_path, "rb") as f:
    r = requests.post(url, files={"file": ("IMG_00001.tif", f)}, timeout=30)

data = r.json()
print("PA (deg):", data["pa_deg"])
print("FL (mm) :", data["fl_mm"])
print("MT (mm) :", data["mt_mm"])
print("Latency :", data["latency_ms"], "ms")
```

#### Kết quả JSON trả về:
```json
{
  "request_id": "20261027-140000-000001",
  "image_id": "IMG_00001.tif",
  "pa_deg": 12.25,
  "fl_mm": 121.15,
  "mt_mm": 25.71,
  "px_per_cm": 135.3,
  "decode_ms": 8.2,
  "infer_ms": 35.8,
  "latency_ms": 44.0,
  "resources": {
    "window_ms": 44.3,
    "cpu_time_ms": 20.0,
    "cpu_process_pct_of_1core": 45.15,
    "cpu_system_pct": 28.5,
    "gpu_load_avg_pct": 64.2,
    "gpu_freq_mhz": 921.0,
    "ram_used_peak_mb": 3179.4,
    "process_rss_mb": 1432.0,
    "swap_used_mb": 643.04,
    "temps_c": {
      "CPU-therm": 39.0,
      "GPU-therm": 38.0
    }
  }
}
```

**Ý nghĩa các trường kết quả chính:**
* `pa_deg`: Góc lông chim — Pennation Angle (độ).
* `fl_mm`: Chiều dài thớ cơ — Fascicle Length (mm).
* `mt_mm`: Độ dày cơ — Muscle Thickness (mm).
* `px_per_cm`: Tỉ lệ quy đổi từ pixel sang cm trên ảnh siêu âm.
* `decode_ms` / `infer_ms` / `latency_ms`: Thời gian giải mã ảnh, thời gian suy luận model và tổng thời gian xử lý (ms).
* `resources`: Thông số phần cứng tiêu thụ cho request đó (CPU, GPU, RAM, Nhiệt độ, Điện năng).

---

### 2.3. Dự đoán nhiều ảnh cùng lúc (`POST /predict_batch`)

* **Tham số đầu vào:** `multipart/form-data` lặp lại trường `files` (tối đa **64 ảnh/request**).

#### Gọi bằng `curl`:
```bash
curl.exe -X POST \
  -F "files=@IMG_00001.tif" \
  -F "files=@IMG_00002.tif" \
  -F "files=@IMG_00252.png" \
  http://netbird.kiromerlab.com:8000/predict_batch
```

#### Gọi bằng Python (`requests`):
```python
import requests

url = "http://netbird.kiromerlab.com:8000/predict_batch"
files = [
    ("files", ("IMG_00001.tif", open("data/test_set_v2/IMG_00001.tif", "rb"))),
    ("files", ("IMG_00002.tif", open("data/test_set_v2/IMG_00002.tif", "rb"))),
]

r = requests.post(url, files=files, timeout=120)
print(r.json())
```

---

### 2.4. Xem thống kê hiệu năng (`GET /metrics`)

* **Tham số query:** `?n=20` (số lượng request gần nhất muốn xem chi tiết, mặc định `20`, đặt `n=0` nếu chỉ lấy bảng tổng hợp `summary`).

```bash
curl "http://netbird.kiromerlab.com:8000/metrics?n=20"
```

---

## 3. Chạy Batch Toàn Bộ Thư Mục Ảnh (`batch_client.py`)

Sử dụng script `batch_client.py` để tự động gửi cả thư mục ảnh qua API và xuất ra file CSV:

```bash
pip install requests

# Chạy toàn bộ ảnh trong thư mục data/test_set_v2:
python jetson_deployment/batch_client.py \
  --api http://netbird.kiromerlab.com:8000 \
  --input_dir data/test_set_v2 \
  --output_csv result_api.csv

# Hoặc chỉ test thử 10 ảnh đầu tiên:
python jetson_deployment/batch_client.py \
  --api http://netbird.kiromerlab.com:8000 \
  --input_dir data/test_set_v2 \
  --output_csv result_api.csv \
  --limit 10
```

**File xuất ra sau khi chạy:**
* `result_api.csv`: Kết quả dự đoán (`image_id, pa_deg, fl_mm, mt_mm`).
* `result_api_resources.csv`: Log hiệu năng & tài nguyên phần cứng của từng ảnh.
* `result_api_failed.csv`: Danh sách ảnh lỗi (nếu có).
