# 📏 Silhouette 협업 컨벤션

팀원 모두가 같은 규칙으로 작업하기 위한 문서입니다.
규칙을 바꾸고 싶으면 팀원과 합의 후 이 문서를 먼저 수정합니다.

## 목차
1. [기본 원칙](#1-기본-원칙)
2. [브랜치 전략](#2-브랜치-전략)
3. [커밋 컨벤션](#3-커밋-컨벤션)
4. [이슈 규칙](#4-이슈-규칙)
5. [PR 규칙](#5-pr-규칙)
6. [작업 흐름](#6-작업-흐름)
7. [코드 컨벤션](#7-코드-컨벤션)
8. [보안 규칙](#8-보안-규칙)
9. [자주 하는 실수 대처법](#9-자주-하는-실수-대처법)

---

## 1. 기본 원칙

- `main`, `develop` 브랜치에 **직접 push 금지**. 반드시 PR을 통해 합친다.
- 작업 시작 전 **이슈를 먼저 만든다.**
- 작업 시작 전 **항상 최신 `develop`을 pull** 받는다.
- 모르겠으면 혼자 끙끙대지 말고 바로 팀원에게 물어본다.
- 서로의 코드를 비판하지 않고 **코드에 대해서만** 이야기한다.

---

## 2. 브랜치 전략

### 브랜치 구조

| 브랜치 | 역할 | 직접 push |
|---|---|---|
| `main` | 최종 제출/배포용. 항상 실행 가능한 상태 | ❌ |
| `develop` | 개발 통합 브랜치. 기능이 모이는 곳 | ❌ |
| `feat/*` 등 | 개인 작업 브랜치. `develop`에서 따서 작업 | ⭕ |

```
main      ──●─────────────────────●──  (릴리즈 시점에만 merge)
            \                     /
develop   ───●───●───●───●───●───●────
                  \     /
feat/12-matching   ●───●
```

### 브랜치 이름 규칙

형식: `type/이슈번호-기능명` (영어 소문자, 단어 구분은 `-`)

| type | 용도 | 예시 |
|---|---|---|
| `feat` | 새 기능 개발 | `feat/12-blind-matching` |
| `fix` | 버그 수정 | `fix/25-login-error` |
| `refactor` | 코드 구조 개선 | `refactor/30-user-service` |
| `docs` | 문서 작업 | `docs/5-readme` |
| `chore` | 설정, 빌드, 패키지 | `chore/3-project-setup` |
| `hotfix` | `main`의 긴급 수정 | `hotfix/40-db-connection` |

> ❌ `feat/내가만든기능`, `Feat/Matching`, `test`, `jin-work`
> ⭕ `feat/12-blind-matching`

### 브랜치 관리

- 작업 브랜치는 **기능 하나당 하나**. 여러 기능을 한 브랜치에 섞지 않는다.
- PR이 머지되면 작업 브랜치는 **삭제**한다.
- 브랜치 수명은 길어도 **3~4일**. 오래 끌수록 충돌이 커진다.

---

## 3. 커밋 컨벤션

### 형식

```
type: 제목

본문 (선택)
```

- 제목은 **50자 이내**, 마침표 없이, 무엇을 했는지 간결하게.
- 본문은 **왜 바꿨는지**가 필요할 때만 작성한다.
- 한국어로 작성한다.

### type 목록

| type | 용도 | 예시 |
|---|---|---|
| `feat` | 새 기능 추가 | `feat: 블라인드 랜덤 매칭 구현` |
| `fix` | 버그 수정 | `fix: 로그인 시 세션 만료 오류 수정` |
| `refactor` | 동작 변화 없는 코드 개선 | `refactor: 매칭 서비스 중복 코드 제거` |
| `style` | 포맷, 들여쓰기, 세미콜론 등 (로직 변경 X) | `style: 코드 들여쓰기 정리` |
| `docs` | 문서 수정 | `docs: README 실행 방법 추가` |
| `test` | 테스트 코드 추가/수정 | `test: 매칭 서비스 단위 테스트 추가` |
| `chore` | 빌드, 설정, 패키지, .gitignore 등 | `chore: MySQL 의존성 추가` |
| `design` | CSS, UI 디자인 수정 | `design: 프로필 카드 레이아웃 수정` |
| `rename` | 파일/폴더명 변경 | `rename: UserDao를 UserRepository로 변경` |
| `remove` | 파일 삭제 | `remove: 사용하지 않는 테스트 파일 삭제` |

### 커밋 규칙

- **한 커밋에는 한 가지 작업만** 담는다. (기능 + 오타 수정 + 설정 변경을 한 번에 X)
- 작업이 끝나기 전에도 의미 단위로 자주 커밋한다.
- `수정`, `ㅇㅇ`, `fix`, `test`, `asdf` 같은 의미 없는 메시지 금지.
- 빌드/실행이 **깨지는 상태로 커밋하지 않는다.**

> ❌ `수정`, `feat: 이것저것 추가함`
> ⭕ `feat: 채팅방 시간제한 타이머 구현`

---

## 4. 이슈 규칙

### 원칙

- **작업 시작 전에 이슈를 먼저 만든다.** 이슈 번호가 브랜치 이름과 PR의 기준이 된다.
- 한 이슈는 **하루~3일 안에 끝낼 수 있는 크기**로 쪼갠다.
- 담당자(Assignees)를 반드시 지정한다.
- 이슈 템플릿(`✨ 기능 개발`, `🐛 버그 리포트`)을 사용한다.

### 이슈 제목 형식

```
[Type] 작업 내용
```

예: `[Feat] 블라인드 랜덤 매칭 구현`, `[Fix] 프로필 사진 업로드 오류`

### 라벨

| 라벨 | 의미 |
|---|---|
| `feature` | 새 기능 |
| `bug` | 버그 |
| `refactor` | 리팩토링 |
| `docs` | 문서 |
| `chore` | 설정/기타 |
| `help wanted` | 도움이 필요함 |

---

## 5. PR 규칙

### PR 만드는 법

- **base**: `develop` ← **compare**: 내 작업 브랜치
- 제목은 커밋 컨벤션과 동일하게: `feat: 블라인드 랜덤 매칭 구현`
- PR 템플릿을 빠짐없이 채운다.
- 관련 이슈를 연결한다: `closes #12` (머지되면 이슈 자동 종료)
- Reviewer와 Assignee를 지정한다.

### 리뷰 규칙

- **최소 1명 이상**의 승인(Approve)을 받아야 머지할 수 있다.
- 리뷰 요청을 받으면 **되도록 하루 안에** 확인한다.
- 리뷰는 코드에 대해 정중하게 남긴다.
  - ⭕ `이 부분 null 체크를 추가하면 어떨까요?`
  - ❌ `이거 왜 이렇게 짰어요?`
- 수정 요청이 있으면 같은 브랜치에 추가 커밋으로 반영한다.

### 머지 규칙

- 머지는 **PR 작성자 본인**이 승인 후 진행한다.
- 머지 방식은 **Squash and merge** 로 통일한다. (히스토리가 깔끔해진다)
- 머지 전 충돌(Conflict)이 없어야 한다.
- 머지 후 작업 브랜치를 삭제한다.

### PR 크기

- 한 PR은 **기능 하나**만 담는다.
- 변경 파일이 너무 많으면 (대략 20개 이상) 쪼개서 올린다.

---

## 6. 작업 흐름

### 전체 흐름

```
이슈 생성 → 브랜치 생성 → 작업/커밋 → push → PR 생성 → 리뷰 → 머지 → 브랜치 삭제
```

### 명령어 순서

```bash
# 1. 최신 develop 받기
git checkout develop
git pull origin develop

# 2. 작업 브랜치 만들기 (이슈 번호 포함)
git checkout -b feat/12-blind-matching

# 3. 작업 후 커밋
git add .
git commit -m "feat: 블라인드 랜덤 매칭 구현"

# 4. push 전에 develop 최신 내용 반영 (충돌 미리 해결)
git pull origin develop

# 5. push
git push origin feat/12-blind-matching

# 6. GitHub에서 PR 생성 (base: develop)
```

### 하루 작업 루틴

- **작업 시작 전**: `git checkout develop` → `git pull origin develop` → 작업 브랜치로 이동 후 `git merge develop`
- **작업 종료 전**: 커밋 & push (로컬에만 두지 않는다)

### 충돌(Conflict) 발생 시

1. 당황하지 않는다.
2. 충돌 난 파일을 열어 `<<<<<<<`, `=======`, `>>>>>>>` 부분을 확인한다.
3. 상대방 코드를 지우지 말고, **작성한 팀원과 상의**해서 합친다.
4. 해결 후 `git add` → `git commit` 한다.

---

## 7. 코드 컨벤션

> 아래 값은 기본 제안입니다. 팀에서 정한 내용이 있으면 수정하세요.

### 7-1. 공통

- 들여쓰기는 **스페이스 4칸** (탭 사용 X)
- 한 줄은 **120자 이내**
- 파일 인코딩은 **UTF-8**
- 사용하지 않는 코드, 주석 처리된 코드, `System.out.println` 디버깅 출력은 **커밋 전에 제거**한다.
- 주석은 **"무엇"이 아니라 "왜"** 를 적는다.

### 7-2. Java 네이밍

| 대상 | 규칙 | 예시 |
|---|---|---|
| 클래스, 인터페이스 | PascalCase | `MatchService`, `UserController` |
| 메서드, 변수 | camelCase | `findUserById`, `matchCount` |
| 상수 | UPPER_SNAKE_CASE | `MAX_CHAT_MINUTES` |
| 패키지 | 소문자 | `com.silhouette.match` |
| boolean | `is`, `has`로 시작 | `isBlind`, `hasPhoto` |

- 메서드는 **동사로 시작**한다. (`getUser`, `saveProfile`, `deleteMatch`)
- 의미 없는 이름(`a`, `temp`, `data1`) 금지. 반복문 인덱스(`i`)만 예외.
- 약어는 되도록 쓰지 않는다.

### 7-3. 계층/클래스 이름 규칙

| 계층 | 접미사 | 예시 |
|---|---|---|
| Controller | `Controller` | `MatchController` |
| Service | `Service` | `MatchService` |
| Repository / DAO | `Repository` 또는 `Dao` | `MatchRepository` |
| DTO | `Dto` | `ProfileDto` |
| Entity / VO | 도메인 이름 | `User`, `Match` |

> 팀에서 Repository / Dao 중 **하나로 통일**한다. → `______`

### 7-4. 패키지 구조 (제안)

```
com.silhouette
├── user        (회원, 프로필, 인증)
│   ├── controller
│   ├── service
│   ├── repository
│   └── dto
├── match       (블라인드/비블라인드 매칭)
├── chat        (채팅, 그룹채팅)
├── map         (지도 기반 찾기)
└── common      (공통 유틸, 예외, 설정)
```

기능(도메인) 단위로 나누고, 그 안에서 계층을 나눈다.

### 7-5. DB 네이밍

- 테이블, 컬럼: **snake_case, 소문자**
- 테이블명은 **단수형** 또는 **복수형** 중 하나로 통일 → `______`
- PK는 `id`, FK는 `대상테이블_id` (예: `user_id`)
- 생성/수정 시간 컬럼: `created_at`, `updated_at`

예: `user`, `match_history`, `chat_room`

### 7-6. URL(API) 규칙

- **소문자, 하이픈(-)** 사용, 명사 중심
- 동작은 URL이 아니라 HTTP 메서드로 표현

| 동작 | 메서드 | 예시 |
|---|---|---|
| 조회 | GET | `GET /api/profiles/3` |
| 등록 | POST | `POST /api/matches` |
| 수정 | PUT/PATCH | `PATCH /api/profiles/3` |
| 삭제 | DELETE | `DELETE /api/matches/5` |

> 팀에서 REST 방식이 아닌 `.do` 방식(MPA)을 쓰면 이 부분은 팀 규칙에 맞게 수정한다.

### 7-7. 프론트엔드 (HTML/CSS/JS)

- 파일명: 소문자, 단어는 `-` 로 구분 (`match-list.html`)
- CSS 클래스명: 소문자, `-` 로 구분 (`profile-card`)
- JS 변수/함수: camelCase
- 인라인 스타일(`style=""`)은 되도록 쓰지 않는다.

---

## 8. 보안 규칙

- **비밀번호, API 키, DB 접속 정보는 절대 커밋하지 않는다.**
  - 한 번 올라가면 히스토리에 영원히 남는다. 지워도 소용없다.
- `application.properties`(또는 `.yml`)는 `.gitignore`에 추가하고,
  대신 `application.properties.example` 파일을 올려 **항목 이름만** 공유한다.
- 실수로 올렸다면 **즉시 팀에 알리고**, 해당 키/비밀번호를 **폐기 후 재발급**한다.
- 개인정보(실제 이름, 전화번호, 사진)는 테스트 데이터에 쓰지 않는다. (소개팅 서비스이므로 특히 주의)

---

## 9. 자주 하는 실수 대처법

| 상황 | 해결 |
|---|---|
| 커밋 메시지를 잘못 썼다 (아직 push 전) | `git commit --amend -m "새 메시지"` |
| 마지막 커밋을 취소하고 싶다 (변경 내용 유지) | `git reset --soft HEAD~1` |
| 엉뚱한 브랜치에서 작업했다 | `git stash` → 올바른 브랜치로 이동 → `git stash pop` |
| 작업하던 걸 잠깐 치워두고 싶다 | `git stash` / 복구는 `git stash pop` |
| 파일 하나의 변경을 되돌리고 싶다 | `git restore 파일명` |
| 이미 push한 커밋을 되돌려야 한다 | 혼자 판단하지 말고 **팀에 먼저 공유** 후 `git revert` |

> ⚠️ **`git push --force` 는 사용 금지.** 팀원의 작업이 날아갈 수 있다.
> ⚠️ **`git reset --hard`** 는 변경 내용이 완전히 사라지니 신중하게.

---

## 📝 변경 이력

| 날짜 | 내용 | 작성자 |
|---|---|---|
| 2026.11.11 | 최초 작성 | |
