import { useEffect, useState } from 'react';
import Client from '../../api/client';
import styles from './ticket.module.css';
import * as PortOne from '@portone/browser-sdk/v2';

// 이용권 수량별 비주얼 일러스트 이미지
const getTicketImage = (ticketCount) => {
  if (ticketCount <= 3) return '/assets/tickets/ticket_single.svg';
  if (ticketCount <= 12) return '/assets/tickets/ticket_bundle.svg';
  if (ticketCount <= 40) return '/assets/tickets/ticket_premium.svg';
  return '/assets/tickets/ticket_vip.svg';
};

export default function TicketStore({ member: propMember, wallet: propWallet, onWalletUpdate }) {
  // 회원 정보 (props 또는 fallback 조회)
  const [member, setMember] = useState(propMember || null);

  // 현재 보유 자산 (이용권 & 마일리지)
  const [myTicketCount, setMyTicketCount] = useState(propWallet?.ticketBalance ?? 0);
  const [myMileage, setMyMileage] = useState(propWallet?.mileageBalance ?? 0);
  const [ticketProducts, setTicketProducts] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [loading, setLoading] = useState(true);

  // 마일리지 사용
  const [usedMileage, setUsedMileage] = useState(0);
  const [mileageInput, setMileageInput] = useState('');

  // 결제 진행 / 완료 상태
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 필수 약관 동의 상태
  const [agreeAll, setAgreeAll] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [agreeConfirm, setAgreeConfirm] = useState(true);

  // props 변경 시 동기화
  useEffect(() => {
    if (propMember) setMember(propMember);
  }, [propMember]);

  useEffect(() => {
    if (propWallet) {
      setMyTicketCount(propWallet.ticketBalance ?? 0);
      setMyMileage(propWallet.mileageBalance ?? 0);
    }
  }, [propWallet]);

  // 상품 목록 및 지갑 정보 로드
  useEffect(() => {
    const promises = [
      Client.get('/api/ticket/products')
    ];
    if (!propWallet) {
      promises.push(Client.get('/api/ticket/wallet'));
    }
    if (!propMember) {
      promises.push(Client.get('/api/mypage/me'));
    }

    Promise.all(promises)
      .then(([productRes, walletRes, memberRes]) => {
        setTicketProducts(productRes.data);
        if (productRes.data.length > 0) {
          setSelectedTicketId(productRes.data[0].ticketProductSeq);
        }
        if (walletRes?.data) {
          setMyTicketCount(walletRes.data.ticketBalance);
          setMyMileage(walletRes.data.mileageBalance);
        }
        if (memberRes?.data) {
          setMember(memberRes.data);
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [propMember, propWallet]);

  // DB 상품 선택 및 결제 금액 계산
  const selectedProduct = ticketProducts.find(
    (p) => p.ticketProductSeq === selectedTicketId
  ) || null;
  const orderPrice = selectedProduct?.price || 0;
  const finalPrice = Math.max(0, orderPrice - usedMileage);
  const expectedRewardPoint = Math.floor(finalPrice * 0.01);

  // 마일리지 직접 입력
  const handleMileageChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(raw) || 0;
    if (num > myMileage) {
      setUsedMileage(myMileage);
      setMileageInput(String(myMileage));
    } else if (num > orderPrice) {
      setUsedMileage(orderPrice);
      setMileageInput(String(orderPrice));
    } else {
      setUsedMileage(num);
      setMileageInput(raw);
    }
  };

  // 마일리지 전액 사용
  const handleUseAllMileage = () => {
    const maxVal = Math.min(myMileage, orderPrice);
    setUsedMileage(maxVal);
    setMileageInput(String(maxVal));
  };

  // 마일리지 적용 되돌리기 (0원으로 초기화)
  const handleResetMileage = () => {
    setUsedMileage(0);
    setMileageInput('');
  };

  // 약관 전체 토글
  const handleToggleAllAgreements = () => {
    const next = !agreeAll;
    setAgreeAll(next);
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeConfirm(next);
  };

  // 개별 약관 토글
  const handleToggleAgreement = (type) => {
    let t = agreeTerms, p = agreePrivacy, c = agreeConfirm;
    if (type === 'terms') t = !t;
    if (type === 'privacy') p = !p;
    if (type === 'confirm') c = !c;
    setAgreeTerms(t);
    setAgreePrivacy(p);
    setAgreeConfirm(c);
    setAgreeAll(t && p && c);
  };

  // [결제하기] 클릭 -> 주문 생성 -> PortOne 결제창 -> 서버 검증
  const handlePayment = async () => {
    if (!selectedProduct) {
      alert('구매할 이용권을 선택해 주세요.');
      return;
    }
    if (!agreeTerms || !agreePrivacy || !agreeConfirm) {
      alert('주문 진행을 위해 필수 약관에 모두 동의해 주세요.');
      return;
    }
    if (finalPrice <= 0) {
      alert('결제 금액이 0원인 주문은 결제할 수 없습니다.');
      return;
    }

    const storeId = import.meta.env.VITE_PORTONE_STORE_ID;
    const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      alert('frontend/.env.local에 PortOne Store ID와 Channel Key를 설정해 주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      const prepareRes = await Client.post('/api/ticket/prepare', {
        ticketProductSeq: selectedProduct.ticketProductSeq,
        mileageUsed: usedMileage
      });
      const order = prepareRes.data;

      const customer = {
        fullName: member?.name || member?.nickname || 'Silhouette Member',
      };
      if (member?.phone) customer.phoneNumber = member.phone;
      if (member?.email) customer.email = member.email;

      const payRequest = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: order.pgTransactionId,
        orderName: selectedProduct.productName,
        totalAmount: order.paymentAmount,
        currency: 'KRW',
        payMethod: 'CARD',
        customer
      });

      if (payRequest?.code) {
        alert(payRequest.message || '결제가 취소되었거나 실패했습니다.');
        return;
      }

      const completeRes = await Client.post('/api/ticket/complete', {
        pgTransactionId: order.pgTransactionId,
        paymentMethod: 'card'
      });

      const newTicketCount = completeRes.data.ticketBalance;
      const newMileage = completeRes.data.mileageBalance;

      setMyTicketCount(newTicketCount);
      setMyMileage(newMileage);
      if (onWalletUpdate) {
        onWalletUpdate({ ticketBalance: newTicketCount, mileageBalance: newMileage });
      }

      setShowSuccessModal(true);
      setUsedMileage(0);
      setMileageInput('');
    } catch (err) {
      console.error('결제 오류:', err);
      alert(err.response?.data?.message || err.message || '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.mainContent}>
      {/* 상단 타이틀 */}
      <div className={styles.topHeader}>
        <span className={styles.eyebrow}>SILHOUETTE TICKET PASS · 프리미엄 충전소</span>
        <h1 className={styles.pageTitle}>
          <span className={styles.pageTitleIcon}>
            <i className="fa-solid fa-ticket" />
          </span>
          이용권 구매
        </h1>
        <p className={styles.pageDesc}>
          원하는 인연과 실루엣을 해제하고 1:1 대화를 시작할 수 있는 채팅 이용권을 충전합니다.
        </p>
      </div>

      {/* 프리미엄 허니 배너 */}
      <div className={styles.storeHeroBanner}>
        <div className={styles.heroBannerText}>
          <div className={styles.heroTag}>
            <i className="fa-solid fa-bolt" /> 혜택 즉시 적용
          </div>
          <h2 className={styles.heroTitle}>더 많은 설렘, 실루엣 프리미엄</h2>
          <p className={styles.heroSubtitle}>
            대용량 패키지로 최대 21% 할인 혜택을 누리고, 마일리지 1% 적립까지 챙기세요.
          </p>
        </div>
        <div className={styles.heroAssets}>
          <div className={styles.heroAssetCard}>
            <div className={styles.heroAssetLabel}>내 보유 이용권</div>
            <div className={`${styles.heroAssetValue} ${styles.honey}`}>{myTicketCount}개</div>
          </div>
          <div className={styles.heroAssetCard}>
            <div className={styles.heroAssetLabel}>내 보유 마일리지</div>
            <div className={styles.heroAssetValue}>{myMileage.toLocaleString()} P</div>
          </div>
        </div>
      </div>

      {/* 상품 선택 그리드 & 결제 요약 레이아웃 */}
      <div className={styles.storeContentGrid}>
        <div className={styles.gridLeftCol}>
          {/* 이용권 패키지 선택 */}
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.sectionTitleDot} />
              이용권 패키지 선택
            </h3>
          </div>

          <div className={styles.ticketGrid}>
            {loading && <p>이용권 상품을 불러오는 중입니다.</p>}
            {!loading && ticketProducts.length === 0 && <p>판매 중인 이용권 상품이 없습니다.</p>}
            {ticketProducts.map((pkg) => {
              const isSelected = selectedTicketId === pkg.ticketProductSeq;
              return (
                <div
                  key={pkg.ticketProductSeq}
                  className={`${styles.ticketCard} ${isSelected ? styles.selected : ''}`}
                  onClick={() => setSelectedTicketId(pkg.ticketProductSeq)}
                >
                  {pkg.ticketCount === 12 && (
                    <span className={`${styles.cardTag} ${styles.best}`}>추천 BEST</span>
                  )}
                  {pkg.ticketCount === 120 && (
                    <span className={`${styles.cardTag} ${styles.vip}`}>VIP 대용량</span>
                  )}

                  {/* 이용권 패키지 일러스트 이미지 */}
                  <div className={styles.ticketImageWrap}>
                    <img
                      src={getTicketImage(pkg.ticketCount)}
                      alt={pkg.productName || `이용권 ${pkg.ticketCount}개`}
                      className={styles.ticketImage}
                    />
                  </div>

                  <div className={styles.ticketCardTop}>
                    <div className={styles.ticketIconWrap}>
                      <i className="fa-solid fa-ticket" />
                    </div>
                    <div className={styles.ticketTitleWrap}>
                      <span className={styles.ticketCount}>{pkg.ticketCount}개</span>
                      <span className={styles.ticketUnitPrice}>
                        개당 {Math.floor(pkg.price / pkg.ticketCount).toLocaleString()}원
                      </span>
                    </div>
                  </div>

                  <div className={styles.ticketCardBottom}>
                    <span className={styles.ticketPrice}>{pkg.price.toLocaleString()}원</span>
                    <div className={styles.selectRadio}>
                      {isSelected && <div className={styles.selectRadioDot} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 마일리지 사용 영역 */}
          <div className={styles.mileageCard}>
            <div className={styles.mileageHeader}>
              <span>
                보유 마일리지: <strong>{myMileage.toLocaleString()} P</strong>
              </span>
              <span>(1P = 1원 즉시 차감)</span>
            </div>
            <div className={styles.mileageInputGroup}>
              <input
                type="text"
                className={styles.mileageInput}
                placeholder="사용할 마일리지 입력"
                value={mileageInput}
                onChange={handleMileageChange}
              />
              <button type="button" className={styles.btnAllUse} onClick={handleUseAllMileage}>
                전액 사용
              </button>
              <button
                type="button"
                className={styles.btnResetMileage}
                onClick={handleResetMileage}
                title="마일리지 0원으로 되돌리기"
              >
                <i className="fa-solid fa-rotate-left" /> 되돌리기
              </button>
            </div>
          </div>

          {/* 유의사항 안내 카드 */}
          <div className={styles.guideCard}>
            <div className={styles.guideTitle}>
              <i className="fa-solid fa-circle-info" /> 이용권 구매 및 환불 안내
            </div>
            <ul className={styles.guideList}>
              <li>구매한 채팅 이용권은 결제 즉시 계정으로 지급되며 유효기간은 1년입니다.</li>
              <li>미사용 이용권은 전자상거래법에 따라 결제 후 7일 이내 전액 환불이 가능합니다.</li>
              <li>마일리지는 현금으로 환급되지 않으며, 결제 시 1P 단위로 자유롭게 사용할 수 있습니다.</li>
            </ul>
          </div>
        </div>

        {/* 우측 사이드 주문 요약 패널 */}
        <div className={styles.orderSummaryPanel}>
          <h3 className={styles.summaryTitle}>주문 요약</h3>

          <div className={styles.summaryRows}>
            <div className={`${styles.summaryRow} ${styles.strong}`}>
              <span>선택 패키지</span>
              <span>채팅 이용권 {selectedProduct?.ticketCount || 0}개</span>
            </div>
            <div className={styles.summaryRow}>
              <span>상품 정가</span>
              <span>{orderPrice.toLocaleString()}원</span>
            </div>
            <div className={`${styles.summaryRow} ${styles.discount}`}>
              <span>마일리지 할인</span>
              <span>-{usedMileage.toLocaleString()}원</span>
            </div>
            <div className={styles.summaryTotalRow}>
              <span className={styles.summaryTotalLabel}>최종 결제 금액</span>
              <span className={styles.summaryTotalPrice}>{finalPrice.toLocaleString()}원</span>
            </div>
          </div>

          <div className={styles.pointRewardBanner}>
            <span className={styles.pointDot} />
            <span>결제 완료 시 +{expectedRewardPoint.toLocaleString()} P 마일리지 적립</span>
          </div>

          {/* 필수 약관 동의 체크박스 */}
          <div className={styles.termsSection}>
            <label className={`${styles.termLabel} ${styles.all}`}>
              <input
                type="checkbox"
                className={styles.termCheckbox}
                checked={agreeAll}
                onChange={handleToggleAllAgreements}
              />
              <span>주문 내용 확인 및 전체 동의</span>
            </label>
            <label className={styles.termLabel}>
              <input
                type="checkbox"
                className={styles.termCheckbox}
                checked={agreeTerms}
                onChange={() => handleToggleAgreement('terms')}
              />
              <span>[필수] 전자금융거래 이용약관 동의</span>
            </label>
            <label className={styles.termLabel}>
              <input
                type="checkbox"
                className={styles.termCheckbox}
                checked={agreePrivacy}
                onChange={() => handleToggleAgreement('privacy')}
              />
              <span>[필수] 개인정보 제3자 제공 동의</span>
            </label>
            <label className={styles.termLabel}>
              <input
                type="checkbox"
                className={styles.termCheckbox}
                checked={agreeConfirm}
                onChange={() => handleToggleAgreement('confirm')}
              />
              <span>[필수] 구매 조건 확인 및 결제 진행 동의</span>
            </label>
          </div>

          {/* 결제하기 버튼 */}
          <button
            type="button"
            className={styles.btnPayCta}
            onClick={handlePayment}
            disabled={!agreeTerms || !agreePrivacy || !agreeConfirm || !selectedProduct || loading || isProcessing}
          >
            <span>
              {isProcessing ? '결제 진행 중...' : `${finalPrice.toLocaleString()}원 결제하기`}
            </span>
            <i className="fa-solid fa-arrow-right" />
          </button>
        </div>
      </div>

      {/* 결제 완료 성공 모달 */}
      {showSuccessModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSuccessModal(false)}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successIconCircle}>
              <i className="fa-solid fa-check" />
            </div>
            <h3 className={styles.successTitle}>이용권 충전 완료!</h3>
            <p className={styles.successDesc}>
              채팅 이용권 <strong>{selectedProduct?.ticketCount || 0}개</strong>가 성공적으로 충전되었습니다.<br />
              현재 보유 이용권: <strong>{myTicketCount}개</strong>
            </p>
            <button
              type="button"
              className={styles.modalActionBtn}
              onClick={() => setShowSuccessModal(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
