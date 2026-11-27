import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Client from '../../../api/client';
import useAuthStore from '../../../stores/useAuthStore';
import PageHero from '../../../components/PageHero/PageHero';
import styles from './mypage.module.css';
import ob from '../../onboarding/onboarding.module.css';   // 수정 모드 칩 · 입력칸 (온보딩 · 프로필과 같은 모양)
import {
    MBTI_LIST, JOB_LIST, DRINKING_LIST, SMOKING_LIST, RELIGION_LIST,
    FACE_TYPE_LIST, SKIN_TYPE_LIST, LOVE_TYPE_LIST, HOBBY_LIST,
    FAVORITE_LIST, DISLIKE_LIST, FOOD_LIST, BODY_TYPE_LIST,
    SMOKING_PREF_LIST, DRINKING_PREF_LIST,
    MILITARY_LIST, MILITARY_PREF_LIST,
} from '../../onboarding/onboardingOptions';

/* =========================================================
   실루엣 마이페이지 - 담당: 권형석
   - 기본 정보 (M005 · M006)        : GET/PUT /api/mypage/me, 닉네임 중복 확인 (토큰 방식)
   - 내 정보 · 이상형 (M015 · M011)  : GET /api/profile/me, PUT /api/profile (내 정보 + 이상형 같이 저장)
   - 프로필 사진 교체                : PUT /api/profile/images/1
   - 북마크 (M008)                  : GET /api/bookmarks/me, POST /api/bookmarks/posts/{postSeq}
   - 캘린더 (M012)                  : 화면만 (DB 저장은 다음 단계)
   - 결제 내역 (M010) · 회원 탈퇴 (M007) : 목업 유지
   - 아이디 · 비밀번호 · 이름 · 성별 · 생년월일은 수정 불가
   ========================================================= */

// CSS 모듈 클래스와 외부 라이브러리(FontAwesome 등) 클래스를 같이 쓰기 위한 도우미
const cx = (...names) =>
    names
        .flatMap((n) => (typeof n === 'string' ? n.trim().split(/\s+/) : []))
        .filter(Boolean)
        .map((n) => styles[n] || n)
        .join(' ');

// 왼쪽 메뉴
const MENU_MAIN = [
    { id: 'basic', icon: 'fa-id-card', label: '기본 정보', code: 'M005' },
    { id: 'onboarding', icon: 'fa-user-pen', label: '내 정보 (온보딩)', code: 'M015' },
    { id: 'ideal', icon: 'fa-heart-circle-check', label: '이상형 (온보딩)', code: 'M011' },
    { id: 'bookmarks', icon: 'fa-bookmark', label: '북마크', code: 'M008' },
    { id: 'calendar', icon: 'fa-calendar-check', label: '캘린더', code: 'M012' },
    { id: 'ticket', icon: 'fa-ticket', label: '이용권 구매', code: 'P001' },
];
const MENU_ACCOUNT = [
    { id: 'payment', icon: 'fa-credit-card', label: '결제 내역', code: 'M010' },
];

// 사진이 없을 때 쓰는 기본 아바타 (홈 테마 잉크 & 허니 골드)
const DEFAULT_AVATAR =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<rect width="100" height="100" fill="#22201e"/>' +
        '<circle cx="50" cy="38" r="18" fill="#ffd34e" opacity="0.9"/>' +
        '<path d="M18 88c4-18 18-28 32-28s28 10 32 28z" fill="#ffd34e" opacity="0.9"/></svg>'
    );

// ===== 기본 정보 규칙 (회원가입 signup.jsx와 같음) =====
const REGEX_NICKNAME = /^[a-zA-Z0-9가-힣]{2,20}$/;
const REGEX_PHONE = /^\d{3}-\d{3,4}-\d{4}$/;
const REGEX_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NO_DETAIL = '상세주소 없음';

// ===== 온보딩 규칙 (onboarding.jsx · profile.jsx · 서버와 같음) =====
const MAX_INTRO = 300;
const MAX_MEMO = 150;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const HEIGHT_MIN = 100;
const HEIGHT_MAX = 250;
const WEIGHT_MIN = 30;
const WEIGHT_MAX = 200;
const IDEAL_AGE_MIN = 14;
const MILITARY_MIN_AGE = 18;
const MILITARY_UNDERAGE_VALUE = '미필';
const MY_BODY_TYPE_LIST = BODY_TYPE_LIST.filter((v) => v !== '상관없음');

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ---------- 날짜 · 표시 도우미 ---------- */

// "2026-11-18" / [2026,11,18] / "2026-11-18T00:00:00" → "2026-11-18"
const toDateText = (v) => {
    if (!v) return '';
    if (Array.isArray(v)) {
        const [y, m, d] = v;
        return `${y}-${pad(m)}-${pad(d)}`;
    }
    return String(v).slice(0, 10);
};

// 결제 일시 포맷 "2026-11-10 14:22"
const formatDateTime = (v) => {
    if (!v) return '-';
    if (Array.isArray(v)) {
        const [y, m, d, h = 0, min = 0] = v;
        return `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(min)}`;
    }
    const s = String(v).replace('T', ' ');
    return s.slice(0, 16);
};

// 결제 수단 명칭 변환
const formatPayMethod = (method) => {
    if (!method) return '신용카드';
    const m = String(method).toUpperCase();
    if (m === 'CARD') return '신용카드';
    if (m === 'KAKAOPAY') return '카카오페이';
    if (m === 'NAVERPAY') return '네이버페이';
    if (m === 'TOSS' || m === 'TOSSPAY') return '토스페이';
    return method;
};

// 만 나이
const calcAge = (birth) => {
    const text = toDateText(birth);
    if (!text) return null;
    const [y, m, d] = text.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
};

const isMaleGender = (g) => g === 'MALE' || g === 'M';
const isFemaleGender = (g) => g === 'FEMALE' || g === 'F';
const genderLabel = (g) => (isMaleGender(g) ? '남성' : isFemaleGender(g) ? '여성' : '-');
const dash = (v) => (v === null || v === undefined || v === '' ? '-' : v);
const show = (v, unit = '') => (v === null || v === undefined || v === '' ? '-' : `${v}${unit}`);
const regionOf = (address1) => (address1 ? address1.split(' ').slice(0, 2).join(' ') : '');

// 휴대전화 자동 하이픈 (회원가입과 같음)
const formatPhone = (value) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length > 7) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    if (numbers.length > 3) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return numbers;
};

// 서버 오류 메시지 꺼내기 ({ message } 또는 문자열)
const errorMessage = (err, fallback) => {
    const data = err.response?.data;
    if (typeof data === 'string' && data) return data;
    return data?.message || fallback;
};

/* ---------- 온보딩 도우미 (profile.jsx와 같음) ---------- */
const toTags = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const joinList = (arr) => (arr.length ? arr.join(', ') : null);
const toNum = (v) => (v === '' || v == null ? null : Number(v));
const toStr = (v) => (v === null || v === undefined ? '' : String(v));
const onlyDigits = (v) => String(v).replace(/[^0-9]/g, '').slice(0, 3);
const isNone = (v) => String(v ?? '').toLowerCase() === 'none';
const smokingText = (v) => (isNone(v) ? '비흡연' : show(v));
const drinkingText = (v) => (isNone(v) ? '안 마셔요' : show(v));
const prefText = (v) => (!v || isNone(v) ? '상관없어요' : v);
const isUnderageMaleOf = (basic) =>
    isMaleGender(basic?.gender) && basic?.age != null && Number(basic.age) < MILITARY_MIN_AGE;
const rangeText = (min, max, unit) => {
    if (min == null && max == null) return '상관없음';
    if (min != null && max != null) return `${min}${unit} ~ ${max}${unit}`;
    return min != null ? `${min}${unit} 이상` : `${max}${unit} 이하`;
};

// 서버 데이터 → 수정 폼 값 (콤마 문자열은 배열로, 숫자는 문자열로)
const toForm = (data) => {
    const p = data?.profile ?? {};
    const i = data?.ideal ?? {};
    return {
        profile: {
            mbti: toStr(p.mbti), job: toStr(p.job),
            height: toStr(p.height), weight: toStr(p.weight),
            militaryStatus: isUnderageMaleOf(data?.basic) ? MILITARY_UNDERAGE_VALUE : toStr(p.militaryStatus),
            drinking: toStr(p.drinking), smoking: toStr(p.smoking), religion: toStr(p.religion),
            foodPreference: toTags(p.foodPreference),
            faceType: toStr(p.faceType), skinType: toStr(p.skinType), bodyType: toStr(p.bodyType), loveType: toStr(p.loveType),
            hobby: toTags(p.hobby), favorite: toTags(p.favorite), dislike: toTags(p.dislike),
            introduction: toStr(p.introduction),
        },
        ideal: {
            ageMin: toStr(i.ageMin), ageMax: toStr(i.ageMax),
            minHeight: toStr(i.minHeight), maxHeight: toStr(i.maxHeight),
            bodyType: toTags(i.bodyType), mbtiPref: toTags(i.mbtiPref),
            smokingPref: toStr(i.smokingPref), drinkingPref: toStr(i.drinkingPref),
            militaryPref: toTags(i.militaryPref),
            memo: toStr(i.memo),
        },
    };
};

// 내 정보 검사 (온보딩과 같은 규칙)
const validateProfilePart = (p, isMale, isUnderageMale) => {
    if (!p.mbti) return 'MBTI를 선택해 주세요.';
    if (!p.job) return '직업을 선택해 주세요.';
    const h = toNum(p.height);
    const w = toNum(p.weight);
    if (h === null || h < HEIGHT_MIN || h > HEIGHT_MAX) return `키는 ${HEIGHT_MIN}~${HEIGHT_MAX}cm 사이로 입력해 주세요.`;
    if (w === null || w < WEIGHT_MIN || w > WEIGHT_MAX) return `몸무게는 ${WEIGHT_MIN}~${WEIGHT_MAX}kg 사이로 입력해 주세요.`;
    if (isMale && !isUnderageMale && !p.militaryStatus) return '병역 사항을 선택해 주세요.';
    if (!p.drinking) return '음주 여부를 선택해 주세요.';
    if (!p.smoking) return '흡연 여부를 선택해 주세요.';
    if (!p.religion) return '종교를 선택해 주세요.';
    if (p.foodPreference.length === 0) return '음식 취향을 하나 이상 선택해 주세요.';
    if (!p.faceType) return '얼굴상을 선택해 주세요.';
    if (!p.skinType) return '피부 타입을 선택해 주세요.';
    if (!p.bodyType) return '체형을 선택해 주세요.';
    if (!p.loveType) return '연애 스타일을 선택해 주세요.';
    if (p.hobby.length === 0) return '취미를 하나 이상 선택해 주세요.';
    if (p.favorite.length === 0) return '좋아하는 것을 하나 이상 선택해 주세요.';
    if (p.dislike.length === 0) return '싫어하는 것을 하나 이상 선택해 주세요.';
    if (!p.introduction.trim()) return '자기소개를 입력해 주세요.';
    return '';
};

