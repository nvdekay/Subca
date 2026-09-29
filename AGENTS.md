# Subca — hướng dẫn cho AI coding agent

Giao tiếp với chủ dự án bằng tiếng Việt.

## Bắt đầu mọi session

Đọc toàn bộ [`docs/PROJECT-KNOWLEDGE.md`](docs/PROJECT-KNOWLEDGE.md) trước khi phân tích hay sửa code. Đây là nguồn sự thật trung tâm về sản phẩm, hiện trạng, việc tiếp theo, quyết định kỹ thuật, quy ước và các bẫy đã biết. Không cần quét lại toàn repo chỉ để tìm hiểu dự án; chỉ đọc những file code liên quan trực tiếp đến task đang làm.

Nếu làm trong thư mục có `AGENTS.md` gần hơn, áp dụng thêm hướng dẫn ở file đó. Đặc biệt:

- `apps/mobile/AGENTS.md`: quy tắc Expo/React Native theo đúng SDK đang dùng.
- `apps/admin/AGENTS.md`: quy tắc Next.js theo đúng phiên bản đang dùng.

## Giữ project memory luôn đúng

Sau mỗi thay đổi làm thay đổi trạng thái, hành vi, kiến trúc, dependency, môi trường, ưu tiên hoặc checklist của dự án, phải cập nhật `docs/PROJECT-KNOWLEDGE.md` trong cùng task. Cập nhật thêm:

- `docs/SUBCA-CHECKLIST.md` khi tiến độ chi tiết thay đổi.
- `docs/ARCHITECTURE.md` khi có quyết định kỹ thuật mới hoặc thay đổi quyết định cũ.
- `.env.example` và phần môi trường trong knowledge base khi thêm/bỏ biến môi trường.

Không ghi secret, token, mật khẩu hoặc chuỗi kết nối thật vào tài liệu. Khi tài liệu và code mâu thuẫn trong phạm vi task, xác minh phần code liên quan rồi sửa lại tài liệu trước khi kết thúc.

## Quy tắc quan trọng

- Không bàn lại quyết định đã chốt nếu task không yêu cầu; xem mục “Quyết định đã chốt” trong knowledge base.
- Không commit/push trừ khi chủ dự án yêu cầu hoặc đang tiếp tục một yêu cầu đã bao gồm commit/push.
- Không thêm attribution của AI vào commit/PR. Commit Conventional Commits bằng tiếng Việt.
- Tôn trọng thay đổi đang có của người dùng; không xóa hoặc hoàn nguyên file ngoài phạm vi.
