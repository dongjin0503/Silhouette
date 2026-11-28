import MyPage from '../home/mypage/mypage';

/* =========================================================
   실루엣 프리미엄 티켓 스토어 (/ticket)
   - 마이페이지(/mypage)와 동일한 LNB 및 레이아웃을 공유하며
   - '이용권 구매' 뷰를 기본으로 표시합니다.
   ========================================================= */
export default function Ticket() {
  return <MyPage initialView="ticket" />;
}
