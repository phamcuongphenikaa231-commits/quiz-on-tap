# Quiz Ôn Tập - Production-Ready MVP

Hệ thống làm quiz ôn tập trắc nghiệm trực tuyến tối giản, bảo mật, giới hạn tối đa 2 thiết bị hoạt động trên mỗi tài khoản và chống lộ đáp án client-side.

---

## 🚀 Tính năng chính

- **Xác thực:** Đăng nhập email & mật khẩu (Auth Supabase).
- **Giới hạn 2 thiết bị:** Mỗi tài khoản tối đa 2 thiết bị hoạt động đồng thời (sử dụng Cookie SHA-256 token hash & Postgres Advisory Locks).
- **Phân quyền môn học:** Học viên chỉ nhìn thấy các môn học được admin cấp quyền.
- **Cấu trúc phân cấp không giới hạn:** Môn học ➔ Phần ➔ Phần con (nhiều cấp) ➔ Quiz.
- **Làm quiz từng câu:**
  - Tô xanh đáp án đúng, tô đỏ đáp án người dùng chọn sai.
  - Hiển thị giải thích riêng cho từng phương án và giải thích chung của câu hỏi.
  - Tính điểm hoàn toàn ở Server side (chống gian lận).
  - Không leak đáp án `is_correct` hoặc `explanation` trước khi trả lời.
- **Nút hỗ trợ nổi:** Nút Facebook hỗ trợ ở góc dưới bên phải màn hình.
- **Trang Quản trị Admin:**
  - Tạo tài khoản học viên (email_confirm: true).
  - Khóa / mở khóa tài khoản (có cảnh báo khi tự khóa tài khoản hiện tại).
  - Cấp hoặc thu hồi môn học cho học viên.
  - Đếm số thiết bị đang active & Reset thiết bị.
  - Nhập nội dung môn/phần/quiz/câu hỏi bằng JSON có kiểm tra cấu trúc (Zod validation).

---

## 🛠️ Công nghệ sử dụng

- **Framework:** Next.js (App Router, TypeScript strict)
- **Styling:** Tailwind CSS + Lucide Icons
- **Database & Auth:** Supabase PostgreSQL + Row Level Security (RLS) + `@supabase/ssr` & `@supabase/supabase-js`
- **Validation:** Zod

---

## 📋 Hướng dẫn cài đặt & Chạy Local

### 1. Cài đặt Dependencies

```bash
npm install
```

### 2. Cấu hình Supabase Database

