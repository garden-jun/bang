# BANG! 온라인 — 설계 문서

## 0. 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 스택 | Next.js (App Router) + TypeScript + Tailwind |
| 호스팅 | Vercel |
| DB | Upstash Redis (Vercel Marketplace, 무료 티어) |
| 실시간 | 클라이언트 짧은 폴링 (1~2초), 상태 버전 비교 |
| 카드 범위 | 기본판만 (캐릭터 16, 카드 80, 4~7인) |
| 인증 | 닉네임 + 브라우저 토큰(localStorage), 로그인 없음 |
| 방 | 공개 목록 + 6자리 코드 입장, 비공개 방은 코드로만 |
| 관전 | 방장이 "공개 정보만 / 전체 공개" 선택 |
| 타이머 | 턴 60초(방장 조절), 초과 시 자동 진행 |
| 재접속 | 같은 브라우저면 토큰으로 자동 복귀 |

---

## 1. 게임 규칙 (기본판)

### 1.1 역할

| 인원 | 보안관 | 부관 | 무법자 | 배신자 |
|---|---|---|---|---|
| 4 | 1 | 0 | 2 | 1 |
| 5 | 1 | 1 | 2 | 1 |
| 6 | 1 | 1 | 3 | 1 |
| 7 | 1 | 2 | 3 | 1 |

- 보안관만 역할 공개. 나머지는 사망 시 공개.
- 보안관은 생명 +1.
- **승리 조건**
  - 보안관·부관: 무법자와 배신자 전원 사망
  - 무법자: 보안관 사망 (단, 배신자가 마지막 생존자이면 배신자 승)
  - 배신자: 자신이 마지막 생존자
- 무법자를 죽이면 (누가 죽였든) 카드 3장 드로우. 보안관이 부관을 죽이면 손패·장착 전부 버림.

### 1.2 캐릭터 (16)

| 이름 | 생명 | 능력 |
|---|---|---|
| Bart Cassidy | 4 | 피해 1당 카드 1장 드로우 |
| Black Jack | 4 | 드로우 단계 2번째 카드 공개, 하트/다이아면 1장 추가 |
| Calamity Janet | 4 | BANG!과 Missed! 상호 대체 사용 가능 |
| El Gringo | 3 | 피해 입힌 플레이어의 손패에서 1장 가져옴 |
| Jesse Jones | 4 | 드로우 첫 장을 다른 플레이어 손패에서 가져올 수 있음 |
| Jourdonnais | 4 | 내장 Barrel |
| Kit Carlson | 4 | 드로우 시 3장 보고 2장 선택 |
| Lucky Duke | 4 | "뽑기 판정" 시 2장 뽑아 유리한 쪽 선택 |
| Paul Regret | 3 | 내장 Mustang (거리 +1) |
| Pedro Ramirez | 4 | 드로우 첫 장을 버림 더미 맨 위에서 가져올 수 있음 |
| Rose Doolan | 4 | 내장 Scope (거리 -1) |
| Sid Ketchum | 4 | 카드 2장 버리고 생명 1 회복 (언제든) |
| Slab the Killer | 4 | 그의 BANG!을 막으려면 Missed! 2장 |
| Suzy Lafayette | 4 | 손패 0장 되면 즉시 1장 드로우 |
| Vulture Sam | 4 | 사망한 플레이어의 카드 전부 획득 |
| Willy the Kid | 4 | BANG! 무제한 |

### 1.3 카드 (80)

**액션 카드 (63)**