// 이상형 검사 (온보딩과 같은 규칙)
const validateIdealPart = (i) => {
    const aMin = toNum(i.ageMin), aMax = toNum(i.ageMax);
    const hMin = toNum(i.minHeight), hMax = toNum(i.maxHeight);
    if (aMin !== null && aMin < IDEAL_AGE_MIN) return `이상형 최소 나이는 만 ${IDEAL_AGE_MIN}세 이상이어야 해요. (지금 ${aMin}세)`;
    if (aMax !== null && aMax < IDEAL_AGE_MIN) return `이상형 최대 나이도 만 ${IDEAL_AGE_MIN}세 이상이어야 해요. (지금 ${aMax}세)`;
    const heightOut = (x) => x !== null && (x < HEIGHT_MIN || x > HEIGHT_MAX);
    if (heightOut(hMin) || heightOut(hMax)) return `이상형 키는 ${HEIGHT_MIN}~${HEIGHT_MAX}cm 사이로 입력해 주세요.`;
    if (aMin !== null && aMax !== null && aMin > aMax) return '이상형 나이의 최소값이 최대값보다 클 수 없어요.';
    if (hMin !== null && hMax !== null && hMin > hMax) return '이상형 키의 최소값이 최대값보다 클 수 없어요.';
    return '';
};

// 폼 → 서버로 보낼 값 (내 정보 + 이상형 항상 같이 보냄: 한쪽만 보내면 서버가 이상형을 지움)
const buildProfilePayload = (form, basic) => {
    const isMale = isMaleGender(basic?.gender);
    const isFemale = isFemaleGender(basic?.gender);
    const isUnderageMale = isUnderageMaleOf(basic);
    const p = form.profile;
    const i = form.ideal;
    return {
        profile: {
            mbti: p.mbti,
            job: p.job,
            height: toNum(p.height),
            weight: toNum(p.weight),
            introduction: p.introduction.trim(),
            loveType: p.loveType,
            hobby: joinList(p.hobby),
            favorite: joinList(p.favorite),
            dislike: joinList(p.dislike),
            drinking: p.drinking,
            smoking: p.smoking,
            religion: p.religion,
            foodPreference: joinList(p.foodPreference),
            faceType: p.faceType,
            skinType: p.skinType,
            bodyType: p.bodyType,
            militaryStatus: isMale ? (isUnderageMale ? MILITARY_UNDERAGE_VALUE : p.militaryStatus) : null,
        },
        ideal: {
            ageMin: toNum(i.ageMin),
            ageMax: toNum(i.ageMax),
            minHeight: toNum(i.minHeight),
            maxHeight: toNum(i.maxHeight),
            bodyType: joinList(i.bodyType),
            mbtiPref: joinList(i.mbtiPref),
            smokingPref: i.smokingPref || null,
            drinkingPref: i.drinkingPref || null,
            militaryPref: isFemale ? joinList(i.militaryPref) : null,
            memo: i.memo.trim() || null,
        },
    };
};

// 토큰이 필요한 사진을 blob으로 받아 보여주기 (version이 바뀌면 다시 받음)
function useAuthImage(url, version = 0) {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        if (!url) {
            setSrc(null);
            return;
        }
        let cancelled = false;
        let objectUrl = null;
        Client.get(url, { responseType: 'blob', params: { v: version } })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setSrc(objectUrl);
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) setSrc(null);
            });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url, version]);
    return src;
}

/* ---------- 공통 작은 컴포넌트 ---------- */

function EmptyState({ icon, text, children }) {
    return (
        <div className={cx('empty-state')}>
            <i className={cx(icon)}></i>
            <span>{text}</span>
            {children}
        </div>
    );
}

function PageHeader({ icon, title, desc, children }) {
    return (
        <div className={cx('page-header')}>
            <div>
                <h1 className={cx('page-title')}>
                    <i className={cx('fa-solid', icon, 'page-title-icon')}></i> {title}
                </h1>
                <p className={cx('page-subdesc')}>{desc}</p>
            </div>
            {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
        </div>
    );
}

function InfoCell({ label, value, full }) {
    return (
        <div className={cx('info-cell', full && 'full')}>
            <div className={cx('cell-label')}>{label}</div>
            <div className={cx('cell-value')}>{value}</div>
        </div>
    );
}

// "등산, 독서" → 배지 여러 개
function TagPills({ value, pink }) {
    const items = toTags(value);
    if (items.length === 0) return <span>-</span>;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {items.map((t) => <span key={t} className={cx('badge-pill', pink && 'pink')}>{t}</span>)}
        </div>
    );
}

// 이상형 MBTI: 16개 전부면 '상관없음', 여러 개면 MBTI 순서대로 4개씩 정렬
const MBTI_ANY = '상관없음';
function MbtiPrefPills({ value }) {
    const picked = toTags(value);
    if (picked.length === 0) return <span>-</span>;
    if (MBTI_LIST.every((m) => picked.includes(m))) return <span className={cx('badge-pill')}>{MBTI_ANY}</span>;
    const ordered = MBTI_LIST.filter((m) => picked.includes(m));
    return (
        <div className={cx('mbti-pref-grid')}>
            {ordered.map((m) => <span key={m} className={cx('badge-pill', 'mbti-pref-pill')}>{m}</span>)}
        </div>
    );
}

// 이상형 한 줄
function IdealRow({ label, children }) {
    return (
        <div className={cx('ideal-row')}>
            <span className={cx('ideal-key')}>{label}</span>
            <div className={cx('ideal-tags')} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
        </div>
    );
}

