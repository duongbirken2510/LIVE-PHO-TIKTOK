# 🧩 Thư Mục Nạp Mô Hình Nhân Vật 3D Tùy Chỉnh (`Hybrid GLB/glTF Auto-Override` — Phương Án B)

Mặc định, **Phở Cô Ba 3D (`LIVE-PHO-TIKTOK`)** sử dụng bộ dựng nhân vật **Stylized Chibi 3D (Phương án A)** tích hợp sẵn trong `game.js` để khởi chạy tức thì (`0 MB` tải ngoài, `60 FPS`).

Khi bạn muốn thay thế bất kỳ nhân vật nào bằng mô hình 3D `.glb` xuất từ **Blender / Blockbench / Mixamo / ReadyPlayerMe**, chỉ cần chép file `.glb` vào thư mục `games/curry-shop-3d/assets/models/` theo đúng 1 trong 4 tên chuẩn sau:

| Tên file `.glb` trong `assets/models/` | Nhân vật được thay thế tự động |
| :--- | :--- |
| **`coba.glb`** | Nhân vật **Cô Ba** đứng nấu phở sau quầy |
| **`customer-female.glb`** | Khách hàng **Nữ** vào quán gọi phở |
| **`customer-male.glb`** | Khách hàng **Nam** vào quán gọi phở |
| **`customer-vip.glb`** | Khách hàng **Đại Gia / VIP** (gọi *Phở Đặc Biệt*, *Tô Xe Lửa VIP*, *Bao Trọn Quán*) |

Hệ thống `/api/models` trong `server.mjs` và `initHybridGlbOverrides()` trong `game.js` sẽ **tự động phát hiện và nạp mô hình `.glb`** ngay khi mở trang mà không cần sửa bất kỳ dòng code nào!
