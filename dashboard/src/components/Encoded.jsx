import { encNum } from '../utils/cipher';

export default function Encoded({ value, style, as = 'span' }) {
  const Tag = as;
  return <Tag style={{ fontFamily: 'monospace', letterSpacing: '0.1em', ...style }}>{encNum(value)}</Tag>;
}