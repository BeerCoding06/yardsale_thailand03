import { AppError } from './AppError.js';

/** สร้างสินค้า: รองรับ legacy เฉพาะ `price` หรือคู่ regular + optional sale */
export function normalizeProductPricesForCreate(body) {
  const regRaw =
    body.regular_price != null && body.regular_price !== ''
      ? Number(body.regular_price)
      : NaN;
  const priceOnly =
    body.price != null && body.price !== '' ? Number(body.price) : NaN;
  const reg = Number.isFinite(regRaw) ? regRaw : priceOnly;

  let saleNum = NaN;
  if (
    body.sale_price !== '' &&
    body.sale_price != null &&
    body.sale_price !== undefined
  ) {
    saleNum = Number(body.sale_price);
  }

  const hasSale =
    Number.isFinite(saleNum) &&
    saleNum > 0 &&
    Number.isFinite(reg) &&
    saleNum < reg;

  if (!Number.isFinite(reg) || reg <= 0) {
    throw new AppError(
      'regular_price or price must be a positive number',
      400,
      'VALIDATION_ERROR'
    );
  }

  return {
    price: hasSale ? saleNum : reg,
    regular_price: reg,
    sale_price: hasSale ? saleNum : null,
  };
}

/**
 * แก้ไข: ถ้ามีแค่ `price` (ไม่มี regular/sale) → ตีความเป็นราคาเต็ม ไม่ลด
 * ถ้ามี regular หรือ sale (รวม sale_price: null เพื่อล้างโปร) → คำนวณชุดราคาใหม่
 */
export function mergeProductPricesForUpdate(body, current) {
  const curReg = Number(current.regular_price ?? current.price);
  const curSale =
    current.sale_price != null && String(current.sale_price).trim() !== ''
      ? Number(current.sale_price)
      : NaN;

  const touchedSale = Object.prototype.hasOwnProperty.call(body, 'sale_price');
  const touchedReg =
    body.regular_price !== undefined &&
    body.regular_price !== '' &&
    body.regular_price !== null;

  const legacyPriceOnly =
    body.price !== undefined && !touchedReg && !touchedSale;

  if (legacyPriceOnly) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p <= 0) {
      throw new AppError('Invalid price', 400, 'VALIDATION_ERROR');
    }
    return { price: p, regular_price: p, sale_price: null };
  }

  const reg = touchedReg ? Number(body.regular_price) : curReg;
  if (!Number.isFinite(reg) || reg <= 0) {
    throw new AppError('Invalid regular_price', 400, 'VALIDATION_ERROR');
  }

  let sale = null;
  if (touchedSale) {
    const s = body.sale_price;
    if (s === null || s === '' || s === undefined) {
      sale = null;
    } else {
      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0) {
        throw new AppError('Invalid sale_price', 400, 'VALIDATION_ERROR');
      }
      if (n >= reg) {
        throw new AppError(
          'sale_price must be less than regular_price',
          400,
          'VALIDATION_ERROR'
        );
      }
      sale = n;
    }
  } else if (Number.isFinite(curSale) && curSale > 0 && curSale < reg) {
    sale = curSale;
  }

  const price = sale != null ? sale : reg;
  return { price, regular_price: reg, sale_price: sale };
}