| 카드 | 수 | 효과 |
|---|---|---|
| BANG! | 25 | 사거리 내 1명에게 피해 1. 턴당 1장 (Volcanic/Willy 예외) |
| Missed! | 12 | BANG! 무효 |
| Beer | 6 | 생명 1 회복. 2인 남으면 무효. 죽을 때 자동 사용 가능 |
| Panic! | 4 | 거리 1 대상의 카드 1장 가져옴 |
| Cat Balou | 4 | 아무 플레이어 카드 1장 버리게 함 |
| Stagecoach | 2 | 2장 드로우 |
| Wells Fargo | 1 | 3장 드로우 |
| General Store | 2 | 생존자 수만큼 공개, 시계방향 순으로 1장씩 선택 |
| Indians! | 2 | 자신 제외 전원 BANG! 내거나 피해 1 |
| Duel | 3 | 대상과 번갈아 BANG! 내기, 못 내면 피해 1 |
| Gatling | 1 | 자신 제외 전원에게 BANG! (Missed!로 막음) |
| Saloon | 1 | 전원 생명 1 회복 |

**장착 카드 (17)** — 같은 이름은 중복 장착 불가, 무기는 1개만

| 카드 | 수 | 효과 |
|---|---|---|
| Barrel | 2 | BANG! 맞을 때 뽑기 판정, 하트면 무효 |
| Scope | 1 | 남을 볼 때 거리 -1 |
| Mustang | 2 | 남이 나를 볼 때 거리 +1 |
| Jail | 3 | 보안관 외 대상. 턴 시작 시 뽑기 판정, 하트면 탈출, 아니면 턴 스킵. 판정 후 버림 |
| Dynamite | 1 | 턴 시작 시 뽑기 판정, ♠2~9면 피해 3, 아니면 왼쪽 플레이어에게 이동 |
| Volcanic | 2 | 사거리 1, BANG! 무제한 |
| Schofield | 3 | 사거리 2 |
| Remington | 1 | 사거리 3 |
| Rev. Carabine | 1 | 사거리 4 |
| Winchester | 1 | 사거리 5 |

각 카드는 무늬(♠♥♦♣)와 숫자(A~K)를 가진다. 뽑기 판정은 덱 맨 위 카드 공개 → 버림.

### 1.4 턴 진행

1. **턴 시작 판정** (장착 순서: Dynamite → Jail)
2. **드로우**: 2장 (캐릭터별 변형)
3. **플레이**: 카드 제한 없이 사용. BANG!은 1장 제한
4. **버리기**: 손패를 현재 생명 수 이하로

거리 = 시계/반시계 중 짧은 쪽 좌석 차이 (사망자 제외) ± Mustang/Scope 보정. 사거리 = 무기 사거리 (기본 1).

---

## 2. 아키텍처

```
브라우저 ──(폴링 GET /api/rooms/:code/state?since=v)──▶ Next.js Route Handler ──▶ Upstash Redis
         ──(POST /api/rooms/:code/action)────────────▶  게임 엔진 (순수 함수)   ◀──
```

- **게임 엔진은 순수 함수** `reduce(state, action, rng) → state'`. 서버에서만 실행. 테스트하기 쉽고, 클라이언트엔 절대 전체 상태를 내보내지 않음.
- **Route Handler**가 (1) 토큰 검증 (2) Redis 락 획득 (3) 상태 로드 (4) 타이머 만료 처리 (5) 엔진 실행 (6) 저장 (7) 요청자 관점으로 가린(redacted) 뷰 반환.
- **폴링**: 클라이언트는 `since=version`으로 요청. 버전이 같으면 `304 Not Modified`(본문 없음)로 응답해 대역폭 절약. 대기실은 2초, 게임 중은 1초. 자기 턴/반응 대기 중엔 0.7초.
- **타이머는 게이지 없이 lazy 처리**: Vercel에 cron/장기 프로세스가 없으므로, **어떤 요청이든 들어올 때** `deadline < now`면 자동 행동을 먼저 적용하고 응답. 폴링이 계속 오므로 최대 1~2초 지연으로 충분.
- **관전자**도 같은 state 엔드포인트 사용, `viewer.role = spectator`로 가림 정책만 다름.

### 2.1 동시성

