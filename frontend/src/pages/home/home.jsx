
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/useAuthStore';
import styles from './home.module.css';
import {
  startIdealMatch,
  getIdealMatchStatus,
  cancelIdealMatch,
  getNearbyMembers
} from '../../api/matching';
import { getLiveList } from '../../api/live';
import Client from '../../api/client';
import { wsUrl } from '../../api/ws';
import MemberProfileModal from '../memberProfileModal/memberProfileModal';
import MatchQueueOverlay from './components/MatchQueueOverlay';
import MainNav from '../../components/MainNav/MainNav';
import FriendChatBody from '../../components/FriendChat/FriendChatBody';
import Chatting from '../chatting/chatting';
import useFriendChat from '../../components/FriendChat/useFriendChat';
import { Client as StompClient } from '@stomp/stompjs';

// 히어로 인기 프로필 목데이터 (예시 표시용)
const HERO_PROFILES = [
  {
    id: 1,
    name: '서연, 26세',
    badge: '인기 1위 · 서울 성수',
    job: '전시회 큐레이터 · INFP',
    img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=85'
  },
  {
    id: 2,
    name: '민준, 28세',
    badge: '인기 2위',
    job: '건축 디자이너 · INFJ',
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85'
  },
  {
    id: 3,
    name: '지아, 25세',
    badge: '인기 3위',
    job: '플로리스트 · ENFP',
    img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=85'
  }
];



