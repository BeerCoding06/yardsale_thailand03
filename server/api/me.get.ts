// server/api/me.get.ts
// ดึงข้อมูล user จาก WordPress (ใช้หลัง login เพื่อแสดงหน้า profile ให้ครบ first_name, last_name ฯลฯ)

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.user_id || query.userId || query.id;

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'user_id is required',
    });
  }

  const headers = wpUtils.getWpApiHeaders(true, false);
  if (!headers['Authorization']) {
    throw createError({
      statusCode: 500,
      message: 'WP_BASIC_AUTH is not configured',
    });
  }

  // WordPress returns more fields with context=edit (ต้องใช้ Basic Auth)
  const wpUrl = wpUtils.buildWpApiUrl(`wp/v2/users/${userId}`, { context: 'edit' });

  const response = await fetch(wpUrl, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorMessage = `WordPress API error (status ${response.status})`;
    try {
      const err = JSON.parse(errorText);
      if (err.message) errorMessage = err.message;
    } catch {
      if (errorText) errorMessage += `: ${errorText.substring(0, 200)}`;
    }
    throw createError({
      statusCode: response.status,
      message: errorMessage,
    });
  }

  const data = await response.json();
  const { password, ...rest } = data;

  // แปลงเป็นรูปแบบเดียวกับ login response (id, ID, username, email, name, first_name, last_name ฯลฯ)
  const user = {
    id: rest.id,
    ID: rest.id,
    username: rest.slug || rest.username || rest.name,
    email: rest.email || '',
    name: rest.name || rest.slug || '',
    slug: rest.slug || '',
    first_name: rest.first_name ?? rest.meta?.first_name ?? '',
    last_name: rest.last_name ?? rest.meta?.last_name ?? '',
    display_name: rest.name || '',
    avatar_url: rest.avatar_urls?.['96'],
    profile_picture_url: rest.avatar_urls?.['96'] || rest.meta?.profile_picture_url,
    profile_picture_id: rest.meta?.profile_picture_id || rest.meta?.wp_user_avatar,
    roles: rest.roles || ['subscriber'],
    ...rest.meta,
  };

  return { success: true, user };
});
