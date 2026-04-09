/**
 * Audit log for shipment tracking lookups (17TRACK).
 */
export async function insertTrackingLog(client, { trackingNumber, carrier, status, rawResponse }) {
  await client.query(
    `INSERT INTO tracking_logs (tracking_number, carrier, status, raw_response)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      trackingNumber,
      carrier ?? null,
      status ?? null,
      JSON.stringify(rawResponse ?? {}),
    ]
  );
}
