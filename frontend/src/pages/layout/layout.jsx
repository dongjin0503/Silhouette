import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import styles from './layout.module.css';
import useOnboardingGuard from '../onboarding/useOnboardingGuard';
import useAuthStore from '../../stores/useAuthStore';
import Client from '../../api/client';
import { Client as StompClient } from '@stomp/stompjs';
import FriendChatProvider from '../../components/FriendChat/FriendChatProvider';
import FloatingDock from '../../components/FloatingDock/FloatingDock';
import Footer from '../../components/Footer/Footer';

// 기본 프로필 아바타 이미지 (SVG - 실루엣 홈 테마 잉크 & 허니 골드)
const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" fill="#22201e"/>' +
      '<circle cx="50" cy="38" r="18" fill="#ffd34e" opacity="0.9"/>' +
      '<path d="M18 88c4-18 18-28 32-28s28 10 32 28z" fill="#ffd34e" opacity="0.9"/></svg>'
  );

// 모든 페이지의 공통 상단 메뉴와 알림 드롭다운을 관리합니다.
function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  useOnboardingGuard();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  const isChatRoomPage = /^\/(chatting|chat)\//.test(location.pathname);

  const [theme, setTheme] = useState(() => localStorage.getItem('silhouette_theme') || 'light');
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationAreaRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [memberSeq, setMemberSeq] = useState(null);
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState([]);

  // 로그인 사용자 프로필 정보 (닉네임, 프로필 사진)
  const [profile, setProfile] = useState({
    nickname: '',
    photoUrl: null
  });

  useEffect(() => {
    if (theme === 'light') document.body.classList.add('theme-light');
    else document.body.classList.remove('theme-light');
    localStorage.setItem('silhouette_theme', theme);
  }, [theme]);

  // 로그인 시 관리자 권한(role) 동기화 (항상 관리자 여부 검사)
  useEffect(() => {
    if (token && !role) {
      Client.get('/api/members/me/role')
        .then((res) => {
          const userRole = res.data.admin ? 'ROLE_ADMIN' : 'ROLE_USER';
          sessionStorage.setItem('role', userRole);
          useAuthStore.setState({ role: userRole });
        })
        .catch(() => {});
    }
  }, [token, role]);

  // 로그인 회원 정보 및 프로필 사진 로드
  useEffect(() => {
    if (!token) {
      setProfile({ nickname: '', photoUrl: null });
      return undefined;
    }

    let isMounted = true;
    let blobUrl = null;

    const fetchUserProfile = async () => {
      try {
        const basicRes = await Client.get('/api/profile/basic');
        if (!isMounted) return;
        const nick = basicRes.data?.nickname || sessionStorage.getItem('id') || '회원';

        let imgUrl = null;
        try {
          const imgListRes = await Client.get('/api/profile/images');
          if (Array.isArray(imgListRes.data) && imgListRes.data.length > 0) {
            const firstImg = imgListRes.data[0];
            const firstImgSeq = firstImg.profileImageSeq || firstImg.profile_image_seq;
            // 관리자 및 본인 계정은 승인 여부와 관계없이 상단 네비게이션 아바타 사진 표시
            if (firstImgSeq) {
              const imgBlobRes = await Client.get(`/api/profile/image/${firstImgSeq}`, {
                responseType: 'blob'
              });
              blobUrl = URL.createObjectURL(imgBlobRes.data);
              imgUrl = blobUrl;
            }
          }
        } catch {
          // 사진 로드 실패 시 기본 아바타 사용
        }

        if (isMounted) {
          setProfile({
            nickname: nick,
            photoUrl: imgUrl
          });
        }
      } catch (err) {
        if (isMounted) {
          setProfile({
            nickname: sessionStorage.getItem('id') || '회원',
            photoUrl: null
          });
        }
      }
    };

    fetchUserProfile();

    const handleProfileUpdate = () => fetchUserProfile();
    window.addEventListener('silhouette-profile-updated', handleProfileUpdate);
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('silhouette-profile-updated', handleProfileUpdate);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [token]);

  // 로그아웃 처리
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 알림 목록과 읽지 않은 개수를 서버에서 다시 가져옵니다.
  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const [listResult, countResult] = await Promise.all([
        Client.get('/api/notifications'),
        Client.get('/api/notifications/unread-count')
      ]);

      const list = Array.isArray(listResult.data) ? listResult.data.filter(Boolean) : [];
      setNotifications(list);
      setUnreadCount(Number(countResult.data) || 0);
    } catch (error) {
      console.error('알림을 불러오지 못했습니다.', error);
    }
  }, [token]);

  // 로그인 회원 번호를 가져와 개인 알림 STOMP 채널에 연결합니다.
  useEffect(() => {
    if (!token) {
      setMemberSeq(null);
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    let cancelled = false;

    Client.get('/api/chat/member-seq')
      .then((response) => {
        if (!cancelled) {
          setMemberSeq(Number(response.data));
          refreshNotifications();
        }
      })
      .catch((error) => console.error('알림 회원 번호 조회 실패:', error));

    return () => {
      cancelled = true;
    };
  }, [token, refreshNotifications]);

  useEffect(() => {
    if (!token || !memberSeq) return undefined;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname || 'localhost';
    const wsPort = window.location.port === '5173'
      ? ':80'
      : (window.location.port ? `:${window.location.port}` : '');
    const brokerURL = `${wsProtocol}://${wsHost}${wsPort}/chat`;

    const client = new StompClient({
      brokerURL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/sub/notifications/${memberSeq}`, () => {
          refreshNotifications();
        });
      },
      onStompError: (frame) => console.error('알림 STOMP 오류:', frame.headers?.message, frame.body),
      onWebSocketError: (error) => console.error('알림 웹소켓 오류:', error)
    });

    client.activate();

    return () => client.deactivate();
  }, [token, memberSeq, refreshNotifications]);

  // 알림 하나를 읽음 처리한 뒤 목록과 개수를 갱신합니다.
  const markRead = async (notificationSeq) => {
    await Client.post(`/api/notifications/${notificationSeq}/read`);
    await refreshNotifications();
  };

  // 알림 종류에 따라 채팅 초대 또는 친구 요청을 수락/거절합니다.
  const handleNotificationAction = async (item, action) => {
    try {
      if (item.notification_type === 'CHAT_INVITE') {
        const endpoint = action === 'accept' ? 'accept' : 'reject';

        await Client.post(`/api/chat/invite/${item.reference_seq}/${endpoint}`);
        await markRead(item.notification_seq);

        if (action === 'accept' && item.chat_room_seq) {
          navigate(`/chatting/${item.chat_room_seq}`);
        }

        return;
      }

      if (item.notification_type === 'FRIEND_REQUEST') {
        const endpoint = action === 'accept' ? 'accept' : 'reject';

        await Client.post(`/api/chat/friends/requests/${item.reference_seq}/${endpoint}`);
        await markRead(item.notification_seq);

        window.dispatchEvent(new Event('silhouette-friends-updated'));
        return;
      }

      await markRead(item.notification_seq);
    } catch (error) {
      alert(error.response?.data || '알림을 처리하지 못했습니다.');
      refreshNotifications();
    }
  };

  // 알림 창이 열려 있을 때 바깥(배경)을 누르거나 ESC를 누르면 닫습니다.
  useEffect(() => {
    if (!showNotifications) return undefined;

    const handleOutside = (e) => {
      if (notificationAreaRef.current && !notificationAreaRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowNotifications(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showNotifications]);

  // 종 아이콘을 눌러 알림 창을 열거나 닫습니다.
  const openNotifications = async () => {
    const next = !showNotifications;
    setShowNotifications(next);

    if (next) {
      await refreshNotifications();
    }
  };

  // 알림 하나를 X 버튼으로 닫습니다. 읽지 않은 알림은 먼저 읽음 처리합니다.
  const hideNotification = async (item) => {
    try {
      if (item.read_yn === 'N') {
        await markRead(item.notification_seq);
      }

      setHiddenNotificationIds((prev) => [
        ...new Set([
          ...prev,
          item.notification_seq
        ])
      ]);
    } catch (error) {
      alert(error.response?.data || '알림을 읽음 처리하지 못했습니다.');
      refreshNotifications();
    }
  };

  // 알림 목록 전체를 한 번에 숨깁니다.
  const hideAllNotifications = () => {
    setHiddenNotificationIds((prev) => [
      ...new Set([
        ...prev,
        ...notifications.map((item) => item.notification_seq)
      ])
    ]);
  };

  // 숨기지 않은 알림만 화면에 표시합니다.
  const visibleNotifications = (notifications || [])
    .filter((item) => item && typeof item === 'object')
    .filter((item) => !hiddenNotificationIds.includes(item.notification_seq ?? item.notificationSeq));

  const isHeroPage =
    location.pathname === '/' ||
    location.pathname === '/home' ||
    location.pathname.startsWith('/event') ||
    location.pathname.startsWith('/live') ||
    location.pathname.startsWith('/post') ||
    location.pathname.startsWith('/board') ||
    location.pathname === '/mypage' ||
    location.pathname === '/ticket';

  return (
    <div className={`${styles.appContainer} ${isHeroPage ? styles.homeMode : ''} ${token ? styles.loggedIn : ''}`}>
      {/* 
        상단바 2개를 같은 한 열에 배치하는 헤더 행
        - 좌측: 메인 네비게이션 상단바 (하단 매칭 모드 선택과 동일한 왼쪽 정렬)
        - 우측: 알림, 프로필사진, 닉네임, 마이페이지, 로그아웃이 포함된 컴팩트 상단바
        - 로그인/회원가입 화면에서는 우측 유저바 없이 콤팩트 규격으로 중앙 단독 배치
      */}
      <div className={`${styles.headerRow} ${isAuthPage ? styles.headerRowLogin : ''}`}>
        {/* ================= 1. 원래 있던 상단바 ================= */}
        <header className={`${styles.header} ${isAuthPage ? styles.headerLogin : ''}`}>
          <div className={styles.brandLogo} onClick={() => navigate('/')}>
            <span className={styles.brandWordmark}>Silhouette</span>
          </div>

          {/* 로그인/회원가입 화면에서는 메뉴 버튼들을 숨기고, 일반 화면에서만 중앙에 배치 */}
          {!isAuthPage && location.pathname !== '/' && (
            <nav className={styles.navLinks}>
              {token ? (
                /* 로그인 이후: 홈, 이벤트, 게시판, 라이브, (관리자일 때 관리자 메뉴) */
                <>
                  <NavLink to="/" end className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>홈</NavLink>
                  <NavLink to="/event" end className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>이벤트</NavLink>
                  <NavLink to="/post" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>게시판</NavLink>
                  <NavLink to="/live" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>라이브</NavLink>
                  {role === 'ROLE_ADMIN' && (
                    <NavLink to="/admin" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>
                      관리자
                    </NavLink>
                  )}
                </>
              ) : (
                /* 비로그인 시: 홈, 이벤트, 게시판, 라이브, 로그인, 회원가입 */
                <>
                  <NavLink to="/" end className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>홈</NavLink>
                  <NavLink to="/event" end className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>이벤트</NavLink>
                  <NavLink to="/post" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>게시판</NavLink>
                  <NavLink to="/live" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>라이브</NavLink>
                  <NavLink to="/login" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>로그인</NavLink>
                  <NavLink to="/signup" className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}>회원가입</NavLink>
                </>
              )}
            </nav>
          )}

          <div className={styles.headerRight}>
          </div>
        </header>

        {/* ================= 2. 로그인 시 우측에 나타나는 새로운 상단바 (로그인/회원가입 페이지에서는 숨김) ================= */}
        {token && !isAuthPage && (
          <aside className={styles.userBar}>
            {/* 1. 로그인된 내 프로필 사진 및 닉네임 */}
            <div
              className={styles.userProfileGroup}
              onClick={() => navigate('/mypage')}
              title="마이페이지로 이동"
            >
              <img
                src={profile.photoUrl || DEFAULT_AVATAR}
                alt="프로필 사진"
                className={styles.userAvatar}
              />
              <span className={styles.userNickname}>{profile.nickname || '회원'}</span>
            </div>

            {/* 2. 종모양 알림 이모티콘 및 드롭다운 (닉네임/프로필 오른쪽) */}
            <div className={styles.notificationArea} ref={notificationAreaRef}>
              <button
                type="button"
                className={styles.notificationBell}
                onClick={openNotifications}
                aria-label="알림 열기"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.bellIcon}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                {unreadCount > 0 && (
                  <span className={styles.notificationCount}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className={styles.notificationDropdown}>
                  <div className={styles.notificationHeader}>
                    <div>
                      <strong>알림</strong>
                      <span>새로운 소식을 확인해보세요.</span>
                    </div>
                    <button
                      type="button"
                      onClick={hideAllNotifications}
                    >
                      ×
                    </button>
                  </div>

                  <div className={styles.notificationList}>
                    {visibleNotifications.length === 0 ? (
                      <div className={styles.notificationEmpty}>
                        새로운 알림이 없습니다.
                      </div>
                    ) : (
                      visibleNotifications.map((item) => {
                        const isChatInvite = item.notification_type === 'CHAT_INVITE';
                        const isFriendRequest = item.notification_type === 'FRIEND_REQUEST';
                        const canRespond =
                          (isChatInvite || isFriendRequest) && item.read_yn === 'N';

                        return (
                          <div
                            key={item.notification_seq}
                            className={`${styles.notificationItem} ${item.read_yn === 'N' ? styles.notificationUnread : ''}`}
                          >
                            <div className={styles.notificationIcon}>
                              {isChatInvite ? '💬' : isFriendRequest ? '👥' : '💗'}
                            </div>

                            <div className={styles.notificationBody}>
                              <strong>{item.sender_nick || '회원'}</strong>
                              <p>{item.notification_content}</p>

                              {isChatInvite && (
                                <small>{item.room_name || '채팅방 초대'}</small>
                              )}

                              {isFriendRequest && (
                                <small>친구 요청을 수락하면 친구 목록에 추가됩니다.</small>
                              )}

                              {canRespond && (
                                <div className={styles.notificationActions}>
                                  <button
                                    type="button"
                                    onClick={() => handleNotificationAction(item, 'accept')}
                                  >
                                    수락
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleNotificationAction(item, 'reject')}
                                  >
                                    거절
                                  </button>
                                </div>
                              )}

                              {!isChatInvite && !isFriendRequest && item.read_yn === 'N' && (
                                <button
                                  type="button"
                                  className={styles.readButton}
                                  onClick={() => markRead(item.notification_seq)}
                                >
                                  읽음
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              className={styles.notificationDelete}
                              onClick={() => hideNotification(item)}
                              aria-label="알림 숨기기"
                            >
                              ×
                            </button>

                            {item.read_yn === 'N' && (
                              <span className={styles.unreadDot}></span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. 마이페이지 버튼 */}
            <button
              type="button"
              className={styles.userActionBtn}
              onClick={() => navigate('/mypage')}
            >
              마이페이지
            </button>

            {/* 4. 로그아웃 버튼 */}
            <button
              type="button"
              className={`${styles.userActionBtn} ${styles.logoutBtn}`}
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </aside>
        )}
      </div>

      {/* 친구 · 채팅 데이터는 여기서 한 번만 불러 홈 사이드바와 모든 페이지의 플로팅 버튼이 같이 씀 */}
      <FriendChatProvider>
        <main className={styles.main}>
          <Outlet />
        </main>

        {/* 오른쪽 아래 친구 · 채팅 + AI 챗봇 (채팅방 화면은 입력창을 가리므로 제외, 라이브 방송방 안은 CSS로 숨김) */}
        {token && !isAuthPage && !isChatRoomPage && (
          <FloatingDock hideFriendOnDesktop={location.pathname === '/'} />
        )}
      </FriendChatProvider>

      {!isAuthPage && <Footer />}
    </div>
  );
}

export default Layout;