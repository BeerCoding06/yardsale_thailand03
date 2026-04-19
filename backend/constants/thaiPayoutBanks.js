/**
 * รหัสธนาคารสำหรับถอนเงิน (สอดคล้องกับตัวเลือกธนาคารใน checkout ที่มีอยู่)
 */
export const THAI_PAYOUT_BANKS = [
  { code: 'BBL', label_th: 'ธนาคารกรุงเทพ', label_en: 'Bangkok Bank' },
  { code: 'KBANK', label_th: 'ธนาคารกสิกรไทย', label_en: 'Kasikornbank' },
  { code: 'SCB', label_th: 'ธนาคารไทยพาณิชย์', label_en: 'Siam Commercial Bank' },
  { code: 'KTB', label_th: 'ธนาคารกรุงไทย', label_en: 'Krungthai Bank' },
  { code: 'BAY', label_th: 'ธนาคารกรุงศรีอยุธยา', label_en: 'Krungsri' },
  { code: 'TTB', label_th: 'ทีเอ็มบีธนชาต', label_en: 'TMBThanachart' },
  { code: 'CIMBT', label_th: 'ธนาคารซีไอเอ็มบีไทย', label_en: 'CIMB Thai' },
  { code: 'UOBT', label_th: 'ธนาคารยูโอบี', label_en: 'UOB Thailand' },
  { code: 'LHBANK', label_th: 'ธนาคารแลนด์ แอนด์ เฮาส์', label_en: 'LH Bank' },
  { code: 'ICBCT', label_th: 'ธนาคารไอซีบีซี (ไทย)', label_en: 'ICBC Thailand' },
  { code: 'GSB', label_th: 'ธนาคารออมสิน', label_en: 'Government Savings Bank' },
  { code: 'BAAC', label_th: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', label_en: 'BAAC' },
  { code: 'GHB', label_th: 'ธนาคารอาคารสงเคราะห์', label_en: 'GH Bank' },
  { code: 'EXIM', label_th: 'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย', label_en: 'EXIM Thailand' },
  { code: 'IBANK', label_th: 'ธนาคารอิสลามแห่งประเทศไทย', label_en: 'Islamic Bank of Thailand' },
  { code: 'SME', label_th: 'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย', label_en: 'SME Bank' },
];

export const THAI_PAYOUT_BANK_CODES = THAI_PAYOUT_BANKS.map((b) => b.code);
