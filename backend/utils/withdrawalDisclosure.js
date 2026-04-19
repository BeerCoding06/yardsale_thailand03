import { WITHDRAWAL_FEE_PERCENT, WITHDRAWAL_FEE_RATE } from '../constants/withdrawalFees.js';

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Number(x.toFixed(2));
}

export function computeWithdrawalFeeBreakdown(grossAmount) {
  const gross_amount = money(grossAmount);
  const fee_amount = money(gross_amount * WITHDRAWAL_FEE_RATE);
  const net_payout_amount = money(gross_amount - fee_amount);
  return {
    gross_amount,
    fee_percent: WITHDRAWAL_FEE_PERCENT,
    fee_rate: WITHDRAWAL_FEE_RATE,
    fee_amount,
    net_payout_amount,
  };
}

/** ข้อความอธิบายแบบมีตัวเลข (หลังคำนวณแล้ว) */
export function buildWithdrawalNoticesTh(b) {
  const p = b.fee_percent;
  return [
    `ยอดที่ระบบหักจาก “ยอดถอนได้” ของคุณคือ ${money(b.gross_amount).toFixed(2)} บาท ซึ่งเป็นยอดรวมก่อนหักค่าธรรมเนียม (ยอดที่คุณกรอกในคำขอถอน)`,
    `ค่าธรรมเนียมการถอน ${p}% ของยอดดังกล่าว = ${money(b.fee_amount).toFixed(2)} บาท จะถูกหักโดยอัตโนมัติ`,
    `ยอดเงินที่โอนเข้าบัญชีธนาคารที่คุณระบุ (หลังหักค่าธรรมเนียมแล้ว) = ${money(b.net_payout_amount).toFixed(2)} บาท`,
    'ระยะเวลาโดยประมาณ: ภายใน 3 วันทำการ หลังแอดมินอนุมัติและดำเนินการโอน (ไม่นับวันหยุดราชการและวันหยุดธนาคาร)',
    'กรุณาตรวจสอบธนาคาร ชื่อบัญชี และเลขบัญชีให้ถูกต้อง หากข้อมูลผิดทำให้โอนไม่สำเร็จ อาจต้องใช้เวลาแก้ไขหรือดำเนินการคืนเงินตามเงื่อนไขของแพลตฟอร์ม',
    'หากคำขอถอนถูกปฏิเสธ ยอดเต็มตามยอดที่หักไปแล้วจะถูกคืนเข้า “ยอดถอนได้” ของคุณ',
    'ค่าธรรมเนียมเป็นค่าบริการของแพลตฟอร์มสำหรับการดำเนินการโอนและบริหารความเสี่ยงทางการเงิน',
  ];
}

export function buildWithdrawalNoticesEn(b) {
  const p = b.fee_percent;
  return [
    `The amount deducted from your withdrawable balance is ${money(b.gross_amount).toFixed(2)} THB (gross withdrawal — the amount you entered).`,
    `A ${p}% withdrawal fee applies: ${money(b.fee_amount).toFixed(2)} THB is withheld automatically.`,
    `The net amount transferred to your bank account will be ${money(b.net_payout_amount).toFixed(2)} THB (after the fee).`,
    'Estimated payout: within 3 business days after an admin approves and processes the transfer (excluding public holidays and bank closures).',
    'Please double-check bank, account name, and account number. Incorrect details may delay payout or require a refund per platform rules.',
    'If your withdrawal request is rejected, the full gross amount that was deducted will be returned to your withdrawable balance.',
    'The fee covers platform processing, transfer operations, and financial risk management.',
  ];
}

/** ข้อความทั่วไป (ไม่ผูกยอด) — ใช้บน GET /wallet */
export function buildWithdrawalPolicyNoticesTh() {
  return [
    `ทุกครั้งที่ขอถอนเงิน ระบบจะหักค่าธรรมเนียม ${WITHDRAWAL_FEE_PERCENT}% จากยอดที่คุณขอถอน (ยอดรวมก่อนหักค่าธรรมเนียม)`,
    'ยอดเงินที่โอนเข้าบัญชีธนาคารของคุณ = ยอดที่ขอถอน − ค่าธรรมเนียม (ยอดสุทธิ)',
    'ยอดที่หักจาก “ยอดถอนได้” ของคุณคือยอดที่คุณกรอกในฟอร์มถอน (ก่อนหักค่าธรรมเนียม) ทั้งจำนวน',
    'โดยประมาณ 3 วันทำการ หลังแอดมินอนุมัติและโอน (ไม่นับวันหยุด)',
    'ตรวจสอบข้อมูลบัญชีให้ครบถ้วน หากถูกปฏิเสธ ยอดเต็มจะถูกคืนเข้ายอดถอนได้',
  ];
}

export function buildWithdrawalPolicyNoticesEn() {
  return [
    `Each withdrawal request is subject to a ${WITHDRAWAL_FEE_PERCENT}% fee calculated on the gross amount you request.`,
    'The bank transfer will be the net amount: gross requested amount minus the fee.',
    'Your withdrawable balance is reduced by the full gross amount you submit in the withdrawal form.',
    'Payout is typically within 3 business days after admin approval and transfer (excluding holidays).',
    'Verify bank details carefully. If a request is rejected, the full gross deduction is refunded to your withdrawable balance.',
  ];
}
