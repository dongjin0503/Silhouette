import { useEffect, useRef, useState } from 'react';
import Client from '../../api/client';
import MemberProfileModal from '../../pages/memberProfileModal/memberProfileModal';
import FriendChatBody from '../FriendChat/FriendChatBody';
import Chatting from '../../pages/chatting/chatting';
import useFriendChat from '../FriendChat/useFriendChat';
import styles from './FloatingDock.module.css';

const CHATBOT_QUICK_CHIPS = [
  '📍 강남 맛집 2곳 추천해 줘',
  '🍖 강남 고깃집 추천해 줘',
  '🐟 홍대 횟집 추천해 줘',
  '☕ 성수 데이트 장소 추천해 줘'
];

/* =========================================================
   오른쪽 아래 플로팅 버튼 묶음 (모든 페이지 공통, 레이아웃에서 렌더링)
   - 위: 친구 · 채팅 버튼 + 팝업 (홈 데스크톱에서는 오른쪽 사이드바가 같은 역할이라 숨김: hideFriendOnDesktop)
   - 아래: AI 맛집·데이트 추천 챗봇 버튼 + 대화창
   - 두 팝업은 동시에 열리지 않음. 페이지를 옮겨도 챗봇 대화는 유지됨
   ========================================================= */
export default function FloatingDock({ hideFriendOnDesktop = false }) {
  const { friendList, myRoomList, totalUnread, refreshRooms } = useFriendChat();

  const [isFriendChatOpen, setIsFriendChatOpen] = useState(false);
  const [profileTargetSeq, setProfileTargetSeq] = useState(null); // 프로필 팝업으로 볼 회원 번호
  const [floatingChatRoomId, setFloatingChatRoomId] = useState(null);

  // AI 챗봇 상태
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: '안녕하세요! 실루엣 AI 챗봇입니다. 😊\n지역별 맛집과 데이트 장소를 추천해 드리고, 저희 사이트에 대해 궁금한 점을 대답해드릴게요! 다만 실시간 검색은 하지 않으므로 최신 정보는 방문 전에 확인해 주세요!',
      time: '방금 전'
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // AI 챗봇 메시지 전송
  const handleSendChatMessage = async (textToSend) => {
    const text = typeof textToSend === 'string' ? textToSend : chatInput;

    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    const conversation = chatMessages
      .slice(1)
      .slice(-6)
      .map((message) => {
        const speaker = message.sender === 'ai' ? '챗봇' : '사용자';
        return `${speaker}: ${message.text}`;
      })
      .join('\n');

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');

    try {
      const response = await Client.post('/api/chatbot/chat', {
        question: text.trim(),
        conversation: conversation
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: response.data.answer,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ]);
    } catch (error) {
      console.error('챗봇 오류:', error);

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: error.response?.data?.message || '챗봇 연결에 실패했어요. 잠시 후 다시 시도해 주세요.',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ]);
    }
  };

  // 플로팅 팝업 토글 (친구·채팅과 AI 챗봇 동시 오픈 방지)
  const toggleFriendChat = () => {
    setIsFriendChatOpen((prev) => {
      const next = !prev;
      if (next) setIsChatOpen(false);
      return next;
    });
  };

  const toggleChatbot = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) setIsFriendChatOpen(false);
      return next;
    });
  };

  return (
    <div className={styles.dock} data-floating-dock="">
      {/* 친구 · 채팅 플로팅 버튼 (AI 챗봇 바로 위 고정) */}
      <div
        className={`${styles.friendFab} ${isFriendChatOpen ? styles.friendFabActive : ''} ${hideFriendOnDesktop ? styles.friendFabMobileOnly : ''}`}
        onClick={toggleFriendChat}
        title="친구 목록 및 채팅방 열기"
      >
        <span className={styles.friendFabIcon}>{isFriendChatOpen ? '✕' : '💬'}</span>

        {!isFriendChatOpen && (
          <span className={styles.friendFabBadge}>친구 · 채팅</span>
        )}

        {totalUnread > 0 && (
          <span className={styles.friendFabUnread}>{totalUnread > 99 ? '99+' : totalUnread}</span>
        )}
      </div>

      {/* 친구 · 채팅 플로팅 팝업 윈도우 */}
      {isFriendChatOpen && (
        <div className={`${styles.friendWindow} ${floatingChatRoomId ? styles.friendWindowChatting : ''} ${hideFriendOnDesktop ? styles.friendWindowMobileOnly : ''}`}>
          {!floatingChatRoomId && (
            <div className={styles.friendHeader}>
              <div className={styles.friendHeaderLeft}>
                <div className={styles.friendHeaderAvatar}>💬</div>
                <div>
                  <h4 className={styles.friendHeaderTitle}>친구 · 채팅</h4>
                  <span className={styles.friendHeaderStatus}>
                    친구 {friendList.length}명 · 채팅방 {myRoomList.length}개
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={styles.friendCloseBtn}
                onClick={() => setIsFriendChatOpen(false)}
              >
                ✕
              </button>
            </div>
          )}

          <FriendChatBody
            hidden={Boolean(floatingChatRoomId)}
            onOpenProfile={setProfileTargetSeq}
            onOpenRoom={setFloatingChatRoomId}
          />

          {floatingChatRoomId && (
            <Chatting
              key={`floating-chat-${floatingChatRoomId}`}
              embedded
              roomId={floatingChatRoomId}
              onBack={async () => {
                await refreshRooms();
                setFloatingChatRoomId(null);
              }}
            />
          )}
        </div>
      )}

      {/* AI 맛집·데이트 추천 챗봇 FAB */}
      <div
        className={`${styles.chatbotFab} ${isChatOpen ? styles.chatbotFabActive : ''}`}
        onClick={toggleChatbot}
        title="AI 맛집·데이트 추천 챗봇 열기"
      >
        <span className={styles.chatbotFabIcon}>{isChatOpen ? '✕' : 'AI'}</span>

        {!isChatOpen && <span className={styles.chatbotFabBadge}>AI 추천</span>}

        <span className={styles.chatbotOnlineDot} />
      </div>

      {isChatOpen && (
        <div className={styles.chatbotWindow}>
          <div className={styles.chatbotHeader}>
            <div className={styles.chatbotHeaderLeft}>
              <div className={styles.chatbotAvatar}>AI</div>

              <div>
                <h4 className={styles.chatbotTitle}>실루엣 AI 추천 도우미</h4>
                <span className={styles.chatbotStatus}>🟢 맛집·데이트 추천 상담</span>
              </div>
            </div>

            <button
              type="button"
              className={styles.chatbotCloseBtn}
              onClick={() => setIsChatOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className={styles.quickChipsContainer}>
            {CHATBOT_QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className={styles.quickChip}
                onClick={() => handleSendChatMessage(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className={styles.chatbotMessages}>
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.chatBubbleRow} ${msg.sender === 'user' ? styles.userRow : styles.aiRow
                  }`}
              >
                {msg.sender === 'ai' && <div className={styles.chatBotAvatarSmall}>AI</div>}

                <div
                  className={`${styles.chatBubble} ${msg.sender === 'user' ? styles.userBubble : styles.aiBubble
                    }`}
                >
                  <p className={styles.chatBubbleText}>{msg.text}</p>
                  <span className={styles.chatTime}>{msg.time}</span>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage();
            }}
            className={styles.chatbotInputArea}
          >
            <input
              type="text"
              className={styles.chatbotInput}
              placeholder="지역과 먹고 싶은 음식 또는 궁금한 가게를 입력하세요..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              autoFocus
            />

            <button type="submit" className={styles.chatbotSendBtn} title="전송">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={styles.sendIcon}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>
      )}


      {profileTargetSeq && (
        <MemberProfileModal
          memberSeq={profileTargetSeq}
          onClose={() => setProfileTargetSeq(null)}
        />
      )}
    </div>
  );
}