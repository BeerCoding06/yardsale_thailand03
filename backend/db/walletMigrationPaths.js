import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** ใช้ร่วมกันโดย db:wallet และ AUTO_MIGRATE_WALLET_ON_START (รวม payout/fee ใน 20260417 แล้ว) */
export const WALLET_MIGRATION_SQL_PATHS = [
  'migrations/20260417_seller_wallet_system.sql',
  'migrations/20260429_buyer_wallet_system.sql',
  'migrations/20260429_refund_requests.sql',
].map((rel) => path.join(__dirname, rel));