// 매칭 버튼 (9조각 글자 흐름 + 3D 팝 입체 강조 + 막대 애니메이션)
function MatchLoaderButton({ label, variant, onClick }) {
  const measureRef = useRef(null);
  const [wordEm, setWordEm] = useState(5);

  const parts = label.split(' ');
  const keyword = parts[0]; // "BLIND" or "IDEAL"
  const rest = parts.slice(1).join(' '); // "MATCHING"

  // 문구 길이(em)를 재서 조각 위치 계산에 사용
  useLayoutEffect(() => {
    const measure = () => {
      const el = measureRef.current;
      if (!el) return;
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      if (fontSize) setWordEm(el.offsetWidth / fontSize);
    };

    measure();
    document.fonts?.ready.then(measure); // 웹폰트 로드 후 한 번 더 측정
  }, [label]);

  return (
    <button
      type="button"
      className={`${styles.mlBtn} ${variant === 'blind' ? styles.mlBlind : styles.mlIdeal}`}
      onClick={onClick}
      aria-label={label}
    >
      <div className={styles.mlLoader} style={{ '--w': `${wordEm}em` }} aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={styles.mlText}>
            <span ref={i === 4 ? measureRef : undefined} className={styles.mlSpan}>
              <span className={styles.mlKeyword}>
                {keyword.split('').map((char, cIdx) => (
                  <span
                    key={cIdx}
                    className={styles.mlChar}
                    style={{
                      '--char-idx': cIdx,
                      '--char-rev': keyword.length - 1 - cIdx,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </span>
              <span className={styles.mlRest}>&nbsp;{rest}</span>
            </span>
          </div>
        ))}
        <div className={styles.mlLine} />
      </div>
    </button>
  );
}





// 홈 화면
function Home() {
  const { token, id } = useAuthStore();
  const navi = useNavigate();

  const [stompClient, setStompClient] = useState(null);

  // 매칭 상태
  const [isBlindMatching, setIsBlindMatching] = useState(false);
  const [waitingBlindUsers, setWaitingBlindUsers] = useState(1004);
  const [isIdealMatching, setIsIdealMatching] = useState(false);
  const [waitingIdealUsers, setWaitingIdealUsers] = useState(556);

  // 주소지 기반 추천 목록
  const [locationProfiles, setLocationProfiles] = useState([]);
  const [myRegion, setMyRegion] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);

  // 내 주변 회원 온보딩 프로필 이미지 URL (Client blob -> URL.createObjectURL)
  const [nearbyImageUrls, setNearbyImageUrls] = useState({});

  // 히어로 목업 이미지 로드 실패 상태 (CSS placeholder 대체)
  const [heroImageErrors, setHeroImageErrors] = useState({});

  // 비친구 간단 프로필 미리보기 모달
  const [previewProfile, setPreviewProfile] = useState(null);

  // 실시간 라이브 방송 목록
  const [liveRooms, setLiveRooms] = useState([]);
  const [isLiveLoading, setIsLiveLoading] = useState(true);

  // 친구 목록 · 채팅방 · 친구 프로필 이미지 (레이아웃의 FriendChatProvider에서 공유)
  const { friendList, myRoomList, friendImageUrls, refreshRooms } = useFriendChat();
  const [profileTargetSeq, setProfileTargetSeq] = useState(null); // 프로필 팝업으로 볼 회원 번호
  const [sidebarChatRoomId, setSidebarChatRoomId] = useState(null);

  // 프로필 모달이 열려있거나 프로필을 보고 있을 때 마퀴 자동 롤링 정지
  const isMarqueeStopped = Boolean(previewProfile || profileTargetSeq);

  // 프로필 클릭 시 상세/미리보기 모달 열기 (마퀴 정지 트리거)
  const handleOpenProfile = useCallback((item, isFriend, seq) => {
    if (isFriend) {
      setProfileTargetSeq(seq);
    } else {
      setPreviewProfile(item);
    }
  }, []);

  // 실시간 매칭 오버레이 (경과 시간)
  const isMatchingNow = isBlindMatching || isIdealMatching;
  const [matchSeconds, setMatchSeconds] = useState(0);

  useEffect(() => {
    if (!isMatchingNow) return undefined;
    const timer = setInterval(() => setMatchSeconds((prev) => prev + 1), 1000);
    // 매칭이 끝나면(또는 화면을 벗어나면) 경과 시간 초기화
    return () => {
      clearInterval(timer);
      setMatchSeconds(0);
    };
  }, [isMatchingNow]);

  // 친구 번호 Set (내 주변 매칭에서 친구 여부 판별)
  const friendSeqSet = useMemo(() => {
    return new Set(friendList.map((f) => Number(f.member_seq ?? f.memberSeq)));
  }, [friendList]);

  useEffect(() => {
    if (!token) navi('/login');
  }, [token, navi]);

  // 내 주변 회원 온보딩 프로필 이미지 로드
  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    const loadNearbyImages = async () => {
      if (!token || !locationProfiles.length) {
        if (!cancelled) setNearbyImageUrls({});
        return;
      }

      const imageEntries = await Promise.all(
        locationProfiles.map(async (item) => {
          const seq = Number(item.memberSeq ?? item.member_seq);
          let imagePath = item.profileImage || item.profile_image || item.imageUrl || item.image_url;

          // 친구 목록에서 사진 경로 추가 확인
          const friend = friendList.find((f) => Number(f.member_seq ?? f.memberSeq) === seq);
          if (!imagePath && friend) {
            imagePath = friend.profile_image || friend.profileImage;
          }

          // 이미지 경로가 아직 없으면 회원 프로필 API 조회 시도
          if (!imagePath) {
            try {
              const res = await Client.get(`/api/profile/member/${seq}`);
              const imgs = res.data?.images;
              if (imgs && imgs.length > 0) {
                const sorted = [...imgs].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
                imagePath = sorted[0]?.fileUrl || sorted[0]?.file_url;
              }
            } catch {
              // 권한 제한(비친구 403 등) 시 조용히 넘어감
            }
          }

          if (!imagePath) {
            return [seq, null];
          }

          if (/^https?:\/\//i.test(imagePath)) {
            return [seq, imagePath];
          }

          try {
            const response = await Client.get(imagePath, {
              responseType: 'blob',
              headers: {
                Authorization: `Bearer ${token}`
              }
            });

            const imageUrl = URL.createObjectURL(response.data);
            objectUrls.push(imageUrl);

            return [seq, imageUrl];
          } catch (error) {
            console.error(`${item.nickname} 프로필 이미지 로드 실패:`, error);
            return [seq, null];
          }
        })
      );

      if (!cancelled) {
        setNearbyImageUrls(Object.fromEntries(imageEntries));
      }
    };

    loadNearbyImages();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [locationProfiles, friendList, token]);

  // 실시간 라이브 방송 목록 불러오기
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // isLiveLoading은 처음부터 true라 여기서 다시 켜지 않음
    getLiveList()
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const sorted = [...list].sort(
          (a, b) => (Number(b.viewerCount) || 0) - (Number(a.viewerCount) || 0)
        );
        setLiveRooms(sorted);
      })
      .catch((err) => {
        console.error('라이브 목록 조회 실패:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLiveLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // 실시간 접속 대기 인원 변동 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitingBlindUsers((prev) => prev + Math.floor(Math.random() * 5) - 2);
      setWaitingIdealUsers((prev) => prev + Math.floor(Math.random() * 3) - 1);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // 대기 중인지 확인
  const isIdealWaitingRef = useRef(false);

  // 블라인드 매칭 대기 중인지 확인
  const isBlindWaitingRef = useRef(false);

  // 이상형 매칭 성공
  const handleIdealMatched = useCallback(
    (result) => {
      isIdealWaitingRef.current = false;
      setIsIdealMatching(false);
      navi(`/chatting/${result.chatRoomSeq}`);
    },
    [navi]
  );

  // 이상형 매칭 신청
  const handleIdealStart = async () => {
    if (isBlindMatching) {
      alert('이미 블라인드 매칭 대기열에 참가 중입니다. 먼저 매칭을 취소해 주세요.');
      return;
    }
    if (isIdealMatching) return;

    try {
      const { data } = await startIdealMatch();

      if (data.status === 'MATCHED') {
        handleIdealMatched(data);
      } else {
        isIdealWaitingRef.current = true;
        setIsIdealMatching(true);
      }
    } catch (error) {
      const data = error.response?.data;
      const message =
        typeof data === 'string'
          ? data
          : data?.message || '매칭 신청 중 오류가 발생했어요.';
      alert(message);
    }
  };

  // 대기 중일 때 3초마다 매칭 여부 확인
  useEffect(() => {
    if (!isIdealMatching) return;

    let stopped = false;

    const timer = setInterval(async () => {
      try {
        const { data } = await getIdealMatchStatus();

        if (stopped) return;

        if (data.status === 'MATCHED') {
          stopped = true;
          clearInterval(timer);
          handleIdealMatched(data);
        } else if (data.status === 'IDLE') {
          stopped = true;
          clearInterval(timer);
          isIdealWaitingRef.current = false;
          setIsIdealMatching(false);
          alert('연결이 오래 끊겨 매칭 대기가 취소됐어요. 다시 신청해 주세요.');
        }
      } catch {
        // 일시적인 오류는 다음 주기에 다시 확인
      }
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [isIdealMatching, handleIdealMatched]);

  // 대기 중에 창을 닫거나 새로고침하면 대기 취소
  useEffect(() => {
    if (!isIdealMatching) return;

    const cancelOnUnload = () => {
      fetch(`${Client.defaults.baseURL}/matching/ideal/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('token')}`
        },
        keepalive: true
      });
    };

    window.addEventListener('beforeunload', cancelOnUnload);

    return () => window.removeEventListener('beforeunload', cancelOnUnload);
  }, [isIdealMatching]);

  // 대기 중에 다른 메뉴로 이동하면 대기 취소
  useEffect(() => {
    return () => {
      if (isIdealWaitingRef.current) {
        cancelIdealMatch().catch(() => { });
      }
    };
  }, []);

  // 이상형 매칭 대기 취소
  const handleIdealCancel = async () => {
    try {
      await cancelIdealMatch();

      isIdealWaitingRef.current = false;
      setIsIdealMatching(false);
    } catch (error) {
      if (error.response?.status === 409) {
        try {
          const { data } = await getIdealMatchStatus();

          if (data.status === 'MATCHED') {
            handleIdealMatched(data);
            return;
          }
        } catch {
          // 공통 처리로 넘어감
        }
      }

      isIdealWaitingRef.current = false;
      setIsIdealMatching(false);
      alert(error.response?.data || '취소 중 오류가 발생했어요.');
    }
  };

  // 블라인드 매칭 STOMP 연결
  useEffect(() => {
    if (!token) return;

    const brokerURL = wsUrl('/blind');

    const client = new StompClient({
      brokerURL: brokerURL,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      debug: (str) => {
        console.log('[STOMP]:', str);
      },
      onConnect: () => {
        console.log('STOMP Connected to', brokerURL);

        if (id) {
          client.subscribe(`/sub/user/${id}/match`, (message) => {
            try {
              const response = JSON.parse(message.body);

              if (response.status === 'MATCHED' && response.roomSeq) {
                isBlindWaitingRef.current = false;
                setIsBlindMatching(false);
                navi(`/chat/${response.roomSeq}`);
              }
            } catch (err) {
              console.error('응답 메시지 파싱 에러:', err);
            }
          });

          if (isBlindWaitingRef.current) {
            client.publish({
              destination: '/pub/match/join',
              body: '{}'
            });
          }
        }
      },
      onStompError: (frame) => {
        console.error('STOMP Broker Error:', frame.headers['message'], frame.body);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket Error:', error);
      }
    });

    client.activate();
    setStompClient(client);

    return () => {
      client.deactivate();
    };
  }, [token, id, navi]);

  // 블라인드 매칭 신청
  const handleBlindMatching = () => {
    if (isIdealMatching) {
      alert('이미 이상형 매칭 대기열에 참가 중입니다. 먼저 매칭을 취소해 주세요.');
      return;
    }
    if (isBlindMatching) return;

    isBlindWaitingRef.current = true;
    setIsBlindMatching(true);

    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: '/pub/match/join',
        body: '{}'
      });
    } else {
      console.warn('STOMP 소켓이 아직 연결되지 않았습니다. 연결 후 자동으로 매칭을 요청합니다.');
    }
  };

  // 블라인드 매칭 취소
  const handleCancelBlindMatching = () => {
    isBlindWaitingRef.current = false;
    setIsBlindMatching(false);

    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: '/pub/match/cancel',
        body: '{}'
      });
    }
  };

  // 내 주변 추천 불러오기
  const fetchNearby = useCallback(async () => {
    try {
      const { data } = await getNearbyMembers();

      return {
        region: data.myRegion,
        members: data.members ?? []
      };
    } catch (error) {
      console.error('내 주변 추천 조회 실패:', error);

      return {
        region: null,
        members: []
      };
    }
  }, []);

  // 첫 화면 진입 시 주변 회원 조회
  useEffect(() => {
    if (!token) return;

    let ignore = false;

    fetchNearby().then(({ region, members }) => {
      if (ignore) return;

      setMyRegion(region);
      setLocationProfiles(members);
      setIsLocationLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [token, fetchNearby]);

  // 새로운 이웃 추천
  const handleShuffleLocation = async () => {
    setIsLocationLoading(true);

    const { region, members } = await fetchNearby();

    setMyRegion(region);
    setLocationProfiles(members);
    setIsLocationLoading(false);
  };

  // 주변 회원에게 친구 요청 보내기
  const handleSendFriendRequest = async (targetMemberSeq) => {
    try {
      await Client.post('/api/chat/friends/request', {
        friend_member_seq: targetMemberSeq
      });

      alert('친구 요청을 보냈습니다.');
    } catch (error) {
      alert(error.response?.data || '친구 요청을 보내지 못했습니다.');
    }
  };

  // 친구·채팅 sticky 카드: '왼쪽 구역 오른쪽 끝 ~ 브라우저 오른쪽 끝' 사이의 정확히 가운데로 이동
  const leftColRef = useRef(null);
  const sideColRef = useRef(null);
  const [sidebarShift, setSidebarShift] = useState(0);

  useEffect(() => {
    const updateShift = () => {
      const leftEl = leftColRef.current;
      const sideEl = sideColRef.current;
      if (!leftEl || !sideEl) return;

      const leftRight = leftEl.getBoundingClientRect().right;      // 왼쪽 구역 끝
      const sideRect = sideEl.getBoundingClientRect();              // 사이드바 원래 자리
      const viewportRight = document.documentElement.clientWidth;   // 브라우저 오른쪽 끝 (스크롤바 제외)
      const cardWidth = sideRect.width;

      // 원하는 카드 왼쪽 위치 = 두 경계의 중앙 - 카드 절반
      let targetLeft = (leftRight + viewportRight) / 2 - cardWidth / 2;
      // 화면 밖으로 나가지 않도록 보정
      targetLeft = Math.min(targetLeft, viewportRight - cardWidth - 8);
      targetLeft = Math.max(targetLeft, sideRect.left);

      setSidebarShift(Math.round(targetLeft - sideRect.left));
    };

    updateShift();
    window.addEventListener('resize', updateShift);
    return () => window.removeEventListener('resize', updateShift);
  }, []);

  // 가로 스크롤 끊김 방지를 위한 리스트 확장 (최소 8개 이상 보장)
  const marqueeLocationList = useMemo(() => {
    if (locationProfiles.length === 0) return [];
    let repeated = [...locationProfiles];
    while (repeated.length < 8) {
      repeated = [...repeated, ...locationProfiles];
    }
    return repeated;
  }, [locationProfiles]);

  const marqueeLiveList = useMemo(() => {
    if (liveRooms.length === 0) return [];
    if (liveRooms.length < 5) {
      let repeated = [...liveRooms];
      while (repeated.length < 6) {
        repeated = [...repeated, ...liveRooms];
      }
      return repeated;
    }
    return liveRooms;
  }, [liveRooms]);

  return (
    <div className={styles.page}>
      {/* 1. 히어로: 몽글몽글 구름 느낌의 Silhouette 워드마크 (프로필 카드 제거) */}
      <section className={styles.hero}>
        <div className={styles.heroStage}>
          <div className={styles.wordmarkWrap}>
            <h1 className={styles.heroWordmark}>Silhouette</h1>
          </div>
        </div>
      </section>

      {/* 실시간 매칭 큐 오버레이 */}
      {isMatchingNow && (
        <MatchQueueOverlay
          isBlindMatching={isBlindMatching}
          isIdealMatching={isIdealMatching}
          matchSeconds={matchSeconds}
          waitingBlindUsers={waitingBlindUsers}
          waitingIdealUsers={waitingIdealUsers}
          onCancel={isIdealMatching ? handleIdealCancel : handleCancelBlindMatching}
        />
      )}

      {/* 상단 메뉴 */}
      <div className={styles.topNav}>
        <MainNav />
      </div>

      {/* 메인 콘텐츠 영역: 매칭 버튼 + 내 주변 매칭 + 라이브 방송 */}
      <div className={styles.mainColumns}>
        <main className={styles.leftMainCol} ref={leftColRef}>
          {/* 2. 매칭 버튼 (블라인드 / 이상형) */}
          <section className={styles.matchingSection}>
            <div className={styles.matchingGrid}>
              <MatchLoaderButton label="BLIND MATCHING" variant="blind" onClick={handleBlindMatching} />
              <MatchLoaderButton label="IDEAL MATCHING" variant="ideal" onClick={handleIdealStart} />
            </div>
          </section>

          {/* 3. 내 주변 가까운 매칭 (물 흐르듯 연속 롤링 마퀴) */}
          <section className={styles.flowSection}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>NEARBY DISCOVERY</span>
                <h2 className={styles.sectionTitle}>내 주변 가까운 매칭</h2>
                <p className={styles.sectionSub}>
                  {myRegion
                    ? `회원님의 거주지(${myRegion}) 기준 같은 동네 우선 추천`
                    : '회원정보에 주소를 등록하면 가까운 이웃을 추천해드려요'}
                </p>
              </div>

              <button
                type="button"
                className={styles.shuffleBtn}
                onClick={handleShuffleLocation}
                disabled={isLocationLoading}
                title="다른 추천 프로필 보기"
              >
                {isLocationLoading ? '불러오는 중...' : '새로운 이웃 추천'}
              </button>
            </div>

            {!isLocationLoading && locationProfiles.length === 0 && (
              <p className={styles.locEmpty}>
                {myRegion
                  ? '아직 근처에 추천할 회원이 없어요. 잠시 후 다시 확인해보세요!'
                  : '주소 정보가 없어 추천할 수 없어요.'}
              </p>
            )}

            {locationProfiles.length > 0 && (
              <div className={styles.marqueeWrap}>
                <div className={`${styles.marqueeTrack} ${isMarqueeStopped ? styles.marqueePaused : ''}`}>
                  {/* 원본 리스트 */}
                  <div className={styles.marqueeGroup}>
                    {marqueeLocationList.map((item, idx) => {
                      const seq = Number(item.memberSeq ?? item.member_seq);
                      const photoUrl = nearbyImageUrls[seq] || friendImageUrls[seq] || item.profileImage || item.profile_image;
                      const isFriend = friendSeqSet.has(seq);

                      return (
                        <article
                          key={`loc-1-${seq}-${idx}`}
                          className={styles.flowCard}
                          onClick={() => handleOpenProfile(item, isFriend, seq)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={styles.flowPhoto}>
                            {photoUrl ? (
                              <img
                                key={photoUrl}
                                src={photoUrl}
                                alt={item.nickname}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextElementSibling) {
                                    e.currentTarget.nextElementSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}

                            <div
                              className={styles.flowPhotoFallback}
                              style={{ display: photoUrl ? 'none' : 'flex' }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.flowFallbackSvg}>
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                              <span className={styles.flowFallbackInitial}>
                                {(item.nickname || '?').slice(0, 1)}
                              </span>
                            </div>

                            <div className={styles.flowShade} />

                            <div className={styles.flowBadges}>
                              <span className={styles.flowBadgeHoney}>
                                {item.nearRank === 1 ? '같은 동네' : '같은 지역'}
                              </span>
                              {item.mbti && <span className={styles.flowBadgeDark}>{item.mbti}</span>}
                            </div>

                            <div className={styles.flowName}>
                              <h3>
                                {item.nickname}, <span>{item.age}세</span>
                              </h3>
                              <p>{item.region || '지역 미입력'}</p>
                            </div>
                          </div>

                          <div className={styles.flowBody}>
                            <p className={styles.flowIntro}>
                              {item.introduction || '아직 자기소개를 작성하지 않았어요.'}
                            </p>

                            <div className={styles.flowBtnRow}>
                              {isFriend ? (
                                <button
                                  type="button"
                                  className={styles.flowPrimaryBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenProfile(item, isFriend, seq);
                                  }}
                                >
                                  프로필 보기
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className={styles.flowPrimaryBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendFriendRequest(seq);
                                    }}
                                  >
                                    친구 요청
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.flowSecondaryBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenProfile(item, isFriend, seq);
                                    }}
                                  >
                                    프로필 보기
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* 끊김 방지 복제본 리스트 */}
                  <div className={styles.marqueeGroup} aria-hidden="true">
                    {marqueeLocationList.map((item, idx) => {
                      const seq = Number(item.memberSeq ?? item.member_seq);
                      const photoUrl = nearbyImageUrls[seq] || friendImageUrls[seq] || item.profileImage || item.profile_image;
                      const isFriend = friendSeqSet.has(seq);

                      return (
                        <article
                          key={`loc-2-${seq}-${idx}`}
                          className={styles.flowCard}
                          onClick={() => handleOpenProfile(item, isFriend, seq)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className={styles.flowPhoto}>
                            {photoUrl ? (
                              <img
                                key={photoUrl}
                                src={photoUrl}
                                alt={item.nickname}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextElementSibling) {
                                    e.currentTarget.nextElementSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}

                            <div
                              className={styles.flowPhotoFallback}
                              style={{ display: photoUrl ? 'none' : 'flex' }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.flowFallbackSvg}>
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                              <span className={styles.flowFallbackInitial}>
                                {(item.nickname || '?').slice(0, 1)}
                              </span>
                            </div>

                            <div className={styles.flowShade} />

                            <div className={styles.flowBadges}>
                              <span className={styles.flowBadgeHoney}>
                                {item.nearRank === 1 ? '같은 동네' : '같은 지역'}
                              </span>
                              {item.mbti && <span className={styles.flowBadgeDark}>{item.mbti}</span>}
                            </div>

                            <div className={styles.flowName}>
                              <h3>
                                {item.nickname}, <span>{item.age}세</span>
                              </h3>
                              <p>{item.region || '지역 미입력'}</p>
                            </div>
                          </div>

                          <div className={styles.flowBody}>
                            <p className={styles.flowIntro}>
                              {item.introduction || '아직 자기소개를 작성하지 않았어요.'}
                            </p>

                            <div className={styles.flowBtnRow}>
                              {isFriend ? (
                                <button
                                  type="button"
                                  className={styles.flowPrimaryBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenProfile(item, isFriend, seq);
                                  }}
                                >
                                  프로필 보기
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className={styles.flowPrimaryBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendFriendRequest(seq);
                                    }}
                                  >
                                    친구 요청
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.flowSecondaryBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenProfile(item, isFriend, seq);
                                    }}
                                  >
                                    프로필 보기
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 4. 실시간 라이브 방송 리스트 */}
          <section className={styles.flowSection}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.eyebrow}>REAL-TIME LIVE</span>
                <h2 className={styles.sectionTitle}>지금 방송 중</h2>
                <p className={styles.sectionSub}>실시간으로 대화하고 함께 즐기는 라이브 방송</p>
              </div>

              <button
                type="button"
                className={styles.shuffleBtn}
                onClick={() => navi('/live')}
                title="라이브 로비 바로가기"
              >
                라이브 전체보기
              </button>
            </div>

            {!isLiveLoading && liveRooms.length === 0 && (
              <div className={styles.liveEmptyCard}>
                <span className={styles.liveEmptyIcon} role="img" aria-label="방송 안테나">
                  📡
                </span>
                <h3 className={styles.liveEmptyTitle}>지금 방송 중인 라이브가 없어요</h3>
                <p className={styles.liveEmptyDesc}>첫 번째 방송의 주인공이 되어보세요!</p>
                <button
                  type="button"
                  className={styles.liveEmptyBtn}
                  onClick={() => navi('/live')}
                >
                  라이브 보러가기
                </button>
              </div>
            )}

            {liveRooms.length > 0 && (
              <div className={styles.marqueeWrap}>
                <div className={styles.marqueeTrack}>
                  {/* 원본 리스트 */}
                  <div className={styles.marqueeGroup}>
                    {marqueeLiveList.map((room, idx) => (
                      <article
                        key={`live-1-${room.liveRoomSeq}-${idx}`}
                        className={`${styles.flowCard} ${styles.liveCard}`}
                        onClick={() => navi('/live')}
                      >
                        <div className={styles.liveThumbnailBox}>
                          {room.thumbnailUrl ? (
                            <img src={room.thumbnailUrl} alt={room.title} className={styles.liveThumbnail} />
                          ) : (
                            <div className={styles.liveThumbnailFallback}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.liveCameraSvg}>
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                              </svg>
                              <span>LIVE</span>
                            </div>
                          )}
                          <div className={styles.liveOverlayShade} />

                          <div className={styles.liveBadgeRow}>
                            <span className={styles.liveBadge}>LIVE</span>
                            <span className={styles.viewerBadge}>
                              👁 {(room.viewerCount || 0).toLocaleString()}명
                            </span>
                          </div>

                          {room.category && (
                            <span className={styles.liveCategoryBadge}>{room.category}</span>
                          )}
                        </div>

                        <div className={styles.liveInfoBox}>
                          <h3 className={styles.liveTitle}>{room.title}</h3>
                          <p className={styles.liveHostNick}>{room.hostNickname}</p>
                        </div>
                      </article>
                    ))}
                  </div>

                  {/* 끊김 방지 복제본 리스트 */}
                  <div className={styles.marqueeGroup} aria-hidden="true">
                    {marqueeLiveList.map((room, idx) => (
                      <article
                        key={`live-2-${room.liveRoomSeq}-${idx}`}
                        className={`${styles.flowCard} ${styles.liveCard}`}
                        onClick={() => navi('/live')}
                      >
                        <div className={styles.liveThumbnailBox}>
                          {room.thumbnailUrl ? (
                            <img src={room.thumbnailUrl} alt={room.title} className={styles.liveThumbnail} />
                          ) : (
                            <div className={styles.liveThumbnailFallback}>
                              <svg viewBox="0 0 24 24" fill="currentColor" className={styles.liveCameraSvg}>
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                              </svg>
                              <span>LIVE</span>
                            </div>
                          )}
                          <div className={styles.liveOverlayShade} />

                          <div className={styles.liveBadgeRow}>
                            <span className={styles.liveBadge}>LIVE</span>
                            <span className={styles.viewerBadge}>
                              👁 {(room.viewerCount || 0).toLocaleString()}명
                            </span>
                          </div>

                          {room.category && (
                            <span className={styles.liveCategoryBadge}>{room.category}</span>
                          )}
                        </div>

                        <div className={styles.liveInfoBox}>
                          <h3 className={styles.liveTitle}>{room.title}</h3>
                          <p className={styles.liveHostNick}>{room.hostNickname}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>

        {/* 오른쪽 열: 친구 · 채팅 Sticky 사이드바 (PC 데스크톱) */}
        <aside className={styles.rightSidebarCol} ref={sideColRef}>
          <div
            className={styles.sidebarStickyCard}
            style={{ transform: `translateX(${sidebarShift}px)` }}
          >
            {!sidebarChatRoomId && (
              <div className={styles.sidebarStickyHeader}>
                <div className={styles.friendHeaderLeft}>
                  <div className={styles.friendHeaderAvatar}>💬</div>
                  <div>
                    <h4 className={styles.friendHeaderTitle}>친구 · 채팅</h4>
                    <span className={styles.friendHeaderStatus}>
                      친구 {friendList.length}명 · 채팅방 {myRoomList.length}개
                    </span>
                  </div>
                </div>
              </div>
            )}

            <FriendChatBody
              hidden={Boolean(sidebarChatRoomId)}
              onOpenProfile={setProfileTargetSeq}
              onOpenRoom={setSidebarChatRoomId}
            />

            {sidebarChatRoomId && (
              <Chatting
                key={`home-chat-${sidebarChatRoomId}`}
                embedded
                roomId={sidebarChatRoomId}
                onBack={async () => {
                  await refreshRooms();
                  setSidebarChatRoomId(null);
                }}
              />
            )}
          </div>
        </aside>
      </div>

      {/* 친구 · 채팅 플로팅 버튼과 AI 챗봇은 모든 페이지 공통이라 레이아웃(FloatingDock)에서 띄움 */}

      {/* 비친구용 간단 프로필 미리보기 모달 */}
      {previewProfile && (
        <div className={styles.modalOverlay} onClick={() => setPreviewProfile(null)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewModalHeader}>
              <h3 className={styles.previewModalTitle}>프로필 미리보기</h3>
              <button
                type="button"
                className={styles.previewCloseBtn}
                onClick={() => setPreviewProfile(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.previewPhotoBox}>
              {nearbyImageUrls[Number(previewProfile.memberSeq ?? previewProfile.member_seq)] ||
                friendImageUrls[Number(previewProfile.memberSeq ?? previewProfile.member_seq)] ||
                previewProfile.profileImage ||
                previewProfile.profile_image ? (
                <img
                  src={
                    nearbyImageUrls[Number(previewProfile.memberSeq ?? previewProfile.member_seq)] ||
                    friendImageUrls[Number(previewProfile.memberSeq ?? previewProfile.member_seq)] ||
                    previewProfile.profileImage ||
                    previewProfile.profile_image
                  }
                  alt={previewProfile.nickname}
                  className={styles.previewPhotoImg}
                />
              ) : (
                <div className={styles.previewPhotoFallback}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.previewSilhouetteSvg}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  <span className={styles.previewInitial}>
                    {(previewProfile.nickname || '?').slice(0, 1)}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.previewBody}>
              <div className={styles.previewNameLine}>
                <h4>
                  {previewProfile.nickname}, <span>{previewProfile.age}세</span>
                </h4>
                <span className={styles.previewRegionBadge}>
                  {previewProfile.region || '지역 미입력'}
                </span>
              </div>

              <div className={styles.previewTagLine}>
                {previewProfile.mbti && (
                  <span className={styles.previewTagBadge}>{previewProfile.mbti}</span>
                )}
                {previewProfile.job && (
                  <span className={styles.previewTagBadge}>{previewProfile.job}</span>
                )}
              </div>

              <div className={styles.previewIntroArea}>
                <span className={styles.previewIntroTitle}>자기소개</span>
                <p className={styles.previewIntroContent}>
                  {previewProfile.introduction || '아직 자기소개를 작성하지 않았어요.'}
                </p>
              </div>

              <button
                type="button"
                className={styles.previewActionBtn}
                onClick={() => {
                  handleSendFriendRequest(
                    Number(previewProfile.memberSeq ?? previewProfile.member_seq)
                  );
                }}
              >
                친구 요청 보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기존 친구 프로필 팝업 (친구일 때만 열림) */}
      {profileTargetSeq && (
        <MemberProfileModal
          memberSeq={profileTargetSeq}
          onClose={() => setProfileTargetSeq(null)}
        />
      )}
    </div>
  );
}

export default Home;