- 방마다 `lock:room:{code}` 키를 `SET NX PX 3000`으로 획득, 처리 후 DEL. 획득 실패 시 100ms 간격 최대 5회 재시도 후 `409`.
- 상태에 `version` 정수. 저장 시마다 +1. 클라이언트는 자기가 보낸 액션의 응답으로 최신 뷰를 즉시 받음(폴링 대기 없이).

### 2.2 무료 티어 예산 (Upstash 10K 커맨드/일 기준 → 유료 전환 전 확인)

- 폴링 1회 = GET 1커맨드. 7인 + 관전 3명이 1초 폴링 시 ≈ 36K/시간 → **무료 티어 초과 가능**.
- 대책: (a) 폴링 응답을 Vercel 서버 메모리 캐시(같은 인스턴스 내 200ms)로 흡수, (b) Upstash 무료 티어가 현재 **500K 커맨드/월**로 바뀌었는지 배포 시점에 확인해 폴링 간격 조정. 설계상 간격은 서버가 응답에 `pollMs`로 내려줘 서버에서 조절 가능하게 둔다.

---

## 3. 데이터 모델 (Redis)

| 키 | 타입 | TTL | 내용 |
|---|---|---|---|
| `room:{code}` | string(JSON) | 6h (활동 시 갱신) | `RoomState` 전체 (대기실 정보 + 게임 상태) |
| `rooms:public` | zset (score = createdAt) | — | 공개 방 코드 목록. 목록 조회 시 존재하지 않는 코드는 정리 |
| `lock:room:{code}` | string | 3s | 처리 락 |
| `player:{token}` | string | 24h | `{ nickname, roomCode }` — 재접속 시 방 찾기 |

### 3.1 타입

```ts
type RoomStatus = 'waiting' | 'playing' | 'finished';

interface RoomState {
  code: string;                 // 6자리 대문자+숫자
  version: number;
  status: RoomStatus;
  createdAt: number; updatedAt: number;
  settings: {
    isPublic: boolean;
    spectatorMode: 'public' | 'all';   // 관전자에게 손패/역할 공개 여부
    turnSeconds: number;               // 기본 60
    maxPlayers: number;                // 4~7
  };
  hostId: string;
  players: Player[];            // 좌석 순서 = 배열 순서
  spectators: { id: string; nickname: string }[];
  game?: GameState;             // status === 'playing' | 'finished' 일 때
  log: LogEntry[];              // 최근 100개
}

interface Player {
  id: string;                   // 공개 id (uuid)
  token: string;                // 비밀 — 뷰에 절대 포함하지 않음
  nickname: string;
  connectedAt: number;          // 마지막 폴링 시각 (10초 초과면 "연결 끊김" 표시)
}

interface Card { id: string; name: CardName; suit: '♠'|'♥'|'♦'|'♣'; rank: 1..13 }

interface GameState {
  seed: string;                 // 재현용
  deck: Card[]; discard: Card[];
  players: GamePlayer[];        // players와 같은 순서
  turn: {
    playerId: string;
    phase: 'start' | 'draw' | 'play' | 'discard';
    bangsPlayed: number;
    deadline: number;           // epoch ms
  };
  pending: Pending[];           // 반응 스택 (아래 참조)
  winner?: 'sheriff' | 'outlaws' | 'renegade';
}

interface GamePlayer {
  id: string;
  role: 'sheriff' | 'deputy' | 'outlaw' | 'renegade';
  character: CharacterName;
  maxHp: number; hp: number;
  hand: Card[];
  equipment: Card[];            // 무기 포함
  alive: boolean;
  roleRevealed: boolean;        // 보안관 또는 사망자
}
```

### 3.2 반응 스택 `Pending`

한 액션이 다른 플레이어의 응답을 요구할 때 push. 스택 top이 현재 응답 대상. 응답 또는 타임아웃으로 pop.

