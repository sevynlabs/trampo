-- ============================================
-- ROW LEVEL SECURITY (RLS) - CORE TABLES
-- ============================================
-- This migration enables RLS on all user-facing tables.
-- Admin tables (admin_users, campaigns, etc) are NOT included
-- as they should only be accessed via service role key.
--
-- IMPORTANT: These policies work with Supabase Auth (auth.uid()).
-- The application backend uses service role key which bypasses RLS.
-- This provides defense-in-depth in case of service key compromise.
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only view their own profile
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users cannot delete themselves (admin only)
-- No DELETE policy = denied by default

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- TASKER PROFILES TABLE
-- ============================================
ALTER TABLE tasker_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own tasker profile
CREATE POLICY "tasker_profiles_select_own"
  ON tasker_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Public can view approved tasker profiles (for ratings display)
CREATE POLICY "tasker_profiles_select_approved"
  ON tasker_profiles FOR SELECT
  USING (kyc_status = 'APPROVED');

-- Users can update their own tasker profile
CREATE POLICY "tasker_profiles_update_own"
  ON tasker_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can create their own tasker profile
CREATE POLICY "tasker_profiles_insert_own"
  ON tasker_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- CATEGORIES TABLE
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view active categories
CREATE POLICY "categories_select_active"
  ON categories FOR SELECT
  USING (is_active = true);

-- ============================================
-- TASKER PROFILE CATEGORIES (Junction Table)
-- ============================================
ALTER TABLE tasker_profile_categories ENABLE ROW LEVEL SECURITY;

-- Users can view their own category assignments
CREATE POLICY "tasker_profile_categories_select_own"
  ON tasker_profile_categories FOR SELECT
  USING (
    tasker_profile_id IN (
      SELECT id FROM tasker_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can manage their own category assignments
CREATE POLICY "tasker_profile_categories_insert_own"
  ON tasker_profile_categories FOR INSERT
  WITH CHECK (
    tasker_profile_id IN (
      SELECT id FROM tasker_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tasker_profile_categories_delete_own"
  ON tasker_profile_categories FOR DELETE
  USING (
    tasker_profile_id IN (
      SELECT id FROM tasker_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TASKS TABLE
-- ============================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Clients can view their own tasks
CREATE POLICY "tasks_select_client"
  ON tasks FOR SELECT
  USING (client_id = auth.uid());

-- Assigned taskers can view their assigned tasks
CREATE POLICY "tasks_select_assigned_tasker"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments
      WHERE task_id = tasks.id AND tasker_id = auth.uid()
    )
  );

-- Approved taskers can view OPEN tasks (for the feed)
CREATE POLICY "tasks_select_open_for_taskers"
  ON tasks FOR SELECT
  USING (
    status = 'OPEN'
    AND EXISTS (
      SELECT 1 FROM tasker_profiles
      WHERE user_id = auth.uid() AND kyc_status = 'APPROVED'
    )
  );

-- Clients can create tasks
CREATE POLICY "tasks_insert_client"
  ON tasks FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Clients can update their own OPEN tasks (before acceptance)
CREATE POLICY "tasks_update_client_open"
  ON tasks FOR UPDATE
  USING (client_id = auth.uid() AND status = 'OPEN')
  WITH CHECK (client_id = auth.uid());

-- ============================================
-- TASK ASSIGNMENTS TABLE
-- ============================================
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Clients and assigned taskers can view assignments
CREATE POLICY "task_assignments_select_involved"
  ON task_assignments FOR SELECT
  USING (
    tasker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks WHERE id = task_id AND client_id = auth.uid()
    )
  );

-- Approved taskers can create assignments (accept tasks)
CREATE POLICY "task_assignments_insert_tasker"
  ON task_assignments FOR INSERT
  WITH CHECK (
    tasker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasker_profiles
      WHERE user_id = auth.uid() AND kyc_status = 'APPROVED'
    )
  );

-- ============================================
-- MESSAGES TABLE
-- ============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from tasks they're involved in
CREATE POLICY "messages_select_involved"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.id = messages.task_id
        AND (t.client_id = auth.uid() OR ta.tasker_id = auth.uid())
    )
  );

-- Users can send messages to tasks they're involved in
CREATE POLICY "messages_insert_involved"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.id = messages.task_id
        AND (t.client_id = auth.uid() OR ta.tasker_id = auth.uid())
    )
  );

-- ============================================
-- REVIEWS TABLE
-- ============================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can view reviews they gave or received
CREATE POLICY "reviews_select_involved"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());

-- Public can view all reviews (for tasker profiles)
CREATE POLICY "reviews_select_public"
  ON reviews FOR SELECT
  USING (true);

-- Users can create reviews for tasks they participated in
CREATE POLICY "reviews_insert_participant"
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.id = reviews.task_id
        AND t.status IN ('COMPLETED', 'RELEASED')
        AND (t.client_id = auth.uid() OR ta.tasker_id = auth.uid())
    )
  );

-- ============================================
-- PAYMENTS TABLE
-- ============================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Clients can view their own payments
CREATE POLICY "payments_select_client"
  ON payments FOR SELECT
  USING (user_id = auth.uid());

-- Taskers can view payments for their assigned tasks
CREATE POLICY "payments_select_tasker"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE t.id = payments.task_id AND ta.tasker_id = auth.uid()
    )
  );

-- ============================================
-- WITHDRAWALS TABLE
-- ============================================
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Taskers can view their own withdrawals
CREATE POLICY "withdrawals_select_own"
  ON withdrawals FOR SELECT
  USING (
    tasker_profile_id IN (
      SELECT id FROM tasker_profiles WHERE user_id = auth.uid()
    )
  );

-- Taskers can create withdrawal requests
CREATE POLICY "withdrawals_insert_own"
  ON withdrawals FOR INSERT
  WITH CHECK (
    tasker_profile_id IN (
      SELECT id FROM tasker_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- DISPUTES TABLE
-- ============================================
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Clients and taskers involved can view disputes
CREATE POLICY "disputes_select_involved"
  ON disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.id = disputes.task_id
        AND (t.client_id = auth.uid() OR ta.tasker_id = auth.uid())
    )
  );

-- Clients and taskers can open disputes
CREATE POLICY "disputes_insert_involved"
  ON disputes FOR INSERT
  WITH CHECK (
    opened_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.id = disputes.task_id
        AND (t.client_id = auth.uid() OR ta.tasker_id = auth.uid())
    )
  );

-- ============================================
-- CANCELLATIONS TABLE
-- ============================================
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;

-- Clients and taskers can view cancellations for their tasks
CREATE POLICY "cancellations_select_involved"
  ON cancellations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      LEFT JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.id = cancellations.task_id
        AND (t.client_id = auth.uid() OR ta.tasker_id = auth.uid())
    )
  );

-- ============================================
-- SERVICE AREAS TABLE
-- ============================================
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

-- Everyone can view active service areas
CREATE POLICY "service_areas_select_active"
  ON service_areas FOR SELECT
  USING (is_active = true);

-- ============================================
-- ADMIN TABLES - SERVICE ROLE ONLY
-- ============================================
-- These tables should ONLY be accessed via service role key (backend).
-- Enable RLS but create NO policies = deny all access via anon/authenticated.

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_decisions ENABLE ROW LEVEL SECURITY;

-- No policies = no access. Backend uses service role which bypasses RLS.
