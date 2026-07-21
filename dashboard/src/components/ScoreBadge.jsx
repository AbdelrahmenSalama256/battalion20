import { encNum } from '../utils/cipher';

export default function ScoreBadge({score,size}){
  if(score==null)return null;
  const v=Number(score);
  const c=v>=90?'#1B8A2E':v>=75?'#2D6A4F':v>=65?'#C9A84C':v>=50?'#E9C46A':'#E63946';
  const l=v>=90?'ممتاز':v>=75?'جيد جداً':v>=65?'جيد':v>=50?'مقبول':'راسب';
  return<span className="score-badge" style={{background:`${c}30`,color:c,border:`1px solid ${c}80`,fontSize:size||11}}>{l} {encNum(v)}</span>;
}