```ts
type Pending =
  | { kind: 'bang';        from: string; to: string; missedNeeded: number; deadline: number }  // Missed!/Barrel/Beer 대응
  | { kind: 'indians';     from: string; targets: string[]; deadline: number }                // 각자 BANG! 또는 피해
  | { kind: 'gatling';     from: string; targets: string[]; deadline: number }                // 각자 Missed! 또는 피해
  | { kind: 'duel';        from: string; to: string; current: string; deadline: number }      // 번갈아 BANG!
  | { kind: 'generalStore';cards: Card[]; order: string[]; deadline: number }                 // 순서대로 1장 선택
  | { kind: 'chooseCard';  from: string; to: string; mode: 'steal'|'discard'; deadline: number } // Panic!/Cat Balou 대상 카드 선택
  | { kind: 'kitCarlson';  playerId: string; cards: Card[]; deadline: number }                // 3장 중 2장
  | { kind: 'jesseJones';  playerId: string; deadline: number }                               // 누구 손패에서 뽑을지
  | { kind: 'dying';       playerId: string; deadline: number }                               // Beer로 살아날지
  | { kind: 'discard';     playerId: string; count: number; deadline: number };               // 턴 종료 초과 손패
```

`indians`/`gatling`은 `targets` 배열을 시계방향으로 순회하며 한 명씩 응답받는다 (동시 응답 대신 순차 — 상태 단순화). 응답한 대상은 배열에서 제거.

### 3.3 클라이언트 뷰 (가림 정책)

`toView(state, viewerId)`:

- 공통 공개: 모든 플레이어의 `hp/maxHp/character/equipment/handCount/alive`, 보안관 역할, 사망자 역할, 버림 더미 맨 위, 덱 남은 수, `turn`, `pending`(카드 내용은 대상자에게만), `log`.
- 본인: 자기 `hand`, 자기 `role`.
- 관전자 (`spectatorMode === 'all'`): 전원의 `hand`, `role`.
- `token`, `deck` 내용은 절대 포함하지 않음.

---

## 4. API

모든 요청은 헤더 `x-player-token`으로 신원 확인. 토큰은 `/api/session`에서 발급.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/session` | `{nickname}` → `{token, playerId}`. 토큰 있으면 닉네임 갱신 |
| GET | `/api/session` | 토큰으로 현재 참여 중인 `roomCode` 반환 (복귀용) |
| GET | `/api/rooms` | 공개 방 목록 `{code, hostNickname, players, maxPlayers, status}[]` |
| POST | `/api/rooms` | 방 생성 `{settings}` → `{code}` |
| POST | `/api/rooms/:code/join` | `{as: 'player'|'spectator'}` |
| POST | `/api/rooms/:code/leave` | 대기실에서 나가기 / 게임 중이면 관전 전환 + 자동 진행 |
| GET | `/api/rooms/:code/state?since=N` | 뷰 반환. 버전 같으면 304. 응답에 `pollMs` 포함 |
| POST | `/api/rooms/:code/settings` | 방장만. 설정 변경 (대기 중에만) |
| POST | `/api/rooms/:code/start` | 방장만. 4인 이상일 때 |
| POST | `/api/rooms/:code/action` | 게임 액션 (아래) |
| POST | `/api/rooms/:code/kick` | 방장만. 대기실에서 |

### 4.1 게임 액션

```ts
type Action =
  | { type: 'draw' }                                          // 드로우 단계 (변형 캐릭터는 옵션 포함)
  | { type: 'drawFrom'; source: 'deck' | 'discard' | { playerId } }  // Pedro / Jesse
  | { type: 'pickCards'; cardIds: string[] }                  // Kit Carlson, General Store 등 선택
  | { type: 'play'; cardId: string; targetId?: string; targetCardId?: string }
  | { type: 'respond'; cardIds: string[] }                    // Missed!/BANG!/Beer로 대응. [] = 대응 안 함
  | { type: 'useBarrel' }                                     // Barrel 판정 시도 (자동 처리하되 명시 액션도 허용)
  | { type: 'endTurn' }
  | { type: 'discard'; cardIds: string[] }
  | { type: 'ability'; name: 'sidKetchum'; cardIds: string[] };
