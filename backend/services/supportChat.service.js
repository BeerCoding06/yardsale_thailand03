import { pool, withTransaction } from '../models/db.js';
import { AppError } from '../utils/AppError.js';
import * as chatModel from '../models/supportChat.model.js';

function mapMessageRow(row) {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_type: row.sender_type,
    sender_user_id: row.sender_user_id,
    message: row.message,
    created_at: row.created_at,
    sender_email: row.sender_email,
    sender_name: row.sender_name,
  };
}

function mapConversationRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    order_id: row.order_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_email: row.user_email,
    user_name: row.user_name,
    last_message_preview: row.last_message_preview,
    last_message_at: row.last_message_at,
    unread_for_admin: row.unread_for_admin,
  };
}

/**
 * เปิดการสนทนา: ถ้ามีเคส open อยู่แล้วคืนเคสเดิม — ไม่สร้างซ้ำ (partial unique index)
 */
export async function startConversation(userId, { order_id }) {
  return withTransaction(async (client) => {
    const existing = await chatModel.findOpenConversation(client, userId);
    if (existing) {
      return { conversation: existing, created: false };
    }
    const conv = await chatModel.createConversation(client, {
      userId,
      orderId: order_id ?? null,
    });
    return { conversation: conv, created: true };
  });
}

export async function listAdminConversations(query) {
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const client = await pool.connect();
  try {
    const rows = await chatModel.listConversationsForAdmin(client, { limit, offset });
    const total = await chatModel.countConversations(client);
    const unread_total = await chatModel.countUnreadForAdmin(client);
    return {
      conversations: rows.map(mapConversationRow),
      total,
      unread_total,
      limit,
      offset,
    };
  } finally {
    client.release();
  }
}

export async function getMessages(userRole, userId, conversationId, query) {
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const client = await pool.connect();
  try {
    const conv = await chatModel.getConversationById(client, conversationId);
    if (!conv) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }
    const isOwner = String(conv.user_id) === String(userId);
    const isAdmin = userRole === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const rows = await chatModel.listMessages(client, conversationId, { limit, offset });
    const total = await chatModel.countMessages(client, conversationId);

    if (isAdmin) {
      await chatModel.setAdminSeen(client, conversationId);
    } else {
      await chatModel.setUserSeen(client, conversationId);
    }

    return {
      conversation: conv,
      messages: rows.map(mapMessageRow),
      total,
      limit,
      offset,
    };
  } finally {
    client.release();
  }
}

export async function sendMessage(userRole, userId, conversationId, text) {
  return withTransaction(async (client) => {
    const conv = await chatModel.getConversationById(client, conversationId);
    if (!conv) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }
    if (conv.status !== 'open') {
      throw new AppError('Conversation is resolved — start a new chat', 400, 'CONV_CLOSED');
    }

    const isOwner = String(conv.user_id) === String(userId);
    const isAdmin = userRole === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    const senderType = isAdmin ? 'admin' : 'user';
    const msg = await chatModel.insertMessage(client, {
      conversationId,
      senderType,
      senderUserId: userId,
      text,
    });
    await chatModel.touchConversation(client, conversationId);

    if (isAdmin) {
      await chatModel.setAdminSeen(client, conversationId);
    } else {
      await chatModel.setUserSeen(client, conversationId);
    }

    return {
      message: {
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_type: msg.sender_type,
        sender_user_id: msg.sender_user_id,
        message: msg.message,
        created_at: msg.created_at,
      },
    };
  });
}

export async function resolveConversation(conversationId) {
  return withTransaction(async (client) => {
    const conv = await chatModel.getConversationById(client, conversationId);
    if (!conv) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }
    const updated = await chatModel.resolveConversation(client, conversationId);
    if (!updated) {
      throw new AppError('Already resolved', 400, 'ALREADY_RESOLVED');
    }
    return { conversation: updated };
  });
}

export async function getUnreadCountForUser(userId) {
  const client = await pool.connect();
  try {
    const n = await chatModel.countUnreadForUser(client, userId);
    return { unread_count: n };
  } finally {
    client.release();
  }
}