function ScheduleCard({ schedule, onEdit, onDelete }) {
    return (
        <div className={cx('sched-card')}>
            <span className={cx('sched-card-title')}>{schedule.title}</span>
            <span className={cx('sched-card-meta')}>
                <i className={cx('fa-regular', 'fa-clock')}></i>
                {schedule.startAt.slice(11, 16)}
                {schedule.memo && ` · ${schedule.memo}`}
            </span>
            {(onEdit || onDelete) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {onEdit && (
                        <button className={cx('btn-table-action')} onClick={onEdit}>
                            수정
                        </button>
                    )}
                    {onDelete && (
                        <button className={cx('btn-table-action', 'danger')} onClick={onDelete}>
                            삭제
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ---------- 수정 모드 조각 (온보딩 · 프로필과 같은 모양) ---------- */

function Chips({ options, value, onSelect }) {
    const isActive = (opt) => (Array.isArray(value) ? value.includes(opt) : value === opt);
    return (
        <div className={ob.chips}>
            {options.map((opt) => (
                <button key={opt} type="button"
                    className={`${ob.chip} ${isActive(opt) ? ob.chipActive : ''}`}
                    onClick={() => onSelect(opt)}>
                    {opt}
                </button>
            ))}
        </div>
    );
}

function OptionCards({ options, value, onSelect }) {
    return (
        <div className={ob.optionGrid}>
            {options.map((opt) => (
                <button key={opt.value} type="button"
                    className={`${ob.optionCard} ${value === opt.value ? ob.optionCardActive : ''}`}
                    onClick={() => onSelect(opt.value)}>
                    <span className={ob.optionIcon}>{opt.icon}</span>
                    <span className={ob.optionTitle}>{opt.value}</span>
                    <span className={ob.optionDesc}>{opt.desc}</span>
                </button>
            ))}
        </div>
    );
}

// 수정 화면 항목 하나 = 박스 하나 (항목 사이 간격은 .edit-field)
function Field({ label, hint, children }) {
    return (
        <div className={`${ob.field} ${cx('edit-field')}`}>
            <label className={ob.label}>{label}</label>
            {hint && <p className={ob.hint}>{hint}</p>}
            {children}
        </div>
    );
}

// 숫자 입력칸 (값을 몰래 고치지 않고 범위를 벗어나면 안내)
function NumberText({ value, onChange, min, max, unit = '', placeholder }) {
    const [focused, setFocused] = useState(false);
    const n = value === '' || value == null ? null : Number(value);
    const overMax = n !== null && max != null && n > max;
    const underMin = n !== null && min != null && n < min;

    let warn = '';
    if (overMax) warn = `최대 ${max}${unit}까지만 입력할 수 있어요. (지금 ${n}${unit})`;
    else if (underMin && !focused) warn = `최소 ${min}${unit} 이상 입력해야 해요. (지금 ${n}${unit})`;

    return (
        <>
            <input
                type="text"
                inputMode="numeric"
                maxLength={3}
                className={ob.input}
                placeholder={placeholder}
                value={value}
                aria-invalid={warn ? 'true' : 'false'}
                style={warn ? { borderColor: '#f43f5e' } : undefined}
                onChange={(e) => onChange(onlyDigits(e.target.value))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            />
            {warn && <p className={ob.error}>⚠️ {warn}</p>}
        </>
    );
}

/* ---------- 마이페이지 본체 ---------- */

function MyPage() {
    const navigate = useNavigate();

    // 화면 전환 (첫 화면 = 기본 정보)
    const [view, setView] = useState('basic');

    // 회원 기본 정보 (MEMBER)
    const [member, setMember] = useState(null);
    const [loadError, setLoadError] = useState('');

    // 온보딩 정보 { basic, profile, ideal, images } — 온보딩 안 했으면 { notOnboarded: true }
    const [myProfile, setMyProfile] = useState(null);

    // 프로필 사진 (왼쪽 카드 · 내 정보 공용)
    const [photoVersion, setPhotoVersion] = useState(0);
    const [photoPreview, setPhotoPreview] = useState(null);   // 업로드하는 동안 미리보기
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const avatarSrc = useAuthImage(member?.profileImageUrl, photoVersion);
    const photoSrc = photoPreview || avatarSrc;

    // 기본 정보 수정
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [nickChecked, setNickChecked] = useState(false);
    const [nickMessage, setNickMessage] = useState('');
    const [saving, setSaving] = useState(false);

    // 내 정보 · 이상형 수정 ('onboarding' | 'ideal' | null)
    const [pEditing, setPEditing] = useState(null);
    const [pForm, setPForm] = useState(null);
    const [pError, setPError] = useState('');
    const [pSaving, setPSaving] = useState(false);

    // 북마크
    const [bmList, setBmList] = useState([]);
    const [bmPage, setBmPage] = useState(1);
    const [bmTotalPages, setBmTotalPages] = useState(1);
    const [bmTotalCount, setBmTotalCount] = useState(0);
    const [bmLoading, setBmLoading] = useState(false);

    // 캘린더 (회원별 localStorage 영구 저장 — 백엔드 API 미구현으로 클라이언트 저장소 사용)
    const [schedules, setSchedules] = useState([]);
    const [calStorageKey, setCalStorageKey] = useState('');
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedKey, setSelectedKey] = useState(toKey(today));
    const [modalOpen, setModalOpen] = useState(false);
    const [editingScheduleId, setEditingScheduleId] = useState(null);
    const [form, setForm] = useState({ title: '', startAt: '', memo: '' });

    // 회원 탈퇴 (비밀번호 확인만)
    const [withdrawCheck, setWithdrawCheck] = useState(false);
    const [withdrawPw, setWithdrawPw] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);

    // 결제 내역 (M010) & 지갑 잔액
    const [payments, setPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);     // 환불 팝업에 보여줄 결제 건
    const [cancelProcessing, setCancelProcessing] = useState(false);
    const [cancelResult, setCancelResult] = useState(null);       // { ok, message } 팝업 안에 표시
    const [wallet, setWallet] = useState(null);

    // 토스트 메시지
    const [toast, setToast] = useState('');
    const showToast = (msg) => {
        setToast(msg);
        clearTimeout(window.__mpToastTimer);
        window.__mpToastTimer = setTimeout(() => setToast(''), 2500);
    };

    const switchView = (id) => {
        if (id === view) return;
        if ((editing || pEditing) && !window.confirm('수정 중인 내용이 사라집니다. 이동할까요?')) return;
        setEditing(false);
        setEditForm(null);
        setPEditing(null);
        setPForm(null);
        setPError('');
        setView(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /* ===================== 불러오기 ===================== */
    const loadMember = () =>
        Client.get('/api/mypage/me').then((res) => {
            setMember(res.data);
            return res.data;
        });

    const loadMyProfile = () =>
        Client.get('/api/profile/me')
            .then((res) => {
                setMyProfile(res.data);
                return res.data;
            })
            .catch((err) => {
                if (err.response?.status === 404) {
                    setMyProfile({ notOnboarded: true });   // 온보딩 안 한 회원
                    return null;
                }
                console.error(err);
                return null;
            });

    useEffect(() => {
        loadMember().catch((err) => {
            console.error(err);
            if (err.response?.status === 401) {
                alert('로그인이 필요합니다.');
                navigate('/login');
                return;
            }
            setLoadError('회원 정보를 불러오지 못했습니다.');
        });
        loadMyProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ===================== 기본 정보 수정 ===================== */
    const startEdit = () => {
        setEditForm({
            nickname: member.nickname || '',
            phone: member.phone || '',
            email: member.email || '',
            zipcode: member.zipcode || '',
            address1: member.address1 || '',
            address2: member.address2 === NO_DETAIL ? '' : member.address2 || '',
        });
        setNickChecked(true);
        setNickMessage('');
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setEditForm(null);
        setNickMessage('');
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            setEditForm((prev) => ({ ...prev, phone: formatPhone(value) }));
            return;
        }
        if (name === 'nickname') {
            setNickChecked(value.trim() === member.nickname);
            setNickMessage('');
        }
        setEditForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCheckNickname = async () => {
        const nickname = editForm.nickname.trim();
        if (!REGEX_NICKNAME.test(nickname)) {
            setNickChecked(false);
            setNickMessage('⚠️ 닉네임은 영문, 숫자, 한글로 2~20자리 입력해 주세요.');
            return;
        }
        if (nickname.toLowerCase().includes('admin') || nickname.includes('관리자')) {
            setNickChecked(false);
            setNickMessage("⚠️ 닉네임에 'admin' 또는 '관리자'는 포함할 수 없습니다.");
            return;
        }
        if (nickname === member.nickname) {
            setNickChecked(true);
            setNickMessage('✓ 현재 사용 중인 닉네임입니다.');
            return;
        }
        try {
            const res = await Client.get('/api/mypage/nickname-check', { params: { nickname } });
            setNickChecked(res.data.available);
            setNickMessage(res.data.available ? '✓ 사용 가능한 닉네임입니다.' : '⚠️ 이미 사용 중인 닉네임입니다.');
        } catch (err) {
            console.error(err);
            setNickChecked(false);
            setNickMessage(`⚠️ ${errorMessage(err, '닉네임 확인에 실패했습니다.')}`);
        }
    };

    // 카카오 우편번호 검색 (회원가입과 같음)
    const handleOpenPostcode = () => {
        const Postcode = window.daum?.Postcode || window.kakao?.Postcode;
        if (Postcode) {
            executePostcode(Postcode);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
        script.onload = () => {
            const Loaded = window.daum?.Postcode || window.kakao?.Postcode;
            if (Loaded) executePostcode(Loaded);
        };
        document.head.appendChild(script);
    };

    const executePostcode = (PostcodeConstructor) => {
        new PostcodeConstructor({
            oncomplete: (data) => {
                let fullAddress = data.address;
                let extra = '';
                if (data.addressType === 'R') {
                    if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) extra += data.bname;
                    if (data.buildingName !== '' && data.apartment === 'Y') {
                        extra += extra !== '' ? `, ${data.buildingName}` : data.buildingName;
                    }
                    if (extra !== '') fullAddress += ` (${extra})`;
                }
                setEditForm((prev) => ({ ...prev, zipcode: data.zonecode, address1: fullAddress, address2: '' }));
                setTimeout(() => document.getElementById('mp-address2')?.focus(), 100);
            },
        }).open();
    };

    const handleSave = async () => {
        const f = editForm;
        if (!REGEX_NICKNAME.test(f.nickname.trim())) return alert('닉네임은 영문, 숫자, 한글로 2~20자리 입력해 주세요.');
        if (f.nickname.toLowerCase().includes('admin') || f.nickname.includes('관리자')) {
            return alert("닉네임에 'admin' 또는 '관리자'는 포함할 수 없습니다.");
        }
        if (!nickChecked) return alert('닉네임 중복 확인을 해 주세요.');
        if (!REGEX_PHONE.test(f.phone)) return alert('핸드폰 번호를 010-XXXX-XXXX 양식으로 입력해 주세요.');
        if (!REGEX_EMAIL.test(f.email.trim())) return alert('올바른 이메일 양식을 입력해 주세요.');
        if (!f.zipcode || !f.address1) return alert('주소 검색을 통해 주소를 입력해 주세요.');
        if (saving) return;

        setSaving(true);
        try {
            const res = await Client.put('/api/mypage/me', {
                nickname: f.nickname.trim(),
                phone: f.phone,
                email: f.email.trim(),
                zipcode: f.zipcode,
                address1: f.address1,
                address2: f.address2.trim(),
            });
            setMember(res.data);
            setEditing(false);
            setEditForm(null);
            loadMyProfile();   // 온보딩 화면의 닉네임도 맞추기
            showToast('기본 정보가 수정되었습니다.');
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
                alert('로그인 정보가 없습니다. 다시 로그인해 주세요.');
                navigate('/login');
                return;
            }
            if (err.response?.status === 409) setNickChecked(false);
            alert(errorMessage(err, '기본 정보 수정에 실패했습니다.'));
        } finally {
            setSaving(false);
        }
    };

    /* ===================== 프로필 사진 교체 ===================== */
    const openPicker = () => {
        if (!fileInputRef.current) return;
        fileInputRef.current.value = '';
        fileInputRef.current.click();
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('이미지 파일만 올릴 수 있어요.'); return; }
        if (file.size > MAX_PHOTO_SIZE) { alert('사진은 10MB까지 올릴 수 있어요.'); return; }

        const localPreview = URL.createObjectURL(file);
        setPhotoPreview(localPreview);

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            await Client.put('/api/profile/images/1', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await Promise.all([loadMember(), loadMyProfile()]);   // 새 사진 번호 · 주소 받기
            setPhotoVersion((v) => v + 1);
            window.dispatchEvent(new Event('silhouette-profile-updated'));
            window.dispatchEvent(new Event('profileUpdated'));
            showToast('프로필 사진이 변경되었습니다. (관리자 심사 대기)');
        } catch (err) {
            const status = err.response?.status;
            if (status === 401) { alert('로그인이 필요합니다.'); navigate('/login'); }
            else if (status === 413) alert('사진 용량이 너무 커요.');
            else { console.error(err); alert(errorMessage(err, '사진 변경에 실패했습니다.')); }
        } finally {
            setUploading(false);
            setPhotoPreview(null);
            setTimeout(() => URL.revokeObjectURL(localPreview), 3000);
        }
    };

    /* ===================== 내 정보 · 이상형 수정 ===================== */
    const startProfileEdit = (kind) => {
        if (!myProfile?.profile) return;
        setPForm(toForm(myProfile));
        setPError('');
        setPEditing(kind);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelProfileEdit = () => {
        if (!window.confirm('수정한 내용을 취소할까요?')) return;
        setPEditing(null);
        setPForm(null);
        setPError('');
    };

    const setProfileValue = (key, value) =>
        setPForm((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }));

    const toggleProfileList = (key, value) =>
        setPForm((prev) => {
            const list = prev.profile[key];
            return { ...prev, profile: { ...prev.profile, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } };
        });

    const setIdealValue = (key, value) =>
        setPForm((prev) => ({ ...prev, ideal: { ...prev.ideal, [key]: value } }));

    const toggleIdealList = (key, value) =>
        setPForm((prev) => {
            const list = prev.ideal[key];
            return { ...prev, ideal: { ...prev.ideal, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } };
        });

    // 이상형 MBTI: '상관없음' = 16개 전부 선택 (매칭이 목록으로 비교하므로 저장은 16개 그대로)
    // - '상관없음'을 누르면 전부 선택 / 다시 누르면 전부 해제
    // - 전부 선택된 상태에서 하나를 누르면 그 하나만 선택
    const toggleMbtiPref = (value) =>
        setPForm((prev) => {
            const list = prev.ideal.mbtiPref;
            const isAll = MBTI_LIST.every((m) => list.includes(m));
            let next;
            if (value === MBTI_ANY) next = isAll ? [] : [...MBTI_LIST];
            else if (isAll) next = [value];
            else next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
            return { ...prev, ideal: { ...prev.ideal, mbtiPref: next } };
        });

    // 이상형 병역: '상관없음'은 단독 선택
    const toggleMilitaryPref = (value) =>
        setPForm((prev) => {
            const list = prev.ideal.militaryPref;
            let next;
            if (value === '상관없음') {
                next = list.includes('상관없음') ? [] : ['상관없음'];
            } else {
                const rest = list.filter((v) => v !== '상관없음');
                next = rest.includes(value) ? rest.filter((v) => v !== value) : [...rest, value];
            }
            return { ...prev, ideal: { ...prev.ideal, militaryPref: next } };
        });

    const clearIdeal = () => {
        if (!window.confirm('이상형 입력값을 모두 비울까요? (저장해야 삭제돼요)')) return;
        setPForm((prev) => ({ ...prev, ideal: toForm({}).ideal }));
    };

    const handleProfileSave = async () => {
        const basic = myProfile.basic;
        const isMale = isMaleGender(basic?.gender);
        const isUnderageMale = isUnderageMaleOf(basic);

        // 수정하는 쪽을 먼저 검사, 다른 쪽도 서버 규칙 때문에 같이 검사
        const msg = pEditing === 'ideal'
            ? validateIdealPart(pForm.ideal) || validateProfilePart(pForm.profile, isMale, isUnderageMale)
            : validateProfilePart(pForm.profile, isMale, isUnderageMale) || validateIdealPart(pForm.ideal);
        if (msg) { setPError(msg); return; }
        if (pSaving) return;

        setPSaving(true);
        setPError('');
        try {
            await Client.put('/api/profile', buildProfilePayload(pForm, basic));
            await loadMyProfile();
            setPEditing(null);
            setPForm(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast(pEditing === 'ideal' ? '이상형이 저장되었습니다.' : '내 정보가 수정되었습니다.');
        } catch (err) {
            const status = err.response?.status;
            if (status === 401) { alert('로그인이 필요합니다.'); navigate('/login'); }
            else if (status === 400) setPError(errorMessage(err, '입력값을 다시 확인해 주세요.'));
            else { console.error(err); setPError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.'); }
        } finally {
            setPSaving(false);
        }
    };

    /* ===================== 북마크 ===================== */
    const loadBookmarks = (page) => {
        setBmLoading(true);
        Client.get('/api/bookmarks/me', { params: { page } })
            .then((res) => {
                setBmList(res.data.list);
                setBmPage(res.data.page);
                setBmTotalPages(res.data.totalPages);
                setBmTotalCount(res.data.totalCount);
            })
            .catch((err) => console.error(err))
            .finally(() => setBmLoading(false));
    };

    useEffect(() => {
        if (view === 'bookmarks') loadBookmarks(1);
    }, [view]);

    const removeBookmark = async (item) => {
        if (!window.confirm('북마크를 해제할까요?')) return;
        try {
            await Client.post(`/api/bookmarks/posts/${item.postSeq}`);
            const nextPage = bmList.length === 1 && bmPage > 1 ? bmPage - 1 : bmPage;
            loadBookmarks(nextPage);
            showToast('북마크가 해제되었습니다.');
        } catch (err) {
            console.error(err);
            alert('북마크 해제에 실패했습니다.');
        }
    };

    /* ===================== 결제 내역 (M010) & 지갑 잔액 ===================== */
    const loadPayments = () => {
        setPaymentsLoading(true);
        Client.get('/api/ticket/payments')
            .then((res) => {
                setPayments(Array.isArray(res.data) ? res.data : []);
            })
            .catch((err) => {
                console.error('결제 내역 조회 실패:', err);
                setPayments([]);
            })
            .finally(() => {
                setPaymentsLoading(false);
            });
    };

    // 환불 팝업: 결제 정보를 보여주고 [환불하기]를 누르면 환불 처리 (서버가 7일 이내/미사용 검증 + PortOne 취소)
    const openCancelModal = (p) => {
        setCancelResult(null);
        setCancelTarget(p);
    };

    const closeCancelModal = () => {
        if (cancelProcessing) return;
        setCancelTarget(null);
        setCancelResult(null);
    };

    const confirmCancelPayment = () => {
        if (!cancelTarget || cancelProcessing) return;
        setCancelProcessing(true);
        Client.post('/api/ticket/cancel', { pgTransactionId: cancelTarget.pgTransactionId })
            .then(() => {
                setCancelResult({ ok: true, message: '결제가 취소되었습니다.' });
                loadPayments();
                loadWallet();
            })
            .catch((err) => {
                console.error('결제 취소 실패:', err);
                setCancelResult({
                    ok: false,
                    message: err.response?.data?.message || '결제 취소 중 오류가 발생했습니다.',
                });
            })
            .finally(() => {
                setCancelProcessing(false);
            });
    };

    const loadWallet = () => {
        Client.get('/api/ticket/wallet')
            .then((res) => {
                setWallet(res.data);
            })
            .catch((err) => {
                console.error('지갑 잔액 조회 실패:', err);
            });
    };

    useEffect(() => {
        loadWallet();
    }, []);

    useEffect(() => {
        if (view === 'payment') {
            loadPayments();
            loadWallet();
        }
    }, [view]);

    /* ===================== 캘린더 (등록 · 수정 · 삭제 · 영구 저장) ===================== */
    useEffect(() => {
        if (!member) return;
        const key = `silhouette_mypage_calendar_${member.memberSeq ?? member.loginId ?? 'guest'}`;
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            setSchedules(Array.isArray(parsed) ? parsed : []);
        } catch (err) {
            console.error(err);
            setSchedules([]);
        }
        setCalStorageKey(key);
    }, [member?.memberSeq, member?.loginId]);

    useEffect(() => {
        if (!calStorageKey) return;
        try {
            localStorage.setItem(calStorageKey, JSON.stringify(schedules));
        } catch (err) {
            console.error(err);
        }
    }, [schedules, calStorageKey]);

    const schedulesOf = (key) =>
        schedules
            .filter((s) => s.startAt.slice(0, 10) === key)
            .sort((a, b) => a.startAt.localeCompare(b.startAt));

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayKey = toKey(today);
    const [, selM, selD] = selectedKey.split('-');
    const selectedList = schedulesOf(selectedKey);

    const moveMonth = (diff) => {
        let y = viewYear;
        let m = viewMonth + diff;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        setViewYear(y);
        setViewMonth(m);
    };

    const openScheduleModal = () => {
        setEditingScheduleId(null);
        setForm({ title: '', startAt: `${selectedKey}T12:00`, memo: '' });
        setModalOpen(true);
    };

    const openEditScheduleModal = (schedule) => {
        setEditingScheduleId(schedule.id);
        setForm({
            title: schedule.title || '',
            startAt: schedule.startAt || `${selectedKey}T12:00`,
            memo: schedule.memo || '',
        });
        setModalOpen(true);
    };

    const closeScheduleModal = () => {
        setModalOpen(false);
        setEditingScheduleId(null);
    };

    const saveSchedule = () => {
        if (!form.title.trim() || !form.startAt) {
            alert('일정 제목과 날짜를 입력해 주세요.');
            return;
        }
        const trimmedTitle = form.title.trim();
        const trimmedMemo = form.memo.trim();

        if (editingScheduleId !== null) {
            setSchedules((prev) =>
                prev.map((s) =>
                    s.id === editingScheduleId
                        ? { ...s, title: trimmedTitle, startAt: form.startAt, memo: trimmedMemo }
                        : s
                )
            );
            showToast('일정이 수정되었습니다.');
        } else {
            setSchedules((prev) => [
                ...prev,
                { id: Date.now(), title: trimmedTitle, startAt: form.startAt, memo: trimmedMemo },
            ]);
            showToast('새 일정이 등록되었습니다.');
        }

        const key = form.startAt.slice(0, 10);
        setSelectedKey(key);
        setViewYear(Number(key.slice(0, 4)));
        setViewMonth(Number(key.slice(5, 7)) - 1);
        closeScheduleModal();
    };

    const deleteSchedule = (id) => {
        if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        showToast('일정이 삭제되었습니다.');
    };

    /* ===================== 회원 탈퇴 (비밀번호 확인만) ===================== */
    const handleWithdraw = async () => {
        if (!withdrawCheck) { alert('유의사항 확인 및 탈퇴 동의에 체크해 주세요.'); return; }
        if (!withdrawPw) { alert('본인 확인 비밀번호를 입력해 주세요.'); return; }
        if (withdrawing) return;

        if (!window.confirm('정말로 탈퇴하시겠습니까? 보유 자산은 즉시 소멸됩니다.')) return;

        try {
            setWithdrawing(true);
            const resp = await Client.post('/api/mypage/withdraw', {
                password: withdrawPw
            });
            alert(resp.data?.message || '탈퇴 처리가 완료되었습니다.');
            useAuthStore.getState().logout();
            navigate('/login');
        } catch (err) {
            alert(errorMessage(err, '회원 탈퇴에 실패했습니다.'));
        } finally {
            setWithdrawing(false);
        }
    };

    /* ===================== 화면 ===================== */

    const lnbItem = (m) => (
        <a
            key={m.id}
            className={cx('lnb-item', view === m.id && 'active')}
            onClick={() => {
                if (m.id === 'ticket') {
                    navigate('/ticket');
                    return;
                }
                switchView(m.id);
            }}
            style={{ cursor: 'pointer' }}
        >
            <div className={cx('lnb-item-left')}>
                <i className={cx('fa-solid', m.icon)}></i>
                <span>{m.label}</span>
            </div>
            {m.code && <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{m.code}</span>}
        </a>
    );

    // 온보딩 안 한 회원 / 불러오는 중 안내 (내 정보 · 이상형 공용)
    const renderNeedOnboarding = () => {
        if (!myProfile) return <EmptyState icon="fa-solid fa-spinner" text="불러오는 중..." />;
        return (
            <EmptyState icon="fa-solid fa-wand-magic-sparkles" text="아직 온보딩을 완료하지 않았어요. 온보딩을 마치면 내 정보와 이상형을 관리할 수 있어요.">
                <button className={cx('btn-primary-gradient')} style={{ padding: '10px 22px', marginTop: 6 }} onClick={() => navigate('/onboarding')}>
                    온보딩 하러 가기
                </button>
            </EmptyState>
        );
    };

    // 저장 · 취소 버튼 (내 정보 · 이상형 공용)
    const renderProfileEditButtons = () => (
        <>
            {pError && <p className={ob.error} style={{ marginTop: 16 }}>⚠️ {pError}</p>}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className={cx('btn-secondary')} style={{ padding: '12px 22px' }} onClick={cancelProfileEdit} disabled={pSaving}>
                    취소
                </button>
                <button className={cx('btn-primary-gradient')} onClick={handleProfileSave} disabled={pSaving}>
                    {pSaving ? '저장 중...' : '저장하기'}
                </button>
            </div>
        </>
    );

    if (!member) {
        return (
            <div className={cx('mypage')}>
                <main className={cx('main-wrapper')} style={{ display: 'block' }}>
                    <EmptyState icon="fa-solid fa-spinner" text={loadError || '회원 정보를 불러오는 중...'} />
                </main>
            </div>
        );
    }

    const age = calcAge(member.birthDate);
    const region = regionOf(member.address1);
    const pBasic = myProfile?.basic ?? {};
    const pData = myProfile?.profile ?? null;
    const pIdeal = myProfile?.ideal ?? null;
    const pIsMale = isMaleGender(pBasic.gender);
    const pIsFemale = isFemaleGender(pBasic.gender);
    const pIsUnderageMale = isUnderageMaleOf(pBasic);
    const militaryText = pIsUnderageMale
        ? `${MILITARY_UNDERAGE_VALUE} (만 ${MILITARY_MIN_AGE}세 미만)`
        : show(pData?.militaryStatus);

    return (
        <div className={cx('mypage')}>
            {/* 상단 히어로 (이벤트·게시판·라이브와 같은 허니 옐로 띠 + 아래 경계의 이동 바) */}
            <div className={cx('mypage-hero')}>
                <PageHero
                    eyebrow="MY PAGE"
                    title="마이페이지"
                    description="내 정보와 이상형, 북마크·캘린더, 결제 내역을 한곳에서 관리하세요."
                    wordmark="MYPAGE"
                />
            </div>
            <main className={cx('main-wrapper')}>
                {/* ===== 왼쪽 사이드바 ===== */}
                <aside className={cx('sidebar')}>
                    <div className={cx('profile-sidecard')}>
                        <div className={cx('avatar-wrap')}>
                            <img src={photoSrc || DEFAULT_AVATAR} alt={`${member.nickname} 프로필 사진`} className={cx('avatar-img')} />
                        </div>
                        <div className={cx('side-nick')}>{member.nickname}</div>
                        <div className={cx('side-subinfo')}>
                            {member.name}{age !== null && ` · 만 ${age}세`}
                        </div>
                        <div className={cx('side-badges')}>
                            <span className={cx('badge-pill')}>{genderLabel(member.gender)}</span>
                            {pData?.mbti && <span className={cx('badge-pill')}>{pData.mbti}</span>}
                            {pData?.job && <span className={cx('badge-pill', 'pink')}>{pData.job}</span>}
                            {region && <span className={cx('badge-pill')}>{region}</span>}
                        </div>
                        <div className={cx('side-asset-box')}>
                            <div className={cx('side-asset-item')} onClick={() => navigate('/ticket')} style={{ cursor: 'pointer' }} title="이용권 충전하러 가기">
                                <span className={cx('side-asset-label')}>채팅 이용권</span>
                                <span className={cx('side-asset-val')} style={{ color: '#ffd34e' }}>
                                    {wallet ? `${wallet.ticketBalance}개` : '충전'}
                                </span>
                            </div>
                            <div className={cx('side-asset-item')} onClick={() => switchView('payment')} style={{ cursor: 'pointer' }} title="결제 내역 보기">
                                <span className={cx('side-asset-label')}>보유 마일리지</span>
                                <span className={cx('side-asset-val')} style={{ color: '#f472b6' }}>
                                    {wallet ? `${wallet.mileageBalance.toLocaleString()}P` : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <nav className={cx('lnb-menu')}>
                        <div className={cx('lnb-group-title')}>마이 대시보드</div>
                        {MENU_MAIN.map(lnbItem)}
                        <div className={cx('lnb-group-title')} style={{ marginTop: 10 }}>계정 관리</div>
                        {MENU_ACCOUNT.map(lnbItem)}
                        <a className={cx('lnb-item', view === 'withdraw' && 'active')} onClick={() => switchView('withdraw')}>
                            <div className={cx('lnb-item-left')} style={{ color: '#f87171' }}>
                                <i className={cx('fa-solid', 'fa-user-xmark')}></i>
                                <span>회원 탈퇴</span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#f87171' }}>M007</span>
                        </a>
                    </nav>
                </aside>

                <section className={cx('main-content')}>
                    {/* ==================== [뷰 1] 기본 정보 (M005 · M006) ==================== */}
                    {view === 'basic' && (
                        <div className={cx('view-section', 'active')}>
                            <PageHeader
                                icon="fa-id-card"
                                title="기본 정보"
                                desc={editing
                                    ? '닉네임, 휴대전화, 이메일, 주소를 수정할 수 있습니다. (아이디 · 이름 · 성별 · 생년월일은 변경 불가)'
                                    : '회원가입 때 등록한 기본 정보입니다.'}
                            >
                                {editing ? (
                                    <>
                                        <button className={cx('btn-secondary')} style={{ padding: '10px 18px' }} onClick={cancelEdit}>취소</button>
                                        <button className={cx('btn-primary-gradient')} style={{ padding: '10px 22px' }} onClick={handleSave} disabled={saving}>
                                            {saving ? '저장 중...' : '저장하기'}
                                        </button>
                                    </>
                                ) : (
                                    <button className={cx('btn-secondary')} style={{ padding: '10px 18px' }} onClick={startEdit}>
                                        <i className={cx('fa-solid', 'fa-pen')}></i> 수정
                                    </button>
                                )}
                            </PageHeader>

                            <div className={cx('dash-card')} style={{ marginTop: 20 }}>
                                <div className={cx('card-header')}>
                                    <div className={cx('card-title')}>
                                        <i className={cx('fa-solid', 'fa-circle-user')}></i> 회원 정보
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                        가입 일자: {dash(toDateText(member.createdAt))}
                                    </span>
                                </div>

                                {!editing ? (
                                    <div className={cx('info-table', 'info-table-single')}>
                                        <InfoCell label="아이디" value={dash(member.loginId)} />
                                        <InfoCell label="이름" value={dash(member.name)} />
                                        <InfoCell label="닉네임" value={dash(member.nickname)} />
                                        <InfoCell label="성별" value={genderLabel(member.gender)} />
                                        <InfoCell
                                            label="생년월일 / 나이"
                                            value={`${dash(toDateText(member.birthDate))}${age !== null ? ` (만 ${age}세)` : ''}`}
                                        />
                                        <InfoCell label="휴대전화 번호" value={dash(member.phone)} />
                                        <InfoCell label="이메일 주소" value={dash(member.email)} />
                                        <InfoCell
                                            full
                                            label="주소"
                                            value={member.address1
                                                ? `[${member.zipcode}] ${member.address1} ${member.address2 === NO_DETAIL ? '' : member.address2 || ''}`
                                                : '-'}
                                        />
                                    </div>
                                ) : (
                                    <div className={cx('form-grid-web')}>
                                        <div className={cx('form-group-web')}>
                                            <label className={cx('web-label')}>아이디 (변경 불가)</label>
                                            <input type="text" className={cx('web-input')} value={member.loginId} disabled />
                                        </div>
                                        <div className={cx('form-group-web')}>
                                            <label className={cx('web-label')}>이름 (변경 불가)</label>
                                            <input type="text" className={cx('web-input')} value={member.name} disabled />
                                        </div>

                                        <div className={cx('form-group-web', 'full')}>
                                            <label className={cx('web-label')}>닉네임</label>
                                            <div className={cx('input-row')}>
                                                <input type="text" name="nickname" className={cx('web-input')} value={editForm.nickname}
                                                    onChange={handleEditChange} maxLength={20} placeholder="영문, 숫자, 한글 2~20자" />
                                                <button type="button" className={cx('btn-secondary')} onClick={handleCheckNickname}>중복확인</button>
                                            </div>
                                            {nickMessage && (
                                                <span style={{ fontSize: '0.8rem', color: nickChecked ? 'var(--success)' : '#f87171' }}>{nickMessage}</span>
                                            )}
                                        </div>

                                        <div className={cx('form-group-web')}>
                                            <label className={cx('web-label')}>휴대전화 번호</label>
                                            <input type="tel" name="phone" className={cx('web-input')} value={editForm.phone}
                                                onChange={handleEditChange} maxLength={13} placeholder="010-1234-5678" />
                                        </div>
                                        <div className={cx('form-group-web')}>
                                            <label className={cx('web-label')}>이메일 주소</label>
                                            <input type="email" name="email" className={cx('web-input')} value={editForm.email}
                                                onChange={handleEditChange} placeholder="example@silhouette.com" />
                                        </div>

                                        <div className={cx('form-group-web', 'full')}>
                                            <label className={cx('web-label')}>주소</label>
                                            <div className={cx('input-row')}>
                                                <input type="text" className={cx('web-input')} style={{ maxWidth: 130 }} value={editForm.zipcode}
                                                    placeholder="우편번호" onClick={handleOpenPostcode} readOnly />
                                                <input type="text" className={cx('web-input')} value={editForm.address1}
                                                    placeholder="주소 검색을 눌러 주세요" onClick={handleOpenPostcode} readOnly />
                                                <button type="button" className={cx('btn-secondary')} onClick={handleOpenPostcode}>🔍 주소 검색</button>
                                            </div>
                                            <input id="mp-address2" type="text" name="address2" className={cx('web-input')} value={editForm.address2}
                                                onChange={handleEditChange} placeholder="상세주소를 입력해 주세요" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== [뷰 2] 내 정보 (온보딩, M015) ==================== */}
                    {view === 'onboarding' && (
                        <div className={cx('view-section', 'active')}>
                            <PageHeader icon="fa-user-pen" title="내 정보 (온보딩)" desc="온보딩에서 등록한 프로필 사진과 나의 정보입니다.">
                                {pData && pEditing !== 'onboarding' && (
                                    <button className={cx('btn-secondary')} style={{ padding: '10px 18px' }} onClick={() => startProfileEdit('onboarding')}>
                                        <i className={cx('fa-solid', 'fa-pen')}></i> 수정
                                    </button>
                                )}
                            </PageHeader>

                            <div style={{ marginTop: 20 }}>
                                {!pData ? renderNeedOnboarding() : (
                                    <div className={cx('dash-card')}>
                                        {/* 사진 + 요약 (보기 · 수정 공통) */}
                                        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                                <div style={{ position: 'relative', width: 140, height: 180 }}>
                                                    <img
                                                        src={photoSrc || DEFAULT_AVATAR}
                                                        alt={`${pBasic.nickname} 프로필 사진`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16, border: '2px solid var(--primary-light)' }}
                                                    />
                                                    {uploading && (
                                                        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                                                            업로드 중...
                                                        </div>
                                                    )}
                                                </div>
                                                <button className={cx('btn-secondary')} style={{ padding: '8px 14px' }} onClick={openPicker} disabled={uploading}>
                                                    <i className={cx('fa-solid', 'fa-camera')}></i> 사진 바꾸기
                                                </button>
                                                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />
                                            </div>

                                            <div style={{ flex: 1, minWidth: 240 }}>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 6 }}>{pBasic.nickname}</div>
                                                <div style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: 12 }}>
                                                    {genderLabel(pBasic.gender)} · 만 {show(pBasic.age)}세
                                                    {pData.mbti && <> · <strong style={{ color: 'var(--ink)' }}>{pData.mbti}</strong></>}
                                                    {pData.job && <> · {pData.job}</>}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {pData.loveType && <span className={cx('badge-pill', 'pink')}>💕 {pData.loveType}</span>}
                                                    {pData.faceType && <span className={cx('badge-pill')}>✨ {pData.faceType}</span>}
                                                    {pData.skinType && <span className={cx('badge-pill')}>🧴 {pData.skinType}</span>}
                                                    {pData.bodyType && <span className={cx('badge-pill')}>🏃 {pData.bodyType}</span>}
                                                    {pData.religion && <span className={cx('badge-pill')}>🙏 {pData.religion}</span>}
                                                    {pIsMale && (pData.militaryStatus || pIsUnderageMale) && (
                                                        <span className={cx('badge-pill')}>🎖️ {pIsUnderageMale ? MILITARY_UNDERAGE_VALUE : pData.militaryStatus}</span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 10 }}>
                                                    * 사진은 바꾸면 관리자 심사 후 반영됩니다. 이미지 파일 10MB까지.
                                                </p>
                                            </div>
                                        </div>

                                        {pEditing !== 'onboarding' ? (
                                            /* ----- 보기 모드 ----- */
                                            <div className={cx('info-table')}>
                                                <InfoCell full label="💬 자기소개" value={<span style={{ whiteSpace: 'pre-line', fontWeight: 500 }}>{pData.introduction || '-'}</span>} />
                                                <InfoCell label="키" value={show(pData.height, 'cm')} />
                                                <InfoCell label="몸무게" value={show(pData.weight, 'kg')} />
                                                <InfoCell label="직업" value={show(pData.job)} />
                                                <InfoCell label="MBTI" value={show(pData.mbti)} />
                                                {pIsMale && <InfoCell label="병역" value={militaryText} />}
                                                <InfoCell label="음주" value={drinkingText(pData.drinking)} />
                                                <InfoCell label="흡연" value={smokingText(pData.smoking)} />
                                                <InfoCell label="종교" value={show(pData.religion)} />
                                                <InfoCell label="얼굴상" value={show(pData.faceType)} />
                                                <InfoCell label="피부 타입" value={show(pData.skinType)} />
                                                <InfoCell label="체형" value={show(pData.bodyType)} />
                                                <InfoCell label="연애 스타일" value={show(pData.loveType)} />
                                                <InfoCell full label="음식 취향" value={<TagPills value={pData.foodPreference} />} />
                                                <InfoCell full label="취미" value={<TagPills value={pData.hobby} />} />
                                                <InfoCell full label="좋아하는 것" value={<TagPills value={pData.favorite} pink />} />
                                                <InfoCell full label="싫어하는 것" value={<TagPills value={pData.dislike} />} />
                                            </div>
                                        ) : pForm && (
                                            /* ----- 수정 모드 (온보딩과 같은 선택지) ----- */
                                            <div>
                                                <h3 className={cx('card-title')} style={{ margin: '8px 0 12px' }}>📋 기본 정보</h3>
                                                <Field label="MBTI">
                                                    <Chips options={MBTI_LIST} value={pForm.profile.mbti} onSelect={(v) => setProfileValue('mbti', v)} />
                                                </Field>
                                                <Field label="직업">
                                                    <Chips options={JOB_LIST} value={pForm.profile.job} onSelect={(v) => setProfileValue('job', v)} />
                                                </Field>
                                                <div className={ob.row}>
                                                    <Field label={`키 (cm, ${HEIGHT_MIN}~${HEIGHT_MAX})`}>
                                                        <NumberText value={pForm.profile.height} min={HEIGHT_MIN} max={HEIGHT_MAX} unit="cm"
                                                            onChange={(v) => setProfileValue('height', v)} />
                                                    </Field>
                                                    <Field label={`몸무게 (kg, ${WEIGHT_MIN}~${WEIGHT_MAX})`}>
                                                        <NumberText value={pForm.profile.weight} min={WEIGHT_MIN} max={WEIGHT_MAX} unit="kg"
                                                            onChange={(v) => setProfileValue('weight', v)} />
                                                    </Field>
                                                </div>
                                                {pIsMale && (
                                                    pIsUnderageMale ? (
                                                        <Field label="병역" hint={`만 ${MILITARY_MIN_AGE}세 미만은 '${MILITARY_UNDERAGE_VALUE}'로 고정되며 변경할 수 없어요.`}>
                                                            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>🔒 {MILITARY_UNDERAGE_VALUE} (자동 등록)</p>
                                                        </Field>
                                                    ) : (
                                                        <Field label="병역">
                                                            <OptionCards options={MILITARY_LIST} value={pForm.profile.militaryStatus}
                                                                onSelect={(v) => setProfileValue('militaryStatus', v)} />
                                                        </Field>
                                                    )
                                                )}

                                                <h3 className={cx('card-title')} style={{ margin: '24px 0 12px' }}>🍷 생활 습관</h3>
                                                <Field label="음주">
                                                    <Chips options={DRINKING_LIST} value={pForm.profile.drinking} onSelect={(v) => setProfileValue('drinking', v)} />
                                                </Field>
                                                <Field label="흡연">
                                                    <Chips options={SMOKING_LIST} value={pForm.profile.smoking} onSelect={(v) => setProfileValue('smoking', v)} />
                                                </Field>
                                                <Field label="종교">
                                                    <Chips options={RELIGION_LIST} value={pForm.profile.religion} onSelect={(v) => setProfileValue('religion', v)} />
                                                </Field>
                                                <Field label="음식 취향" hint="여러 개 선택할 수 있어요.">
                                                    <Chips options={FOOD_LIST} value={pForm.profile.foodPreference} onSelect={(v) => toggleProfileList('foodPreference', v)} />
                                                </Field>

                                                <h3 className={cx('card-title')} style={{ margin: '24px 0 12px' }}>💄 외모 · 연애 성향</h3>
                                                <Field label="얼굴상">
                                                    <Chips options={FACE_TYPE_LIST} value={pForm.profile.faceType} onSelect={(v) => setProfileValue('faceType', v)} />
                                                </Field>
                                                <Field label="피부 타입">
                                                    <Chips options={SKIN_TYPE_LIST} value={pForm.profile.skinType} onSelect={(v) => setProfileValue('skinType', v)} />
                                                </Field>
                                                <Field label="체형">
                                                    <Chips options={MY_BODY_TYPE_LIST} value={pForm.profile.bodyType} onSelect={(v) => setProfileValue('bodyType', v)} />
                                                </Field>
                                                <Field label="연애 스타일">
                                                    <Chips options={LOVE_TYPE_LIST} value={pForm.profile.loveType} onSelect={(v) => setProfileValue('loveType', v)} />
                                                </Field>

                                                <h3 className={cx('card-title')} style={{ margin: '24px 0 12px' }}>🎨 취향 · 자기소개</h3>
                                                <Field label="취미" hint="여러 개 선택할 수 있어요.">
                                                    <Chips options={HOBBY_LIST} value={pForm.profile.hobby} onSelect={(v) => toggleProfileList('hobby', v)} />
                                                </Field>
                                                <Field label="좋아하는 것" hint="여러 개 선택할 수 있어요.">
                                                    <Chips options={FAVORITE_LIST} value={pForm.profile.favorite} onSelect={(v) => toggleProfileList('favorite', v)} />
                                                </Field>
                                                <Field label="싫어하는 것" hint="여러 개 선택할 수 있어요.">
                                                    <Chips options={DISLIKE_LIST} value={pForm.profile.dislike} onSelect={(v) => toggleProfileList('dislike', v)} />
                                                </Field>
                                                <Field label="자기소개">
                                                    <textarea className={ob.textarea} maxLength={MAX_INTRO} rows={5}
                                                        value={pForm.profile.introduction}
                                                        onChange={(e) => setProfileValue('introduction', e.target.value)} />
                                                    <p className={ob.counter}>{pForm.profile.introduction.length} / {MAX_INTRO}</p>
                                                </Field>

                                                {renderProfileEditButtons()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== [뷰 3] 이상형 (온보딩, M011) ==================== */}
                    {view === 'ideal' && (
                        <div className={cx('view-section', 'active')}>
                            <PageHeader icon="fa-heart-circle-check" title="이상형 (온보딩)" desc="입력한 이상형은 매칭과 오늘의 추천에 반영됩니다.">
                                {pData && pEditing !== 'ideal' && (
                                    <button className={cx('btn-secondary')} style={{ padding: '10px 18px' }} onClick={() => startProfileEdit('ideal')}>
                                        <i className={cx('fa-solid', 'fa-pen')}></i> {pIdeal ? '수정' : '이상형 입력'}
                                    </button>
                                )}
                            </PageHeader>

                            <div style={{ marginTop: 20 }}>
                                {!pData ? renderNeedOnboarding() : pEditing !== 'ideal' ? (
                                    /* ----- 보기 모드 ----- */
                                    !pIdeal ? (
                                        <EmptyState icon="fa-regular fa-heart" text="아직 이상형을 입력하지 않았어요. 입력하면 매칭 확률이 높아져요.">
                                            <button className={cx('btn-primary-gradient')} style={{ padding: '10px 22px', marginTop: 6 }} onClick={() => startProfileEdit('ideal')}>
                                                이상형 입력하기
                                            </button>
                                        </EmptyState>
                                    ) : (
                                        <div className={cx('dash-card')}>
                                            <div className={cx('ideal-list')}>
                                                <IdealRow label="나이"><span className={cx('badge-pill')}>{rangeText(pIdeal.ageMin, pIdeal.ageMax, '세')}</span></IdealRow>
                                                <IdealRow label="키"><span className={cx('badge-pill')}>{rangeText(pIdeal.minHeight, pIdeal.maxHeight, 'cm')}</span></IdealRow>
                                                <IdealRow label="체형"><TagPills value={pIdeal.bodyType} /></IdealRow>
                                                <IdealRow label="MBTI"><MbtiPrefPills value={pIdeal.mbtiPref} /></IdealRow>
                                                <IdealRow label="흡연"><span className={cx('badge-pill')}>{prefText(pIdeal.smokingPref)}</span></IdealRow>
                                                <IdealRow label="음주"><span className={cx('badge-pill')}>{prefText(pIdeal.drinkingPref)}</span></IdealRow>
                                                {pIsFemale && <IdealRow label="병역"><TagPills value={pIdeal.militaryPref} /></IdealRow>}
                                                <IdealRow label="하고 싶은 말">
                                                    <span style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{pIdeal.memo ? `“${pIdeal.memo}”` : '-'}</span>
                                                </IdealRow>
                                            </div>
                                        </div>
                                    )
                                ) : pForm && (
                                    /* ----- 수정 모드 (온보딩과 같은 선택지) ----- */
                                    <div className={cx('dash-card')}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>모든 항목은 선택이에요. 모두 비우고 저장하면 이상형이 삭제돼요.</p>
                                            <button className={cx('btn-table-action', 'danger')} onClick={clearIdeal}>전부 비우기</button>
                                        </div>
                                        <div className={ob.row}>
                                            <Field label={`나이 (최소, 만 ${IDEAL_AGE_MIN}세 이상)`}>
                                                <NumberText value={pForm.ideal.ageMin} min={IDEAL_AGE_MIN} unit="세" placeholder="예: 25"
                                                    onChange={(v) => setIdealValue('ageMin', v)} />
                                            </Field>
                                            <Field label={`나이 (최대, 만 ${IDEAL_AGE_MIN}세 이상)`}>
                                                <NumberText value={pForm.ideal.ageMax} min={IDEAL_AGE_MIN} unit="세" placeholder="예: 32"
                                                    onChange={(v) => setIdealValue('ageMax', v)} />
                                            </Field>
                                        </div>
                                        <div className={ob.row}>
                                            <Field label={`키 (최소 cm, ${HEIGHT_MIN}~${HEIGHT_MAX})`}>
                                                <NumberText value={pForm.ideal.minHeight} min={HEIGHT_MIN} max={HEIGHT_MAX} unit="cm" placeholder="예: 160"
                                                    onChange={(v) => setIdealValue('minHeight', v)} />
                                            </Field>
                                            <Field label={`키 (최대 cm, ${HEIGHT_MIN}~${HEIGHT_MAX})`}>
                                                <NumberText value={pForm.ideal.maxHeight} min={HEIGHT_MIN} max={HEIGHT_MAX} unit="cm" placeholder="예: 185"
                                                    onChange={(v) => setIdealValue('maxHeight', v)} />
                                            </Field>
                                        </div>
                                        <Field label="체형" hint="여러 개 선택할 수 있어요.">
                                            <Chips options={BODY_TYPE_LIST} value={pForm.ideal.bodyType} onSelect={(v) => toggleIdealList('bodyType', v)} />
                                        </Field>
                                        <Field label="MBTI" hint="여러 개 선택할 수 있어요. '상관없음'은 단독으로 선택돼요.">
                                            <Chips
                                                options={[MBTI_ANY, ...MBTI_LIST]}
                                                value={MBTI_LIST.every((m) => pForm.ideal.mbtiPref.includes(m)) ? [MBTI_ANY] : pForm.ideal.mbtiPref}
                                                onSelect={toggleMbtiPref}
                                            />
                                        </Field>
                                        <Field label="흡연">
                                            <Chips options={SMOKING_PREF_LIST} value={pForm.ideal.smokingPref}
                                                onSelect={(v) => setIdealValue('smokingPref', pForm.ideal.smokingPref === v ? '' : v)} />
                                        </Field>
                                        <Field label="음주">
                                            <Chips options={DRINKING_PREF_LIST} value={pForm.ideal.drinkingPref}
                                                onSelect={(v) => setIdealValue('drinkingPref', pForm.ideal.drinkingPref === v ? '' : v)} />
                                        </Field>
                                        {pIsFemale && (
                                            <Field label="병역" hint="여러 개 선택할 수 있어요. '상관없음'은 단독으로 선택돼요.">
                                                <Chips options={MILITARY_PREF_LIST} value={pForm.ideal.militaryPref} onSelect={toggleMilitaryPref} />
                                            </Field>
                                        )}
                                        <Field label="하고 싶은 말">
                                            <textarea className={ob.textarea} maxLength={MAX_MEMO} rows={3}
                                                value={pForm.ideal.memo}
                                                onChange={(e) => setIdealValue('memo', e.target.value)} />
                                            <p className={ob.counter}>{pForm.ideal.memo.length} / {MAX_MEMO}</p>
                                        </Field>

                                        {renderProfileEditButtons()}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== [뷰 4] 북마크 (M008) ==================== */}
                    {view === 'bookmarks' && (
                        <div className={cx('view-section', 'active')}>
                            <PageHeader icon="fa-bookmark" title="북마크" desc={`북마크한 게시글 ${bmTotalCount}개 · 삭제된 글은 목록에 보이지 않습니다.`} />
                            <div className={cx('dash-card')} style={{ marginTop: 20 }}>
                                {bmLoading ? (
                                    <EmptyState icon="fa-solid fa-spinner" text="불러오는 중..." />
                                ) : bmList.length === 0 ? (
                                    <EmptyState icon="fa-regular fa-bookmark" text="북마크한 게시글이 없습니다." />
                                ) : (
                                    <div className={cx('web-table-wrap')}>
                                        <table className={cx('custom-table')}>
                                            <thead>
                                                <tr>
                                                    <th>게시판</th>
                                                    <th>제목</th>
                                                    <th>작성자</th>
                                                    <th>조회 · 추천 · 댓글</th>
                                                    <th>북마크한 날</th>
                                                    <th>관리</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bmList.map((item) => (
                                                    <tr key={item.postBookmarkSeq}>
                                                        <td>
                                                            <span className={cx('badge-pill', item.boardType === 'ANON' && 'pink')}>
                                                                {item.boardType === 'ANON' ? '익명' : item.category}
                                                            </span>
                                                        </td>
                                                        <td style={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/post/detail/${item.postSeq}`)} title="게시글로 이동">
                                                            {item.title}
                                                        </td>
                                                        <td>{item.writerName}</td>
                                                        <td style={{ color: 'var(--text-sub)' }}>{item.viewCount} · {item.recommendCount} · {item.commentCount}</td>
                                                        <td style={{ color: 'var(--text-sub)' }}>{toDateText(item.createdAt)}</td>
                                                        <td>
                                                            <button className={cx('btn-table-action', 'danger')} onClick={() => removeBookmark(item)}>해제</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {bmTotalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
                                        <button className={cx('btn-table-action')} disabled={bmPage <= 1} onClick={() => loadBookmarks(bmPage - 1)}>‹</button>
                                        {Array.from({ length: bmTotalPages }, (_, i) => i + 1).map((n) => (
                                            <button
                                                key={n}
                                                className={cx('btn-table-action')}
                                                style={n === bmPage ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' } : undefined}
                                                onClick={() => loadBookmarks(n)}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                        <button className={cx('btn-table-action')} disabled={bmPage >= bmTotalPages} onClick={() => loadBookmarks(bmPage + 1)}>›</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== [뷰 5] 캘린더 (M012) ==================== */}
                    {view === 'calendar' && (
                        <div className={cx('view-section', 'active')}>
                            <PageHeader icon="fa-calendar-days" title="캘린더" desc="내 일정을 등록, 수정, 삭제하고 관리합니다.">
                                <button className={cx('btn-primary-gradient')} onClick={openScheduleModal}>
                                    <i className={cx('fa-solid', 'fa-plus')}></i> 새 일정 등록
                                </button>
                            </PageHeader>

                            <div className={cx('dash-card')} style={{ marginTop: 20 }}>
                                <div className={cx('cal-container')}>
                                    <div className={cx('cal-box')}>
                                        <div className={cx('cal-header-bar')}>
                                            <button className={cx('btn-secondary')} style={{ padding: '4px 10px' }} onClick={() => moveMonth(-1)}><i className={cx('fa-solid', 'fa-chevron-left')}></i></button>
                                            <span className={cx('cal-title-txt')}>{viewYear}년 {viewMonth + 1}월</span>
                                            <button className={cx('btn-secondary')} style={{ padding: '4px 10px' }} onClick={() => moveMonth(1)}><i className={cx('fa-solid', 'fa-chevron-right')}></i></button>
                                        </div>
                                        <div className={cx('cal-grid-web')}>
                                            {WEEK.map((w) => <div key={w} className={cx('cal-th')}>{w}</div>)}
                                            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} className={cx('cal-td', 'empty')}></div>)}
                                            {Array.from({ length: lastDate }, (_, i) => {
                                                const d = i + 1;
                                                const key = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
                                                const dow = (firstDay + i) % 7;
                                                const cls = ['cal-td'];
                                                if (dow === 0) cls.push('sun');
                                                if (dow === 6) cls.push('sat');
                                                if (key === todayKey) cls.push('today');
                                                if (key === selectedKey) cls.push('active');
                                                if (schedulesOf(key).length) cls.push('has-dot');
                                                return <div key={key} className={cx(...cls)} onClick={() => setSelectedKey(key)}>{d}</div>;
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 style={{ fontSize: '1rem', marginBottom: 14, fontWeight: 700 }}>
                                            {Number(selM)}월 {Number(selD)}일{selectedKey === todayKey ? ' (오늘)' : ''} 일정
                                        </h3>
                                        <div className={cx('schedule-side-list')}>
                                            {selectedList.length
                                                ? selectedList.map((s) => (
                                                    <ScheduleCard
                                                        key={s.id}
                                                        schedule={s}
                                                        onEdit={() => openEditScheduleModal(s)}
                                                        onDelete={() => deleteSchedule(s.id)}
                                                    />
                                                ))
                                                : <EmptyState icon="fa-regular fa-calendar" text="등록된 일정이 없습니다." />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== [뷰 6] 결제 내역 (M010) ==================== */}
                    {view === 'payment' && (
                        <div className={cx('view-section', 'active')}>
                            <PageHeader icon="fa-receipt" title="결제 내역 (M010)" desc="채팅 이용권(P001) 구매 내역 및 마일리지(P002) 사용 내역을 조회합니다." />
                            <div className={cx('dash-card')} style={{ marginTop: 20 }}>
                                <div className={cx('web-table-wrap')}>
                                    <table className={cx('custom-table')}>
                                        <thead>
                                            <tr>
                                                <th>결제 일시</th>
                                                <th>상품명</th>
                                                <th>결제 수단</th>
                                                <th>마일리지 사용</th>
                                                <th>최종 결제 금액</th>
                                                <th>상태</th>
                                                <th>관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentsLoading ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-sub)' }}>
                                                        결제 내역을 불러오는 중입니다...
                                                    </td>
                                                </tr>
                                            ) : payments.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-sub)' }}>
                                                        구매한 결제 내역이 없습니다.
                                                    </td>
                                                </tr>
                                            ) : (
                                                payments.map((p) => {
                                                    const isPaid = p.paymentStatus === 'PAID';
                                                    const statusLabel = isPaid ? '결제완료' : p.paymentStatus === 'CANCELLED' ? '결제취소' : p.paymentStatus;
                                                    return (
                                                        <tr key={p.paymentSeq || p.pgTransactionId}>
                                                            <td>{formatDateTime(p.paidAt || p.createdAt)}</td>
                                                            <td>{p.productName || `채팅 이용권 ${p.ticketCount}개`}</td>
                                                            <td>{formatPayMethod(p.paymentMethod)}</td>
                                                            <td>{p.mileageUsed > 0 ? `-${p.mileageUsed.toLocaleString()}P` : '-'}</td>
                                                            <td>{Number(p.paymentAmount || 0).toLocaleString()}원</td>
                                                            <td>
                                                                <span className={cx(isPaid ? 'status-badge-ok' : 'status-badge-wait')}>
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {isPaid ? (
                                                                    <button
                                                                        type="button"
                                                                        className={cx('btn-cancel-pay')}
                                                                        onClick={() => openCancelModal(p)}
                                                                    >
                                                                        결제취소
                                                                    </button>
                                                                ) : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== [뷰 7] 회원 탈퇴 (M007) - 목업 ==================== */}
                    {view === 'withdraw' && (
                        <div className={cx('view-section', 'active')}>
                            <div className={cx('page-header')}>
                                <div>
                                    <h1 className={cx('page-title')} style={{ color: '#f87171' }}>
                                        <i className={cx('fa-solid', 'fa-triangle-exclamation')}></i> 회원 탈퇴 안내 (M007)
                                    </h1>
                                    <p className={cx('page-subdesc')}>회원 탈퇴 전 유의사항을 반드시 확인해 주시기 바랍니다.</p>
                                </div>
                            </div>
                            <div className={cx('withdraw-alert-card')}>
                                <div className={cx('withdraw-title')}>
                                    <i className={cx('fa-solid', 'fa-circle-exclamation')}></i> 탈퇴 시 잔여 자산 및 데이터 소멸 안내
                                </div>
                                <p className={cx('withdraw-p')}>
                                    1. 회원 탈퇴 시 현재 보유 중인 <strong>채팅 이용권</strong> 및 <strong>마일리지</strong>는 즉시 소멸되며 환불 및 복구가 불가합니다.<br />
                                    2. 기존에 참여했던 1:1 채팅방 및 매칭 기록은 모두 파기 처리됩니다.<br />
                                    3. 작성하신 자유게시판 게시글은 회원 탈퇴 후에도 삭제되지 않으므로, 삭제를 원하시는 경우 탈퇴 전에 직접 삭제해 주시기 바랍니다.
                                </p>
                                <div className={cx('form-group-web')} style={{ marginBottom: 20 }}>
                                    <label className={cx('web-label')} style={{ cursor: 'pointer' }}>
                                        <span>
                                            <input type="checkbox" checked={withdrawCheck} onChange={(e) => setWithdrawCheck(e.target.checked)} style={{ marginRight: 8 }} />
                                            위 유의사항을 모두 확인하였으며 실루엣 회원 탈퇴에 동의합니다.
                                        </span>
                                    </label>
                                </div>
                                <div className={cx('form-group-web')} style={{ maxWidth: 400, marginBottom: 20 }}>
                                    <label className={cx('web-label')}>본인 확인 비밀번호</label>
                                    <input type="password" className={cx('web-input')} value={withdrawPw} onChange={(e) => setWithdrawPw(e.target.value)} placeholder="비밀번호를 입력하세요" />
                                </div>
                                <button
                                    className={cx('btn-secondary')}
                                    style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#f87171', padding: '12px 24px' }}
                                    onClick={handleWithdraw}
                                    disabled={withdrawing}
                                >
                                    {withdrawing ? '탈퇴 처리 중...' : '실루엣 회원 탈퇴 확정'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* ===== 일정 등록 / 수정 모달 ===== */}
            <div className={cx('modal-overlay', modalOpen && 'open')} onClick={(e) => e.target === e.currentTarget && closeScheduleModal()}>
                <div className={cx('modal-window')}>
                    <div className={cx('modal-header')}>
                        <h3 className={cx('modal-title')}>{editingScheduleId !== null ? '일정 수정' : '새 일정 등록'}</h3>
                        <button className={cx('modal-close-btn')} onClick={closeScheduleModal}>&times;</button>
                    </div>
                    <div className={cx('form-group-web')} style={{ gap: 14 }}>
                        <div>
                            <label className={cx('web-label')} style={{ marginBottom: 6 }}>일정 제목</label>
                            <input type="text" className={cx('web-input')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 성수동 카페 약속" />
                        </div>
                        <div>
                            <label className={cx('web-label')} style={{ marginBottom: 6 }}>날짜 및 시간</label>
                            <input type="datetime-local" className={cx('web-input')} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
                        </div>
                        <div>
                            <label className={cx('web-label')} style={{ marginBottom: 6 }}>장소 및 메모</label>
                            <input type="text" className={cx('web-input')} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="예: 성수역 3번 출구" />
                        </div>
                        <button className={cx('btn-primary-gradient')} style={{ marginTop: 10 }} onClick={saveSchedule}>
                            {editingScheduleId !== null ? '수정 저장' : '일정 저장'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== 결제 취소(환불) 팝업 ===== */}
            <div className={cx('modal-overlay', cancelTarget && 'open')} onClick={(e) => e.target === e.currentTarget && closeCancelModal()}>
                <div className={cx('modal-window')}>
                    <div className={cx('modal-header')}>
                        <h3 className={cx('modal-title')}>결제 취소</h3>
                        <button className={cx('modal-close-btn')} onClick={closeCancelModal}>&times;</button>
                    </div>

                    {/* 환불 처리 결과 (팝업 안에 표시) */}
                    {cancelTarget && cancelResult && (
                        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
                            <p style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 22, color: cancelResult.ok ? 'inherit' : '#ef4444' }}>
                                {cancelResult.message}
                            </p>
                            <button className={cx('btn-primary-gradient')} style={{ width: '100%' }} onClick={closeCancelModal}>
                                확인
                            </button>
                        </div>
                    )}

                    {/* 환불 전 결제 정보 + [취소] [환불하기] */}
                    {cancelTarget && !cancelResult && (() => {
                        const reward = Math.floor(Number(cancelTarget.paymentAmount || 0) / 100);
                        const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem' };
                        return (
                            <>
                                <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8px 0', marginBottom: 14 }}>
                                    <div style={rowStyle}>
                                        <span>구매 상품</span>
                                        <strong>{cancelTarget.productName || `채팅 이용권 ${cancelTarget.ticketCount}개`}</strong>
                                    </div>
                                    <div style={rowStyle}>
                                        <span>구매한 이용권</span>
                                        <span>{cancelTarget.ticketCount}개</span>
                                    </div>
                                    <div style={rowStyle}>
                                        <span>결제 일시</span>
                                        <span>{formatDateTime(cancelTarget.paidAt || cancelTarget.createdAt)}</span>
                                    </div>
                                    <div style={rowStyle}>
                                        <span>결제 수단</span>
                                        <span>{formatPayMethod(cancelTarget.paymentMethod)}</span>
                                    </div>
                                    <div style={rowStyle}>
                                        <span>상품 금액</span>
                                        <span>{Number(cancelTarget.productPrice || 0).toLocaleString()}원</span>
                                    </div>
                                    <div style={rowStyle}>
                                        <span>사용한 마일리지</span>
                                        <span>{cancelTarget.mileageUsed > 0 ? `${cancelTarget.mileageUsed.toLocaleString()}P` : '-'}</span>
                                    </div>
                                    <div style={rowStyle}>
                                        <span>결제 금액 (환불 금액)</span>
                                        <strong>{Number(cancelTarget.paymentAmount || 0).toLocaleString()}원</strong>
                                    </div>
                                </div>

                                <div style={{ fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 18, opacity: 0.85 }}>
                                    <div>· 이용권 {cancelTarget.ticketCount}개가 회수됩니다.</div>
                                    {cancelTarget.mileageUsed > 0 && (
                                        <div>· 사용한 마일리지 {cancelTarget.mileageUsed.toLocaleString()}P가 반환됩니다.</div>
                                    )}
                                    {reward > 0 && (
                                        <div>· 적립된 마일리지 {reward.toLocaleString()}P가 회수됩니다.</div>
                                    )}
                                    <div>· 결제 후 7일 이내, 이용권을 사용하지 않은 경우에만 환불할 수 있습니다.</div>
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button
                                        className={cx('btn-secondary')}
                                        style={{ flex: 1, padding: '12px 0' }}
                                        onClick={closeCancelModal}
                                        disabled={cancelProcessing}
                                    >
                                        취소
                                    </button>
                                    <button
                                        className={cx('btn-primary-gradient')}
                                        style={{ flex: 1, padding: '12px 0', background: '#ef4444', color: '#fff' }}
                                        onClick={confirmCancelPayment}
                                        disabled={cancelProcessing}
                                    >
                                        {cancelProcessing ? '환불 처리 중...' : '환불하기'}
                                    </button>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* ===== 토스트 ===== */}
            {toast && <div className={cx('mp-toast')}>{toast}</div>}
        </div>
    );
}

export default MyPage;