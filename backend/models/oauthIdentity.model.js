/** Linked OAuth providers per user (Google / Facebook / LINE) */

export async function findUserIdByProviderSubject(client, provider, providerUserId) {
  const r = await client.query(
    `SELECT user_id FROM user_oauth_identities
     WHERE provider = $1 AND provider_user_id = $2`,
    [provider, String(providerUserId)]
  );
  return r.rows[0]?.user_id ?? null;
}

export async function upsertIdentity(client, userId, provider, providerUserId) {
  const sub = String(providerUserId);
  const updated = await client.query(
    `UPDATE user_oauth_identities
       SET provider_user_id = $3
     WHERE user_id = $1::uuid AND provider = $2
     RETURNING 1`,
    [userId, provider, sub]
  );
  if (updated.rowCount > 0) return;
  await client.query(
    `INSERT INTO user_oauth_identities (user_id, provider, provider_user_id)
     SELECT $1::uuid, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM user_oauth_identities
       WHERE user_id = $1::uuid AND provider = $2
     )`,
    [userId, provider, sub]
  );
}

export async function hasIdentityForUserProvider(client, userId, provider) {
  const r = await client.query(
    `SELECT 1 FROM user_oauth_identities WHERE user_id = $1::uuid AND provider = $2 LIMIT 1`,
    [userId, provider]
  );
  return r.rowCount > 0;
}
