-- Support chat: user/seller ↔ admin
DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('open', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_sender_type AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status conversation_status NOT NULL DEFAULT 'open',
  order_id UUID REFERENCES orders (id) ON DELETE SET NULL,
  admin_last_seen_at TIMESTAMPTZ,
  user_last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_support_one_open_per_user
  ON support_conversations (user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_support_conv_user ON support_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conv_status ON support_conversations (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations (id) ON DELETE CASCADE,
  sender_type chat_sender_type NOT NULL,
  sender_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (char_length(message) >= 1 AND char_length(message) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_msg_conv ON support_messages (conversation_id, created_at ASC);