```

엔진은 `validate(state, playerId, action)`로 먼저 검사해 명확한 오류 메시지(`"사거리 밖입니다"`, `"이번 턴 BANG!을 이미 사용했습니다"`)를 400으로 반환.

---

## 5. 게임 엔진 흐름

### 5.1 게임 시작
1. 역할 배분(인원표) → 셔플 → 보안관이 첫 턴
2. 캐릭터 16장 중 인원수만큼 랜덤 배분
3. 생명 = 캐릭터 생명 (+1 보안관), 초기 손패 = 생명 수
4. `turn.phase = 'start'`, deadline 설정

### 5.2 턴 시작 (`phase: start`)
- Dynamite 있으면 판정 → 폭발(피해 3, dying 처리) 또는 왼쪽 이동
- Jail 있으면 판정 → 실패 시 phase를 바로 `discard`로 (손패 초과분만 정리 후 턴 넘김)
- 통과 시 `phase = 'draw'`

### 5.3 드로우
- 기본: 2장. Black Jack/Kit Carlson/Jesse Jones/Pedro Ramirez/Lucky Duke 분기
- 덱 소진 시 버림 더미 셔플

### 5.4 플레이
- `play` 액션마다 `validate` → 효과 적용 → 필요 시 `pending` push
- `pending`이 비어 있지 않으면 턴 플레이어는 다른 카드 사용 불가 (반응 완료까지 대기)

### 5.5 피해 & 사망
```
damage(target, n, source):
  hp -= n
  Bart Cassidy: n장 드로우 / El Gringo: source 손패에서 n장
  if hp <= 0: push pending 'dying' (Beer 보유 시만; 없으면 즉시 사망)
die(target):
  role 공개, alive=false
  Vulture Sam 생존 시 카드 전부 이동, 아니면 버림
  보상/벌칙: 무법자 처치 → source 3장 드로우 / 보안관이 부관 처치 → 보안관 전부 버림
  checkWinner()
```

### 5.6 타임아웃 자동 행동
| 상황 | 자동 행동 |
|---|---|
| `phase: draw` | 기본 드로우 |
| `phase: play` | `endTurn` |
| `phase: discard` | 손패 앞에서부터 초과분 버림 |
| pending `bang/gatling/indians/duel` | 대응 안 함 (피해) |
| pending `generalStore/kitCarlson/chooseCard` | 첫 번째 카드 선택 |
| pending `dying` | Beer 있으면 자동 사용 |
| pending `jesseJones` | 덱에서 드로우 |

연결 끊긴(10초 이상 폴링 없음) 플레이어의 턴/대응은 **deadline을 5초로 단축**해 게임이 늘어지지 않게 함.

---

## 6. 화면

| 경로 | 화면 |
|---|---|
| `/` | 닉네임 입력 (저장된 토큰 있으면 자동), 공개 방 목록, 코드 입장, 방 만들기. 참여 중인 방 있으면 "복귀" 배너 |
| `/room/[code]` | status에 따라 대기실 / 게임판 / 결과를 한 페이지에서 전환 |

### 6.1 대기실
- 플레이어 목록(방장 표시, 연결 상태), 관전자 목록
- 방장: 설정 변경, 강퇴, 시작 버튼(4인 미만 비활성)
- 코드 복사 / 초대 링크 복사

### 6.2 게임판
- 원형 테이블: 생존자 좌석, 각자 캐릭터·생명·장착·손패 수·(공개된) 역할. 현재 턴 강조, 남은 시간 바
- 하단: 내 손패(사용 가능한 카드 강조), 내 캐릭터·역할
- 중앙: 덱/버림 더미, 현재 `pending` 프롬프트 ("○○가 당신에게 BANG! — Missed! 사용 / 맞기")
- 우측(모바일은 접기): 로그
- 카드 클릭 → 대상 필요 시 대상 선택 모드 → 확정

### 6.3 결과
- 승리 진영, 전원 역할 공개, "다시 하기"(같은 방, 대기실로)

---

## 7. 폴더 구조

```
src/
  app/
    page.tsx                       # 로비
    room/[code]/page.tsx
    api/session/route.ts
    api/rooms/route.ts
    api/rooms/[code]/{join,leave,state,settings,start,action,kick}/route.ts
  game/                            # 순수 게임 엔진 (React/Next 의존 없음)
    cards.ts                       # 카드 정의 + 덱 생성
    characters.ts
    roles.ts
    engine.ts                      # reduce / validate
    effects/                       # 카드별 효과 (bang.ts, beer.ts, ...)
    timeout.ts                     # 자동 행동
    view.ts                        # toView 가림
    rng.ts                         # seed 기반 RNG
    types.ts
    __tests__/                     # vitest
  server/
    redis.ts                       # Upstash 클라이언트
    room.ts                        # 로드/저장/락
    auth.ts                        # 토큰 검증
  components/
    lobby/…  room/…  game/…  ui/…
  hooks/
    usePolling.ts
    useSession.ts
  lib/
    i18n.ts                        # 카드/캐릭터 한글명·설명