1. Tạo một dự án mới trên [Supabase](https://supabase.com).
2. Vào **SQL Editor** trên Supabase Dashboard.
3. Mở file `supabase/quiz_web_schema.sql` trong mã nguồn dự án, copy toàn bộ nội dung và dán vào SQL Editor trên Supabase, sau đó nhấn **Run**.

### 3. Tạo Tài khoản Admin đầu tiên

1. Trên Supabase Dashboard, chọn **Authentication > Users** ➔ Nút **Add user** ➔ **Create user**.
2. Nhập Email và Mật khẩu cho tài khoản Admin của bạn.
3. Sau khi tạo xong, mở **SQL Editor** và chạy câu lệnh SQL sau (thay email của bạn):

```sql
update public.profiles
set role = 'admin', status = 'active'
where email = 'email-cua-ban@example.com';
```

### 4. Cấu hình Biến Môi Trường (Environment Variables)

Tạo file `.env.local` tại thư mục gốc của dự án với nội dung:

```env
# Supabase URL & Anon Key (Lấy từ Supabase Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Service Role Key (Lấy từ Supabase Project Settings > API > service_role secret)
# CHỈ dùng ở server, KHÔNG ĐẶT NEXT_PUBLIC_
SUPABASE_SECRET_KEY=your-service-role-key

# URL Facebook Hỗ trợ
NEXT_PUBLIC_SUPPORT_URL=https://www.facebook.com/?locale=vi_VN

# Tên cookie nhận diện thiết bị
DEVICE_COOKIE_NAME=quiz_device
```

### 5. Chạy Ứng dụng ở Local

```bash
npm run dev
```

Truy cập: `http://localhost:3000`

---

## 📖 Hướng dẫn Sử dụng Admin

Đăng nhập bằng tài khoản Admin, nhấn vào nút **Admin** ở góc trên cùng bên phải giao diện Dashboard để truy cập `/admin`.

### 1. Tạo tài khoản Học viên
- Vào mục **Học viên** (`/admin/users`).
- Nhấn nút **Tạo tài khoản mới**.
- Nhập Họ tên, Email, Mật khẩu tạm. Tài khoản sẽ được tự động kích hoạt (`email_confirm: true`).

### 2. Cấp / Thu hồi Môn học
- Tại dòng của học viên tương ứng, nhấn icon **Cuốn sách** (BookOpen).
- Nhấn **Cấp quyền** cho các môn học học viên được phép học.

### 3. Khóa / Mở khóa & Reset Thiết bị
- Icon **Khóa/Mở khóa**: Đổi trạng thái tài khoản.
- Icon **Xoay (Reset)**: Xóa toàn bộ thiết bị đã lưu của học viên. Lần đăng nhập tiếp theo của học viên sẽ đăng ký thiết bị mới.

### 4. Nhập dữ liệu môn học từ JSON
- Vào mục **Nhập JSON** (`/admin/import`).
- Dán nội dung JSON (có thể nhấn **Dùng mẫu JSON** để xem định dạng mẫu).
- Nhấn **Kiểm tra định dạng** để kiểm tra lỗi Zod schema local.
- Nếu quiz đã tồn tại, tích chọn **Xóa câu cũ và nhập lại** để ghi đè.
- Nhấn **Nhập dữ liệu**.

---

## 🚢 Hướng dẫn Deploy lên Vercel

1. Push mã nguồn lên GitHub:
   ```bash
   git add .
   git commit -m "feat: complete quiz-on-tap production app"
   git push origin main
   ```
2. Truy cập [Vercel](https://vercel.com), chọn **Add New > Project**, import repository GitHub vừa push.
3. Tại phần **Environment Variables**, thêm đầy đủ 5 biến môi trường:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `NEXT_PUBLIC_SUPPORT_URL`
   - `DEVICE_COOKIE_NAME`
4. Nhấn **Deploy**.

---

## 🧪 Checklist Kiểm thử Production

- [x] User chưa đăng nhập bị tự động chuyển hướng về `/login`.
- [x] User chưa được cấp môn không nhìn thấy bất kỳ môn nào trên Dashboard.
- [x] User A không thể truy cập URL môn học `/mon/[slug]` của User B nếu chưa được cấp quyền.
- [x] Đăng nhập thiết bị 1 ➔ Thành công.
- [x] Đăng nhập thiết bị 2 ➔ Thành công.
- [x] Đăng nhập thiết bị 3 ➔ Bị chặn và hiển thị màn hình thông báo đạt giới hạn 2 thiết bị.
- [x] Admin nhấn Reset thiết bị ➔ Học viên ở trình duyệt thứ 3/mới đăng nhập lại thành công.
- [x] User bị khóa (`status = blocked`) ➔ Bị từ chối đăng nhập và trả lại lỗi tiếng Việt.
- [x] API lấy câu hỏi (`GET /api/attempts/[attemptId]/question/[position]`) tuyệt đối không lộ `is_correct` hoặc `explanation`.
- [x] Không thể gửi `option_id` của câu khác để gian lận.
- [x] Không thể trả lời lại cùng một câu hai lần trong một attempt.
- [x] Điểm số (`score`) và số câu đúng (`correct_count`) được tự động tính toán 100% ở phía Server trong Database.
- [x] Tài khoản học viên không thể truy cập đường dẫn `/admin` hoặc gọi bất kỳ API Admin nào.
- [x] Nút hỗ trợ floating mở đúng liên kết Facebook được cấu hình.
- [x] Giao diện tương thích hoàn hảo ở độ rộng 375px (Mobile-first).
