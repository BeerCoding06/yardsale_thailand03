/**
 * Support chat — raw SQL (support_conversations / support_messages)
 */

export async function findOpenConversation(client, userId) {
  const r = await client.query(
    `SELECT * FROM support_conversations
     WHERE user_id = $1::uuid AND status = 'open'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

export async function getConversationById(client, id) {
  const r = await client.query(`SELECT * FROM support_conversations WHERE id = $1::uuid`, [id]);
  return r.rows[0] ?? null;
}

export async function createConversation(client, { userId, orderId }) {
  const r = await client.query(
    `INSERT INTO support_conversations (user_id, order_id)
     VALUES ($1::uuid, $2::uuid)
     RETURNING *`,
    [userId, orderId ?? null]
  );
  return r.rows[0];
}

/** order_id ต้องเป็นของ user นี้ — กัน FK / แอบแนบ order คนอื่น */
export async function orderBelongsToUser(client, orderId, userId) {
  const r = await client.query(
    `SELECT 1 FROM orders WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [orderId, userId]
  );
  return r.rows.length > 0;
}

export async function listConversationsForAdmin(client, { limit, offset }) {
  const r = await client.query(
    `SELECT
       c.*,
       u.email AS user_email,
       u.name AS user_name,
       (SELECT sm.message FROM support_messages sm
        WHERE sm.conversation_id = c.id
        ORDER BY sm.created_at DESC LIMIT 1) AS last_message_preview,
       (SELECT sm.created_at FROM support_messages sm
        WHERE sm.conversation_id = c.id
        ORDER BY sm.created_at DESC LIMIT 1) AS last_message_at,
       (SELECT COUNT(*)::int FROM support_messages m
        WHERE m.conversation_id = c.id
          AND m.sender_type = 'user'
          AND m.created_at > COALESCE(c.admin_last_seen_at, '-infinity'::timestamptz)) AS unread_for_admin
     FROM support_conversations c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.updated_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows;
}

export async function countConversations(client) {
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM support_conversations`);
  return r.rows[0]?.c ?? 0;
}

export async function listMessages(client, conversationId, { limit, offset }) {
  const r = await client.query(
    `SELECT m.*, u.email AS sender_email, u.name AS sender_name
     FROM support_messages m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE m.conversation_id = $1::uuid
     ORDER BY m.created_at ASC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );
  return r.rows;
}

export async function countMessages(client, conversationId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM support_messages WHERE conversation_id = $1::uuid`,
    [conversationId]
  );
  return r.rows[0]?.c ?? 0;
}

export async function insertMessage(client, { conversationId, senderType, senderUserId, text }) {
  const r = await client.query(
    `INSERT INTO support_messages (conversation_id, sender_type, sender_user_id, message)
     VALUES ($1::uuid, $2::chat_sender_type, $3::uuid, $4)
     RETURNING *`,
    [conversationId, senderType, senderUserId ?? null, text]
  );
  return r.rows[0];
}

export async function touchConversation(client, conversationId) {
  await client.query(
    `UPDATE support_conversations SET updated_at = now() WHERE id = $1::uuid`,
    [conversationId]
  );
}

export async function setAdminSeen(client, conversationId) {
  await client.query(
    `UPDATE support_conversations SET admin_last_seen_at = now(), updated_at = now() WHERE id = $1::uuid`,
    [conversationId]
  );
}

export async function setUserSeen(client, conversationId) {
  await client.query(
    `UPDATE support_conversations SET user_last_seen_at = now() WHERE id = $1::uuid`,
    [conversationId]
  );
}

export async function resolveConversation(client, conversationId) {
  const r = await client.query(
    `UPDATE support_conversations
     SET status = 'resolved', updated_at = now()
     WHERE id = $1::uuid AND status = 'open'
     RETURNING *`,
    [conversationId]
  );
  return r.rows[0] ?? null;
}

export async function countUnreadForUser(client, userId) {
  const r = await client.query(
    `SELECT COALESCE(SUM(sub.unread), 0)::int AS n
     FROM (
       SELECT
         (SELECT COUNT(*)::int FROM support_messages m
          WHERE m.conversation_id = c.id
            AND m.sender_type = 'admin'
            AND m.created_at > COALESCE(c.user_last_seen_at, '-infinity'::timestamptz)) AS unread
       FROM support_conversations c
       WHERE c.user_id = $1::uuid AND c.status = 'open'
     ) sub`,
    [userId]
  );
  return r.rows[0]?.n ?? 0;
}

export async function countUnreadForAdmin(client) {
  const r = await client.query(
    `SELECT COALESCE(SUM(x.cnt), 0)::int AS n
     FROM (
       SELECT
         (SELECT COUNT(*)::int FROM support_messages m
          WHERE m.conversation_id = c.id
            AND m.sender_type = 'user'
            AND m.created_at > COALESCE(c.admin_last_seen_at, '-infinity'::timestamptz)) AS cnt
       FROM support_conversations c
       WHERE c.status = 'open'
     ) x`
  );
  return r.rows[0]?.n ?? 0;
}
