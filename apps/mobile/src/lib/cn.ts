import { twMerge } from 'tailwind-merge';

/** Ghép class Tailwind; class truyền sau ghi đè class mặc định cùng nhóm (VD cỡ chữ, màu). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