```

---

## 8. 구현 순서

1. **프로젝트 세팅** — Next.js 생성, Tailwind, vitest, Upstash 클라이언트, `.env.example`
2. **게임 엔진 (UI 없음)** — 타입, 카드/캐릭터 데이터, 게임 시작, 턴 흐름, BANG!/Missed!/Beer, 피해·사망·승리. 테스트로 검증
3. **엔진 나머지 카드** — 장착, Indians!/Gatling/Duel/General Store/Panic!/Cat Balou, 캐릭터 능력, 타임아웃
4. **서버** — 세션, 방 CRUD, 락, state 엔드포인트, action 엔드포인트
5. **로비/대기실 UI**
6. **게임판 UI** — 좌석, 손패, 대상 선택, pending 프롬프트, 로그, 타이머
7. **관전/재접속/강퇴/나가기 처리**
8. **Vercel 배포** — Upstash 연결, 폴링 간격 튜닝

각 단계 끝에 실제로 돌려보고 다음으로 넘어감.

---

## 9. 구현하면서 달라진 점

- `log`는 `RoomState`가 아니라 `GameState` 안에 두고, 엔진이 닉네임 맵(`names`)을 받아 한글 문장으로 바로 기록
- 턴 phase에 `jail` 추가 (`start`=다이너마이트 판정 → `jail`=감옥 판정 → `draw`), 죽기 직전 대기 후 이어서 진행하기 위함
- `chooseCard`/`jesseJones` pending 제거: 패닉!/캣 발루는 `play` 액션에 `targetCardId`(장착 카드 id 또는 `"hand"`)를 함께 보내고, 제시 존스/페드로는 `draw` 액션의 `source`로 선택
- Barrel은 자동 판정 (`useBarrel` 액션 없음)
- 대응 마감은 `reactionSeconds = max(15, turnSeconds/2)`
- 엔드포인트 추가: `GET /api/rooms/:code/info` (입장 전 확인), `POST /api/rooms/:code/reset` (결과 → 대기실)
- 버전 관리: 락 안에서 미리 `version+1` 해서 응답 뷰와 저장본이 같은 버전을 갖게 함. 접속 시각만 갱신할 땐 버전 유지
- 좌석 순서는 매 판 시작 시 재셔플

## 10. 추가 결정

- 카드/캐릭터 이름 **한글 표기** (코드 내부 식별자는 영문, 표시명은 `lib/i18n.ts`에서 매핑)
- 카드 비주얼은 텍스트 + 아이콘으로 **자체 제작** (원작 이미지 미사용)
- "다시 하기" 시 **좌석 순서 재셔플**
