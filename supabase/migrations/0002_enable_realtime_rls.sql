-- Enable Realtime broadcasts to anon key while blocking writes
-- Anon key can SELECT (for Realtime postgres_changes) but cannot INSERT/UPDATE/DELETE

-- Drop old deny-all policies
DROP POLICY IF EXISTS "Deny public: messages" ON messages;
DROP POLICY IF EXISTS "Deny public: escalations" ON escalations;
DROP POLICY IF EXISTS "Deny public: conversations" ON conversations;
DROP POLICY IF EXISTS "Deny public: knowledge_sources" ON knowledge_sources;

-- Messages: allow SELECT for Realtime, deny writes
CREATE POLICY "Realtime: messages SELECT" ON messages FOR SELECT USING (true);
CREATE POLICY "Deny: messages INSERT" ON messages FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny: messages UPDATE" ON messages FOR UPDATE USING (false);
CREATE POLICY "Deny: messages DELETE" ON messages FOR DELETE USING (false);

-- Conversations: allow SELECT for Realtime, deny writes
CREATE POLICY "Realtime: conversations SELECT" ON conversations FOR SELECT USING (true);
CREATE POLICY "Deny: conversations INSERT" ON conversations FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny: conversations UPDATE" ON conversations FOR UPDATE USING (false);
CREATE POLICY "Deny: conversations DELETE" ON conversations FOR DELETE USING (false);

-- Escalations: allow SELECT for Realtime, deny writes
CREATE POLICY "Realtime: escalations SELECT" ON escalations FOR SELECT USING (true);
CREATE POLICY "Deny: escalations INSERT" ON escalations FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny: escalations UPDATE" ON escalations FOR UPDATE USING (false);
CREATE POLICY "Deny: escalations DELETE" ON escalations FOR DELETE USING (false);

-- Knowledge_sources: allow SELECT for retrieval, deny writes
CREATE POLICY "Public: knowledge_sources SELECT" ON knowledge_sources FOR SELECT USING (true);
CREATE POLICY "Deny: knowledge_sources INSERT" ON knowledge_sources FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny: knowledge_sources UPDATE" ON knowledge_sources FOR UPDATE USING (false);
CREATE POLICY "Deny: knowledge_sources DELETE" ON knowledge_sources FOR DELETE USING (false);
