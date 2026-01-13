export type Money = string | number;

export interface VariationNode {
  databaseId: number;
  salePrice: Money;
  regularPrice: Money;
  stockQuantity?: number;
  stockStatus?: string;
  image?: { sourceUrl: string };
}

export interface Variation {
  node: VariationNode;
  attributes: Array<{ value: string }>;
}

export interface ProductNode {
  sku: string;
  slug: string;
  name: string;
  databaseId?: number;
  salePrice?: Money;
  regularPrice?: Money;
  stockQuantity?: number;
  stockStatus?: string;
  image?: { sourceUrl: string };
}

export interface CartItem {
  key: string;
  quantity: number;
  product: { node: ProductNode };
  variation?: Variation;
}

export interface AddToCartResponse {
  addToCart: { cartItem: CartItem };
}

export type AddBtnStatus = 'add' | 'loading' | 'added';

export type RemoveBtnStatus = 'remove' | 'loading';
