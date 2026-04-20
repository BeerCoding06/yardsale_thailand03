import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** ลำดับสำคัญ — ใช้ร่วมกันโดย db:wallet และ AUTO_MIGRATE_WALLET_ON_START */
export const WALLET_MIGRATION_SQL_PATHS = [
  'migrations/20260417_seller_wallet_system.sql',
  'migrations/20260418_withdrawals_payout_bank.sql',
  'migrations/20260419_withdrawals_fee.sql',
].map((rel) => path.join(__dirname, rel));
