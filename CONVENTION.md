# 📏 Silhouette 협업 컨벤션 `작성자:서현수`

팀원 모두가 같은 규칙으로 작업하기 위한 문서입니다.
규칙을 바꾸고 싶으면 팀원과 합의 후 이 문서를 먼저 수정합니다.

## 목차
1. [기본 원칙](#1-기본-원칙)
2. [브랜치 전략](#2-브랜치-전략)
3. [커밋 컨벤션](#3-커밋-컨벤션)
4. [이슈 규칙](#4-이슈-규칙)
5. [PR 규칙](#5-pr-규칙)
6. [작업 흐름](#6-작업-흐름)
7. [네이밍 규칙](#7-네이밍-규칙)
8. [보안 규칙](#8-보안-규칙)
9. [자주 하는 실수 대처법](#9-자주-하는-실수-대처법)

---

## 1. 기본 원칙

- 팀원은 원본 저장소(`dongjin0503/Silhouette`)를 **Fork**해서 작업한다. 원본에 직접 push하지 않는다.
- 원본의 `main` 브랜치에는 **반드시 PR을 통해서만** 합친다.
- **내 fork의 `main`에서는 직접 작업하지 않는다.** `main`은 원본과 동기화용으로만 쓰고, 작업은 항상 작업 브랜치에서 한다.
- 작업 시작 전 **이슈를 먼저 만든다.**
- 작업 시작 전에 **항상 내 fork를 `Sync fork`로 최신화**하고 로컬로 pull 받는다.
- 모르겠으면 혼자 끙끙대지 말고 바로 팀원에게 물어본다.
- 서로의 코드를 비판하지 않고 **코드에 대해서만** 이야기한다.

---

## 2. 브랜치 전략

### 브랜치 구조

`develop` 브랜치는 만들지 않고, **`main` + 작업 브랜치** 두 종류로만 운영한다.

| 브랜치 | 위치 | 역할 |
|---|---|---|
| `main` | 원본 저장소 | 항상 실행 가능한 상태. 완성된 기능이 PR로 모이는 곳 |
| `feat/*` 등 | **각자의 fork** | 개인 작업 브랜치. `main`에서 따서 작업 |

```
원본 main  ──●─────●─────●─────●──
              \    ↑     ↑
               \   PR    PR
내 fork          ●──●    ●──●
               feat/C1   fix/C2
```

### 브랜치 이름 규칙

형식: `type/요구사항ID-기능명` (영어, 단어 구분은 `-`)

- 앞의 ID는 **기능정의서의 요구사항ID**를 **정의서 표기 그대로** 쓴다. (예: `C1`, `C2`) 이 부분만 **대문자를 허용**하고, 나머지(type, 기능명)는 소문자로 쓴다.
- GitHub 이슈 번호와는 다를 수 있다. 연결 방법은 [4. 이슈 규칙](#4-이슈-규칙) 참고
- 기능정의서에 없는 작업(설정, 문서, 리팩터링 등)은 ID 자리에 `etc`를 쓴다. 예: `chore/etc-project-setup`

| type | 용도 | 예시 |
|---|---|---|
| `feat` | 새 기능 개발 | `feat/C1-blind-matching` |
| `fix` | 버그 수정 | `fix/C2-login-error` |
| `refactor` | 코드 구조 개선 | `refactor/C3-member-service` |
| `docs` | 문서 작업 | `docs/etc-readme` |
| `chore` | 설정, 빌드, 패키지 | `chore/etc-project-setup` |
| `hotfix` | 급하게 고쳐야 하는 오류 | `hotfix/C4-db-connection` |

> ❌ `feat/내가만든기능`, `Feat/Matching`, `test`, `jin-work`
> ⭕ `feat/C1-blind-matching`

### 브랜치 관리

- 작업 브랜치는 **기능 하나당 하나**. 여러 기능을 한 브랜치에 섞지 않는다.
- 작업 브랜치는 항상 **최신 `main`에서** 새로 딴다.
- PR이 머지되면 내 fork의 작업 브랜치는 **삭제**한다. (PR이 열려 있는 동안에는 삭제하지 않는다)
- 브랜치 수명은 길어도 **3일**. 오래 끌수록 충돌이 커진다.

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
| `hotfix` | 급한 오류 긴급 수정 | `hotfix: DB 접속 오류 긴급 수정` |
| `refactor` | 동작 변화 없는 코드 개선 | `refactor: 매칭 서비스 중복 코드 제거` |
| `style` | 포맷, 들여쓰기, 세미콜론 등 (로직 변경 X) | `style: 코드 들여쓰기 정리` |
| `docs` | 문서 수정 | `docs: README 실행 방법 추가` |
| `test` | 테스트 코드 추가/수정 | `test: 매칭 서비스 단위 테스트 추가` |
| `chore` | 빌드, 설정, 패키지, .gitignore 등 | `chore: MySQL 의존성 추가` |
| `design` | CSS, UI 디자인 수정 | `design: 프로필 카드 레이아웃 수정` |
| `rename` | 파일/폴더명 변경 | `rename: MatchDao를 MatchDAO로 변경` |
| `remove` | 파일 삭제 | `remove: 사용하지 않는 테스트 파일 삭제` |

### 커밋 규칙

- 커밋은 **되도록 한 가지 목적**으로 나눈다. 기능 작업 중 발견한 사소한 오타 수정은 같은 커밋에 포함해도 된다.
- 기능과 관계없는 큰 수정(설정 변경, 다른 기능 수정)은 따로 커밋한다.
- 작업이 끝나기 전에도 의미 단위로 자주 커밋한다.
- `수정`, `ㅇㅇ`, `fix`, `test`, `asdf` 같은 의미 없는 메시지 금지.
- 빌드/실행이 **깨지는 상태로 커밋하지 않는다.**
- **push한 커밋은 `--amend`로 고치지 않는다.** 고칠 게 있으면 새 커밋을 추가한다. (squash되므로 커밋이 늘어나도 괜찮다)

> ❌ `수정`, `feat: 이것저것 추가함`
> ⭕ `feat: 채팅방 시간제한 타이머 구현`

---

## 4. 이슈 규칙

### 원칙

- **작업 시작 전에 이슈를 먼저 만든다.**
- 한 이슈는 **하루~3일 안에 끝낼 수 있는 크기**로 쪼갠다.
- 담당자(Assignees)를 반드시 지정한다.
- 이슈 템플릿(`✨ 기능 개발`, `🐛 버그 리포트`)을 사용한다. 템플릿 파일은 `.github/ISSUE_TEMPLATE/`에 둔다.

### 이슈 제목 형식

```
[Type] 요구사항ID 작업 내용
```

예: `[Feat] C1 블라인드 랜덤 매칭 구현`, `[Fix] C2 프로필 사진 업로드 오류`
기능정의서에 없는 작업: `[Chore] etc 프로젝트 초기 세팅`

### 요구사항ID와 이슈 번호의 관계

| 구분 | 어디서 오는가 | 어디에 쓰는가 |
|---|---|---|
| 요구사항ID (`C1`) | 기능정의서 | 브랜치 이름, 이슈 제목 |
| 이슈 번호(`#7`) | GitHub가 자동 부여 | PR의 `closes #7` |

> 두 값은 **서로 다르다.** 이슈 제목에 요구사항ID를 적어두면 서로 찾아가기 쉽다.

---

## 5. PR 규칙

### PR 만드는 법

- **base**: 원본 `dongjin0503/Silhouette`의 `main` ← **compare**: 내 fork의 작업 브랜치
- 제목은 커밋 컨벤션과 동일하게: `feat: 블라인드 랜덤 매칭 구현`
- PR 템플릿을 빠짐없이 채운다. 템플릿 파일은 `.github/pull_request_template.md`에 둔다.
- 관련 이슈를 **GitHub 이슈 번호**로 연결한다: `closes #7` (머지되면 이슈 자동 종료)
- Reviewer와 Assignee를 지정한다.

### 리뷰 규칙

- **최소 1명 이상**의 승인(Approve)을 받아야 머지할 수 있다.
- 리뷰 요청을 받으면 **되도록 하루 안에** 확인한다.
- 리뷰는 코드에 대해 정중하게 남긴다.
  - ⭕ `이 부분 null 체크를 추가하면 어떨까요?`
  - ❌ `이거 왜 이렇게 짰어요?`
- 수정 요청이 있으면 같은 브랜치에 추가 커밋으로 반영한다.

### 머지 규칙

- 머지는 **GIT 담당자 서현수**가 진행한다. (승인 1명 이상 확인 후)
- GIT 담당자 본인의 PR은 **다른 팀원 1명 이상의 승인**을 받은 뒤 본인이 머지한다.
- 충돌(Conflict)이 있으면 PR 작성자가 **머지 전에 해결**한다.
- 머지 방식은 **Squash and merge** 로 통일한다. (아래 설명 참고)
- 머지 후 내 fork의 작업 브랜치를 삭제하고, **내 fork의 `main`을 원본과 동기화**한다.

#### 💡 Squash and merge란?

PR 안에 커밋이 여러 개여도 **하나로 합쳐서** `main`에 넣는 방식이다.

```
내 브랜치 커밋: feat: 매칭 구현 / 오타 수정 / 수정 / 로직 수정   (4개)
        ↓ Squash and merge
원본 main:     feat: 블라인드 랜덤 매칭 구현 (#7)             (1개)
```

- `main` 히스토리가 "기능 1개 = 커밋 1개"로 깔끔해진다.
- 작업 중 커밋이 다소 지저분해도 괜찮다. (작업 중 `git merge main`으로 생긴 머지 커밋도 squash되므로 상관없다)
- 개별 커밋 기록은 `main`에서는 사라지지만, PR 페이지에는 그대로 남는다.
- 머지한 브랜치를 계속 재사용하면 충돌이 생기기 쉬우므로, **머지 후에는 브랜치를 삭제**한다.
- 선택 위치: PR 하단 초록 머지 버튼 옆 **▼** → **Squash and merge**

### PR 크기

- 한 PR은 **기능 하나**만 담는다.
- 변경 파일이 너무 많으면 (대략 20개 이상) 쪼개서 올린다.

---

## 6. 작업 흐름

### 처음 한 번만 (초기 세팅)

```bash
# 1. GitHub에서 원본 저장소(dongjin0503/Silhouette)를 Fork

# 2. 내 fork를 clone
git clone https://github.com/내아이디/Silhouette.git
cd Silhouette
```

### 전체 흐름

```
이슈 생성 → Sync fork → 브랜치 생성 → 작업/커밋 → 내 fork로 push → 원본에 PR → 리뷰 → 머지 → Sync fork → 브랜치 삭제
```

### 🔄 Sync fork (원본 최신 내용 받아오기)

fork는 만든 시점의 복사본이라, 원본이 바뀌어도 **자동으로 따라오지 않는다.** 그래서 작업 전에 직접 동기화한다.

1. GitHub에서 **내 fork 저장소** 페이지로 이동
2. 파일 목록 위쪽의 **`Sync fork`** 버튼 클릭
3. **`Update branch`** 클릭
4. 내 컴퓨터(로컬)에도 반영한다.

```bash
git checkout main
git pull origin main
```

> ⚠️ `Sync fork`는 **GitHub에 있는 내 fork만** 최신으로 만든다. 로컬에는 `git pull origin main`을 꼭 해줘야 한다.
> ⚠️ 버튼에 "This branch is up to date" 라고 나오면 이미 최신이라 할 일이 없다.
> ⚠️ fork의 `main`에 직접 커밋하면 Sync가 꼬인다. 그래서 `main`에서는 작업하지 않는다.

### 작업할 때마다

```bash
# 1. (위의 Sync fork 먼저 하고) 로컬 main 최신화
git checkout main
git pull origin main

# 2. 작업 브랜치 만들기 (요구사항ID 포함)
git checkout -b feat/C1-blind-matching

# 3. 작업 후 커밋
git add .
git commit -m "feat: 블라인드 랜덤 매칭 구현"

# 4. 내 fork로 push
git push origin feat/C1-blind-matching

# 5. GitHub에서 PR 생성
#    내 fork의 feat/C1-blind-matching → 원본의 main
```

### 작업 중에 원본이 바뀌었다면

다른 팀원의 PR이 머지되어 원본 `main`이 바뀌면, 내 브랜치에도 그 내용을 합쳐서 **PR 올리기 전에 충돌을 미리 해결**한다.

```bash
# 1. GitHub에서 Sync fork → Update branch
# 2. 로컬 main 최신화
git checkout main
git pull origin main

# 3. 내 작업 브랜치로 돌아와서 main 내용 합치기
git checkout feat/C1-blind-matching
git merge main
```

> 💡 `rebase`는 push 시 force가 필요해서 사용하지 않는다. `merge main`을 쓴다.

### PR이 머지된 후

1. GitHub에서 **Sync fork → Update branch** (내 fork의 `main`이 원본과 같아짐)
2. 로컬 정리

```bash
git checkout main
git pull origin main

# 다 쓴 작업 브랜치 삭제
git branch -D feat/C1-blind-matching
git push origin --delete feat/C1-blind-matching
```

> 💡 PR 머지 직후 PR 페이지에 뜨는 **`Delete branch`** 버튼으로 fork의 브랜치를 지워도 된다. 이 경우 로컬 브랜치(`git branch -D`)만 지우면 된다.
> ⚠️ Squash and merge는 커밋이 새로 만들어지는 방식이라 `git branch -d`는 "머지 안 됨"으로 거부될 수 있다. PR이 머지된 걸 확인했다면 `-D`로 삭제한다.

### 하루 작업 루틴

- **작업 시작 전**: Sync fork → `git pull origin main` → 작업 브랜치로 이동
- **작업 종료 전**: 커밋 & 내 fork로 push (로컬에만 두지 않는다)

### 충돌(Conflict) 발생 시

1. 당황하지 않는다.
2. 충돌 난 파일을 열어 `<<<<<<<`, `=======`, `>>>>>>>` 부분을 확인한다.
3. 상대방 코드를 지우지 말고, **작성한 팀원과 상의**해서 합친다.
4. 해결 후 `git add` → `git commit` 한다.

---

## 7. 네이밍 규칙

### 7-1. 클래스 이름

계층별 접미사는 **앞글자 대문자**로 통일한다. (`Dao`, `Dto` ❌ → `DAO`, `DTO` ⭕)

| 계층 | 접미사 | 예시 |
|---|---|---|
| Controller | `Controller` | `MatchingController` |
| Service | `Service` | `MatchingService` |
| DAO | `DAO` | `MatchingDAO` |
| DTO | `DTO` | `ProfileDTO` |
| Entity / VO | 도메인 이름 | `Member`, `Matching` |

### 7-2. DB 네이밍

- 테이블, 컬럼: **snake_case, 소문자**
- 테이블명은 **단수형** 통일 → `file`, `reply`
- PK는 `seq`, FK는 `대상테이블_seq` (예: `member_seq`)
- 시퀀스 이름은 `seq_테이블명`으로 통일 (예: `seq_member`, `seq_match_history`)
- 생성/수정 시간 컬럼: `created_at`, `updated_at`
- **DB 예약어는 테이블/컬럼명으로 쓰지 않는다.** (`user`, `match`, `order`, `group`, `comment` 등 → `member`, `matching`, `orders` 등으로 대체)

예: `member`, `match_history`, `chat_room`

### 7-3. 자바 코드 기본 규칙

- 클래스: `PascalCase` / 변수, 메서드: `camelCase`
- 패키지: 소문자만 (예: `com.silhouette.match`)
- 들여쓰기는 팀 IDE 설정에 맞추고, 임의로 포맷터를 바꾸지 않는다. (포맷만 바뀐 큰 변경은 `style:` 커밋으로 따로 올린다)

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
| push한 커밋을 고치고 싶다 | amend 금지. 새 커밋을 추가한다 (squash되므로 OK) |
| 마지막 커밋을 취소하고 싶다 (변경 내용 유지) | `git reset --soft HEAD~1` |
| 엉뚱한 브랜치에서 작업했다 | `git stash` → 올바른 브랜치로 이동 → `git stash pop` |
| 작업하던 걸 잠깐 치워두고 싶다 | `git stash` / 복구는 `git stash pop` |
| 파일 하나의 변경을 되돌리고 싶다 | `git restore 파일명` |
| 내 fork가 원본보다 뒤처졌다 | GitHub에서 `Sync fork` → `Update branch` 후, 로컬에서 `git pull origin main` |
| fork의 `main`에 실수로 커밋했다 | 혼자 해결하지 말고 팀(GIT 담당자)에게 먼저 공유 |
| 이미 push한 커밋을 되돌려야 한다 | 혼자 판단하지 말고 **팀에 먼저 공유** 후 `git revert` |

> ⚠️ **`git push --force` 는 사용 금지.** 팀원의 작업이 날아갈 수 있다.
> ⚠️ **`git reset --hard`** 는 변경 내용이 완전히 사라지니 신중하게.

---

## 📝 변경 이력

| 날짜 | 내용 | 작성자 |
|---|---|---|
| 2026.11.11 | 최초 작성 | 서현수|
| 2026.11.11 | 라벨 삭제, 커밋/머지 규칙 수정, Squash and merge 설명 추가, 네이밍 규칙(7번)만 남기고 코드 컨벤션 정리 | 서현수|
| 2026.11.11 | DB 네이밍 수정(FK `_seq`, 시퀀스명 규칙), fork main 작업 금지, 요구사항ID↔이슈번호 규칙, 본인 PR 머지 규칙, push 후 amend 금지, 템플릿 경로, 자바 코드 기본 규칙, DB 예약어 규칙 추가 | 서현수|
| 2026.11.11 | 요구사항ID(C1 등) 대문자 허용, 브랜치·이슈 제목 예시를 요구사항ID 형식으로 변경 | 서현수|
