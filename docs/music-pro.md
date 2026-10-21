# Music Pro / SePay

## Hành vi

- Chỉ ADMIN được thêm, sửa, xóa nhạc và nghệ sĩ. Nội dung cũ vẫn giữ nguyên.
- Cần đăng nhập để nghe. Free có 3 lượt phát/ngày, đặt lại lúc 00:00 Asia/Ho_Chi_Minh. Chuyển bài, phát lặp tính lượt mới; tạm dừng/nghe tiếp không tính thêm trong phiên 2 giờ.
- Trước mỗi lượt Free có banner quảng bá Music Pro trong 10 giây. Máy chủ chỉ cấp nguồn phát sau thời gian này. Đây là quảng cáo nội bộ, chưa tích hợp mạng quảng cáo thương mại.
- Pro giá 50.000 VND/30 ngày, không giới hạn lượt và không có quảng cáo MusicWave. Gia hạn cộng tiếp từ ngày hết hạn nếu còn hạn, hoặc từ lúc xác nhận nếu đã hết hạn.
- Thời hạn QR là 30 phút. Chỉ giao dịch tiền vào, đúng MB Bank, số tài khoản, nội dung, số tiền và thời điểm chuyển khoản trong thời hạn đơn mới kích hoạt. Webhook trễ vẫn được xử lý theo thời điểm giao dịch.
- Đơn thanh toán và gia hạn được cập nhật trong cùng transaction, khóa theo người dùng và unique transactionId ngăn cộng hạn trùng. Free quota và ghi lịch sử cũng cùng transaction.

## Triển khai

1. Sao lưu database và áp dụng thay đổi schema trước khi chạy bản ứng dụng mới. Dự án hiện dùng `prisma db push`; có thể chạy `npx prisma db push` ở thư mục gốc cho database đã có. SQL thay đổi bổ sung nằm ở `prisma/migrations/202610210001_music_pro/migration.sql`. Không chạy cả hai cách. Nếu chuyển sang Prisma Migrate, cần baseline schema cũ trước vì đây chưa phải lịch sử migration đầy đủ.
2. Chạy `npx prisma generate` ở gốc và `npm --prefix server run db:generate` nếu dùng backend riêng; build frontend/backend.
3. Cấu hình server: `SEPAY_ACCOUNT_NUMBER=0819883208`, `SEPAY_BANK=MBBank`, `SEPAY_WEBHOOK_KEY=<secret ngẫu nhiên mạnh>`. Khóa chỉ ở server, không đặt vào biến VITE hoặc commit vào Git. Dùng JWT_SECRET ngẫu nhiên riêng, không dùng khóa ví dụ.
4. Liên kết tài khoản MB Bank 0819883208 trong SePay. Tạo webhook tiền vào cho tài khoản này, URL `https://<domain>/api/music-pro/sepay/webhook`, xác thực API Key với đúng SEPAY_WEBHOOK_KEY. Nếu bật bộ lọc mã thanh toán, cấu hình tiền tố MW và kiểm tra SePay trả nguyên mã đơn trong content/code.
5. Tạo đơn trên `/music-pro`, dùng SePay Test Mode để kiểm tra sai khóa, sai số tiền, sai tài khoản, trùng giao dịch và giao dịch hợp lệ trước khi bật nhận tiền thật. Cấu hình webhook live riêng; không gửi sự kiện test vào database live.
6. Chuyển thiếu/thừa tiền, sai nội dung hoặc quá hạn không tự kích hoạt; quản trị viên đối soát và xử lý riêng. Không có nút tự xác nhận thanh toán ở client.

Khi chưa đặt SEPAY_WEBHOOK_KEY, giao diện khóa nút thanh toán và API không tạo QR để tránh thu tiền khi chưa có xác nhận tự động.

## Giới hạn nguồn nhạc và vận hành

API danh mục ẩn nguồn phát với người dùng thường; audio inline và file upload cục bộ cần vé phát. URL công khai của nhà cung cấp bên ngoài vẫn có thể được sao chép sau khi được cấp quyền, không phải DRM. Muốn hạn chế truy cập trực tiếp hoàn toàn cần chuyển kho nhạc sang storage private với signed URL ngắn hạn. YouTube có thể chèn quảng cáo riêng; để bảo đảm trải nghiệm hoàn toàn không quảng cáo, dùng file nhạc được cấp phép do admin lưu trữ thay cho YouTube.

Định kỳ dọn `playback_sessions` hết hạn (giữ thời gian phù hợp cho điều tra); giữ đơn thanh toán phục vụ đối soát. Bản thay đổi chưa tự chạy migration lên database, chưa deploy và chưa liên kết tài khoản SePay.

## Kiểm tra

`npm --prefix server run test:music-pro` chạy kiểm tra policy và route với database giả lập (không đụng database thật). Cần chạy thêm kiểm thử giao dịch đồng thời trên PostgreSQL staging và webhook SePay Test Mode trước khi nhận thanh toán thật.

Tài liệu chính thức: [Webhook SePay](https://docs.sepay.vn/tich-hop-webhooks.html), [VietQR](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code).
