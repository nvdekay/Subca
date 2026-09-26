-- ============================================================================
-- Subca: Row Level Security + liên kết Supabase Auth
-- ============================================================================
-- 1) Bật RLS cho MỌI bảng trong schema public, KHÔNG tạo policy nào.
--    → Client dùng anon key / authenticated key của Supabase không đọc/ghi thẳng được.
--    → Mọi truy cập đi qua NestJS (kết nối bằng user postgres, là chủ bảng nên không bị RLS chặn).
--    Khi thêm bảng mới ở migration sau, PHẢI bật RLS cho bảng đó (có bước kiểm tra trong CI).
--
-- 2) Trigger trên auth.users: tạo profile + cài đặt mặc định khi người dùng đăng ký,
--    xóa profile (cascade toàn bộ dữ liệu) khi tài khoản auth bị xóa.
--    Chỉ chạy khi có schema "auth" (Supabase) để `prisma migrate dev` vẫn chạy được
--    trên shadow database Postgres thường.
-- ============================================================================

-- 1) RLS
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;

-- Thu hồi quyền mặc định Supabase cấp cho vai trò client (lớp bảo vệ thứ hai ngoài RLS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
  END IF;
END
$$;

-- 2) Trigger liên kết auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, updated_at)
  VALUES (NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Quy tắc nhắc mặc định: gói năm 30 ngày trước, 7 ngày và 1 ngày trước, trial 1 ngày trước
  INSERT INTO public.reminder_rules (id, user_id, kind, offset_days, min_interval)
  VALUES
    (gen_random_uuid(), NEW.id, 'RENEWAL', 30, 'YEAR'),
    (gen_random_uuid(), NEW.id, 'RENEWAL', 7, NULL),
    (gen_random_uuid(), NEW.id, 'RENEWAL', 1, NULL),
    (gen_random_uuid(), NEW.id, 'TRIAL_END', 1, NULL)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_deleted_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users';
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
             FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user()';
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users';
    EXECUTE 'CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users
             FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_auth_user()';
  END IF;
END
$$;

-- Hàm trigger không được gọi trực tiếp từ client
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_deleted_auth_user() FROM PUBLIC;
