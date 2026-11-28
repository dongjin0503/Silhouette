import { useState, useEffect } from 'react';
import useAuthStore from '../../stores/useAuthStore';
import MainNav from '../MainNav/MainNav';
import styles from './PageHero.module.css';

/* =========================================================
   공통 페이지 히어로 (라이브 · 게시판 · 이벤트 · 마이페이지)
   - description: Silhouette 로고 서체의 순백 타이핑 텍스트
   - 타이핑이 완료된 후에도 사라지지 않고 영구 고정 노출
   ========================================================= */
export default function PageHero({ eyebrow, live = false, title, description, wordmark, children }) {
  const token = useAuthStore((state) => state.token);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!description) {
      setVisibleCount(0);
      return;
    }

    // 모션 감소 설정 시 즉시 전체 표시
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setVisibleCount(description.length);
      return;
    }

    // 초기 타이핑 시작
    setVisibleCount(0);
    let current = 0;
    const total = description.length;

    const timer = setInterval(() => {
      current += 1;
      setVisibleCount(current);
      if (current >= total) {
        clearInterval(timer);
      }
    }, 28);

    return () => clearInterval(timer);
  }, [description]);

  // 한 글자씩 타이핑되듯 순차적으로 나타나며, 타이핑 후 영구 고정 유지
  const renderTypedDescription = () => {
    if (!description) return null;
    const words = description.split(' ');
    let globalCharIndex = 0;

    return words.map((word, wIdx) => {
      const wordChars = word.split('');
      const wordStartIndex = globalCharIndex;
      globalCharIndex += wordChars.length + 1; // 단어 글자수 + 공백 1칸

      return (
        <span key={wIdx} className={styles.wordGroup}>
          <span className={styles.word}>
            {wordChars.map((char, cIdx) => {
              const charIdx = wordStartIndex + cIdx;
              const isVisible = charIdx < visibleCount;
              return (
                <span
                  key={cIdx}
                  className={isVisible ? styles.charVisible : styles.charHidden}
                >
                  {char}
                </span>
              );
            })}
          </span>
          {wIdx < words.length - 1 && (
            <span
              className={
                wordStartIndex + wordChars.length < visibleCount
                  ? styles.charVisible
                  : styles.charHidden
              }
            >
              {' '}
            </span>
          )}
        </span>
      );
    });
  };

  return (
    <section className={styles.hero} data-page-hero="">
      <div className={styles.body}>
        <div className={`${styles.text} ${children ? styles.textWithExtra : ''}`}>
          {description && (
            <p className={styles.description} aria-label={description}>
              <span aria-hidden="true">{renderTypedDescription()}</span>
            </p>
          )}
          {children && <div className={styles.extra}>{children}</div>}
        </div>
        {wordmark && (
          <span
            className={styles.wordmark}
            style={{ '--wordmark-len': wordmark.length }}
            aria-hidden="true"
          >
            {wordmark}
          </span>
        )}
      </div>
      {token && (
        <div className={styles.navDock}>
          <MainNav />
        </div>
      )}
    </section>
  );
}
