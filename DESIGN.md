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
- **폴링**: 클라이언트는 `since=version`으로 요청. 버전이 같으면 `304 Not Modified`(본문 없음)로 응답해 대역폭 절약. 대기실 3초, 게임 중 2초, 지금 행동할 사람은 1초, 탭이 숨겨지면 8초 (2.2 참고).
- **타이머는 게이지 없이 lazy 처리**: Vercel에 cron/장기 프로세스가 없으므로, **어떤 요청이든 들어올 때** `deadline < now`면 자동 행동을 먼저 적용하고 응답. 폴링이 계속 오므로 최대 1~2초 지연으로 충분.
- **관전자**도 같은 state 엔드포인트 사용, `viewer.role = spectator`로 가림 정책만 다름.

### 2.1 동시성

- 방마다 `lock:room:{code}` 키를 `SET NX PX 3000`으로 획득, 처리 후 DEL. 획득 실패 시 100ms 간격 최대 5회 재시도 후 `409`.
- 상태에 `version` 정수. 저장 시마다 +1. 클라이언트는 자기가 보낸 액션의 응답으로 최신 뷰를 즉시 받음(폴링 대기 없이).

### 2.2 무료 티어 예산 (Upstash 무료: 월 50만 커맨드 / 256MB / 대역폭 10GB)

실측은 `src/server/__tests__/command-budget.test.ts`가 담당한다 (7인 1분 폴링을 그대로 돌려 커맨드를 센다).

| | 커맨드/초 (7인) | 무료 티어 지속 |
|---|---|---|
| 최초 구현 | ~23 | 약 6시간 (≈12판) |
| 폴링 당기기 전 | 3.3 (캐시 적중) ~ 6.5 (최악) | 22~42시간 |
| 현재 | 3.7 (캐시 적중) ~ 11.3 (최악) | 12~38시간 |

"최악"은 매 요청이 다른 인스턴스에 떨어져 400ms 캐시가 늘 비는 경우다. 실제로는 인스턴스가
재사용돼 캐시 적중 쪽에 가깝고, 사용량은 사람 수에 비례하므로 2~4인 판은 훨씬 싸다.
**캐시 적중 쪽이 3.3 -> 3.7로 거의 안 움직인 이유**: 간격을 당기면 7명의 폴링이 400ms 캐시
창 안에 뭉쳐서 Redis get 하나를 같이 쓴다. 비용을 지배하는 건 폴링 횟수가 아니라 12초마다
도는 접속 시각 저장이다.

줄인 방법:

- **세션 토큰을 HMAC 서명 방식으로** (`SESSION_SECRET`). 폴링마다 `player:{token}`을 읽던 커맨드가 사라진다. 키가 없으면 예전처럼 Redis에 저장한다.
- **접속 시각 저장 간격 12초** (`PRESENCE_WRITE_MS`). 저장 한 번이 락 포함 커맨드 5개라 폴링 자체보다 비쌌다. `DISCONNECT_AFTER_MS`는 30초로 맞춰 올림.
- **폴링 간격**: 대기실 2초 / 게임 중 0.8초 / 지금 행동할 사람 0.7초 / 봇 차례 1.8초. 안 보고 있는 탭은 8초.
  사람끼리 하는 판의 체감 지연(= 남이 둔 수가 내 화면에 뜨기까지)을 지배하는 값이라 게임 중은
  일부러 짧게 잡았다. 봇 차례만 1.8초인 건 `BOT_MIN_MOVE_MS`(1650)보다 빨리 받아 봐야
  같은 상태를 다시 받을 뿐이기 때문.
- **인스턴스 메모리 캐시 400ms** (`room.ts`). 락 안에서는 반드시 우회한다 — 캐시를 읽고 쓰면 남의 변경을 덮어쓴다.
- **공개 목록 zadd/zrem 생략**: 목록 노출 여부가 안 바뀌면 어차피 no-op.
- **로그 상한 80줄**: 방 전체가 매 폴링마다 오가므로 상한이 곧 대역폭이다.
- **로비 목록 30초 주기 + 탭 숨김 시 정지**. 5초 주기일 때는 로비를 켜둔 탭 하나가 하루 3.4만 커맨드를 썼다.

넘어가도 pay-as-you-go가 10만 커맨드당 $0.2라 월 100시간을 굴려도 $3 수준이다.

---

## 3. 데이터 모델 (Redis)

| 키 | 타입 | TTL | 내용 |
|---|---|---|---|
| `room:{code}` | string(JSON) | 6h (활동 시 갱신) | `RoomState` 전체 (대기실 정보 + 게임 상태). 버려진 방은 로비 조회 때 삭제 (아래) |
| `rooms:public` | zset (score = createdAt) | — | 공개 방 코드 목록. 목록 조회 시 존재하지 않는 코드는 정리 |
| `lock:room:{code}` | string | 3s | 처리 락 |
| `player:{token}` | string | 24h | `{ playerId, nickname }` — **`SESSION_SECRET`이 있으면 쓰지 않는다** (토큰 자체에 서명해 담음) |
| `playerRoom:{playerId}` | string | 24h | 참여 중인 방 코드 — 재접속 시 복귀 |

**버려진 방은 로비를 열 때 치운다** (`isAbandoned`, `ABANDONED_MS` 10분). 탭을 닫고 떠난
방이 TTL 6시간 동안 목록에 남아, 들어가 봐야 방장이 없어 시작도 못 하는 방이 쌓였다.
상주 프로세스가 없으니 목록을 조회하는 순간이 곧 청소 시점이다.

닫는 조건은 두 가지다 (봇은 폴링하지 않으므로 어느 쪽에서도 세지 않는다).

| 조건 | 무엇을 잡나 | 근거 |
|---|---|---|
| 사람이 아무도 안 보고 있음 + 10분 | 탭을 닫고 떠난 방 | `lastSeen` 최댓값 |
| 시작 안 했거나(waiting) 끝난(finished) 방을 **혼자** 붙들고 10분 | 아무도 안 오는 대기실, 결과 화면에 방치된 방 | `aloneSince` |

**진행 중인 게임(`playing`)은 어느 쪽에도 걸리지 않는다.** 사람 1명이 봇들과 플레이 중인
방을 지우면 안 되기 때문이다 — 그 사람이 보고 있는 한 `lastSeen`이 갱신되고, `aloneSince`는
게임이 시작될 때 지워진다. 이 보호는 회귀 테스트로 못 박아 뒀다.

`aloneSince`는 `tick()`이 갱신한다. 혼자가 되면 그 시각을 적고, 둘째 사람이 들어오거나
게임이 시작되면 지운다. 화면에 안 보이는 기록이라 `version`은 올리지 않는다(`touched`로만
저장). 게임이 끝나 혼자 남으면 시계가 다시 돈다.

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
| `/` | 헤더의 닉네임 칸 + 공개 방 목록 + 코드 입장 + 방 만들기가 **한 화면**. 참여 중인 방 있으면 "복귀" 배너 |
| `/room/[code]` | 세션이 없어도 방 정보를 먼저 보여준다. status에 따라 대기실 / 게임판 / 결과를 한 페이지에서 전환 |

**닉네임 입력을 앞에 세우지 않는다.** 세션은 방을 만들거나 들어가는 순간 헤더의
닉네임으로 만들어진다 (`POST /api/session`이 생성과 개명을 겸한다). 이유:

- 공개 방 목록(`GET /api/rooms`)과 방 정보(`GET /api/rooms/:code/info`)는 인증이
  필요 없다. 가릴 이유가 없는데 가리고 있었다.
- 초대 링크로 들어온 사람이 **여기가 무슨 방인지 모르는 채 닉네임부터 치는** 게
  제일 나빴다. 지금은 방장·인원·상태를 먼저 보고 닉네임을 정한다.
- 방 만들기 설정 4개는 `<details>`로 접는다. 기본값이 무난하고 대기실에서 방장이
  언제든 바꿀 수 있다.

### 6.1 대기실
- 플레이어 목록(방장 표시, 연결 상태), 관전자 목록
- 방장: 설정 변경, 강퇴, 시작 버튼(4인 미만 비활성)
- 코드 복사 / 초대 링크 복사
- **봇은 방장이 되지 않는다.** 봇은 시작 버튼을 누를 수 없어서, 방장이 되는 순간 아무도
  게임을 시작할 수 없는 방이 된다 (방 만들기 → 봇 추가 → 관전에서 실제로 걸렸다).
  방장이 넘어갈 때는 `nextHost()`가 사람만 고르고(자리 → 관전자 순), 관전으로 내려가도
  방장은 그대로 둔다 — 예전엔 `players[0]`에게 넘겨서 그게 봇이면 방이 잠겼다.

### 6.2 게임판

**격자가 아니라 원형 테이블.** 좌석을 타원으로 돌려 앉히고 내 자리를 항상 아래
중앙에 고정한다. 격자로 늘어놓으면 누가 누구 옆인지가 사라지는데, BANG!은
거리가 규칙의 중심이라 그게 곧 게임을 못 읽게 만든다.

- **사거리 밖 좌석은 항상 흐리게.** "누굴 쏠 수 있나"는 카드를 들기 전에 보여야
  한다. 거리 숫자도 좌석에 표시한다.
- **손패 카드에 올리면** 그 카드로 칠 수 있는 대상이 테이블에서 미리 하이라이트된다.
  클릭해야 알 수 있으면 "일단 눌러보는" 조작이 된다.
- 낼 수 없는 카드는 손패에서 흐리게 (사거리·턴당 뱅! 제한·중복 장착까지 반영).
- 제시 존스처럼 사람을 고르는 행동은 **버튼을 인원수만큼 늘어놓지 않고**
  테이블에서 직접 클릭한다.
- **관전자는 좌석이 없어 테이블에 나타나지 않는다.** 누가 보고 있는지 알 방법이
  대기실뿐이었으므로, 헤더에 `관전 N` 배지를 두고 누르면 이름을 편다(연결 상태 점은
  좌석·대기실과 같은 규칙). 폰에서는 헤더가 이미 꽉 차 턴 표시를 밀어내므로 배지를
  숨기고 기록 시트 위에 한 줄로 적는다.
- 카드는 아이콘 중심. 11px 글씨를 읽어야 뱅!과 빗나감!이 갈리면 안 된다.
- 내 차례/대응 차례에는 타이머를 화면 폭으로 키우고 마지막 10초에 맥동시킨다.
- **한 화면에 들어온다.** 이전 모바일 레이아웃은 세로 3,400px라 테이블과 손패
  사이를 계속 스크롤해야 했다. 지금은 뷰포트 안에서 끝난다.

#### 연출 (`useGameEvents`)

폴링은 "무엇이 달라졌는지"를 알려주지 않고 최신 상태만 준다. 그래서 클라이언트가
**로그 증분과 생명 변화를 직접 비교해** 사건으로 바꾼다. 서버 변경은 없다.

봇이 한 번에 여러 수를 두면 결과가 폴링 한 번에 몰려 오는데, 그대로 반영하면
아무것도 못 보고 지나간다. 사건을 큐에 쌓아 1.35초 간격으로 하나씩 흘리고(밀리면
간격을 줄여 최소 0.63초까지 따라잡는다), 피해·회복·사망은 좌석 흔들림/섬광으로 표시한다.

큐가 빈 뒤에도 `pump`는 `STEP_MS` 뒤에 한 번 더 깨어나 말풍선을 지운다. **그 잔여 대기 중에
도착한 새 사건은 잔여 시간을 버리고 `NEW_BEAT_GAP_MS`(= `MIN_STEP_MS`)만 지킨다.** 사람끼리
하는 판은 사건이 몇 초 간격으로 띄엄띄엄 와서 거의 매번 이 잔여 대기에 걸렸고, 폴링이
이미 전달한 상태를 연출만 최대 1.35초 늦게 보여주고 있었다. 봇이 연달아 둘 때처럼 큐가
실제로 밀려 있는 경우에는 이 경로를 타지 않아 속도가 그대로다.

**실제 체감 속도를 정하는 건 `STEP_MS`가 아니라 `MIN_STEP_MS`다.** 봇의 한 수가 로그를
여러 줄 남기기 때문에(뽑기·장착·공격·피해) 큐는 거의 늘 밀려 있고, 4줄만 쌓여도 최소
간격까지 떨어진다. 실측 중앙값은 650ms 안팎. 속도를 더 손보려면 `MIN_STEP_MS`부터 본다.

**내 차례가 되면 밀린 장면을 빠르게 흘린다** (`CATCH_UP_MS` 180ms). 화면판과 프롬프트는
최신 상태를 바로 반영하는데 연출 큐만 뒤처지면 "앞 봇들의 턴이 안 끝났는데 내가 조작할 수
있는" 상태로 보인다 — 지난 장면을 보면서 지금 판을 조작하게 둘 수는 없다. 큐가 비면
(= 지금 보여준 것이 마지막 장면) 평소 속도로 돌아가므로 나에게 벌어진 일은 놓치지 않는다.
실측: 내 차례 200ms / 구경 중 1181ms.

서버 쪽에서도 봇의 한 수가 최소 `BOT_MIN_MOVE_MS`(기본 1650)는 걸리게 하고,
봇 차례의 `pollMs`를 1800으로 맞춰 수가 뭉쳐 오지 않게 한다. 이 셋(`STEP_MS`,
CSS 연출 길이, `BOT_MIN_MOVE_MS`)은 **같이 움직여야 한다** — 하나만 바꾸면 연출이
잘리거나 혼자 남는다.

한 수가 느려질수록 `runBots`가 `MAX_MOVES`를 다 채우기 전에 서버리스 실행시간 상한에
걸릴 수 있어, 8초 예산을 두고 스스로 멈춘다. 남은 수는 다음 폴링이 이어받는다.

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

---

## 11. AI 봇

방장이 대기실에서 자리에 앉힌다. 봇은 폴링하지 않으므로 접속 판정에서 제외한다
(`isConnected`가 `isBot`을 먼저 본다 — 아니면 `applyTimeouts`가 봇 차례를 끊긴
것으로 보고 먼저 처리해 버린다).

이름은 `AI1`, `AI2`… 사람 닉네임처럼 보이는 이름을 주면 누가 봇인지 헷갈린다. 빠진 번호가
있으면 다시 채워서, 봇을 뺐다 넣어도 번호가 치솟지 않는다. 봇은 방장이 될 수 없다 (6.1).

### 11.1 무엇이 봇을 굴리는가

Vercel에는 상주 프로세스가 없어서 "봇 차례"를 알아챌 주체가 없다. 그런데 봇
차례를 **만드는 요청은 항상 존재한다** — 직전 사람의 액션, 또는 시간초과를
드러낸 폴링. 그래서 상태를 바꾸는 라우트(action/start/bot)와 폴링 라우트(state)
끝에 같은 훅을 건다:

```
botShouldMove(view) && after(() => runBots(code))
```

`after()`는 응답을 내보낸 뒤에 실행되므로, 턴을 넘긴 사람이 봇을 기다리지 않는다.
판단은 이미 만든 뷰로 하므로 Redis를 더 읽지 않는다.

### 11.2 락과 LLM

LLM 왕복은 락 TTL(3초)보다 오래 걸릴 수 있다. 락을 쥔 채 부르면 만료된 락으로
저장하게 되므로 순서를 나눈다:

1. 락 없이 방을 읽는다
2. `botmove:{code}:{version}`을 `SET NX`로 잡는다 — 같은 상태를 두 요청이 동시에
   굴리지 않게. 버전이 키에 들어가므로 다음 수는 다시 경쟁할 수 있다
3. **락 밖에서** LLM 호출
4. 락을 잡고, 버전이 그대로일 때만 적용 (기다리는 동안 사람이 뭔가 했으면 폐기)

### 11.3 수를 고르는 방법

`game/bot.ts`의 `botCandidates(state, playerId)`가 **엔진이 받아주는 수만** 모은다.
LLM은 번호 하나만 고르므로 불법수가 원천적으로 불가능하고, 프롬프트도 작다.

- 합법수 전체를 뽑지 않는다. 봇은 "적당히" 두면 되므로 판을 굴리는 데 필요한 수만.
- **0번이 무난한 기본값**이다. LLM을 못 쓰면 이걸 둔다. 고정 우선순위로 정렬한
  1등이며 랜덤이 아니다: 손패 불리기 → 무장 → (급하면) 회복 → 공격 → 턴 종료.
- **점수가 같은 후보끼리는 섞는다.** 안 섞으면 정렬이 안정적이라 늘 같은 좌석을
  쏴서 봇 여럿이 판박이가 된다. 시드는 상태(`rngState`·로그 길이·playerId)에서
  뽑으므로 `Math.random` 없이도 턴마다 달라지고, 같은 판을 다시 돌리면 재현된다.
- 맥주는 **생명이 절반 이하일 때만** 후보에 넣는다. 넉넉할 때 마시면 정작 죽기
  직전에 쓸 게 없다.
- 후보가 1개면 LLM을 건너뛴다 — 드로우·버리기·강제 대응이 여기 해당해서,
  LLM 호출이 턴당 1~2회로 줄어든다.

계약은 하나다: **후보는 전부 합법이다.** `game/__tests__/bot.test.ts`가 봇끼리
60판을 끝까지 둬서 확인한다.

### 11.4 속도와 비용

- 모델 `gpt-4o-mini`, `max_tokens: 4` (번호만 받는다 — 지연의 대부분이 출력 토큰)
- 2.5초 안에 답이 없으면 `AbortController`로 끊고 기본 수를 둔다
- 프롬프트는 **봇에게 보이는 뷰**로만 만든다. 서버는 전체 상태를 알지만 그걸
  넣으면 봇이 남의 손패를 보고 둔다
- `OPENAI_API_KEY`가 없으면 LLM을 아예 건너뛴다. 봇은 그래도 논다
- 한 수당 $0.0002 수준, 봇 3명 한 판에 $0.03~0.05

---

## 12. 초보자 도움말

처음 하는 사람이 막히는 지점은 세 가지다: "나는 뭘 해야 하지", "이 카드가 뭐지 / 왜 못 내지",
"지금 무슨 일이야". 각각에 한 층씩 둔다. 서버 변경은 없다.

| 층 | 무엇 | 어디 |
|---|---|---|
| ① 시작 안내 | 내 역할·목표, 역할 4개 요약, 턴 순서, 거리 규칙. 카드/캐릭터 전체 목록 탭 | 판 시작 시 한 번 오버레이(`HelpSheet`), 헤더 `?`로 재열람 |
| ② 힌트 줄 | 카드·좌석·역할 배지에 올리면 이름 · 효과 · **지금 상황에서의 의미** | 테이블과 손패 사이 한 줄(`HelpStrip`) |
| ③ 상황 해설 | "철수가 영희에게 뱅! — 영희는 빗나감!으로 막거나 피해 1" | 타이머 밑 한 줄 |

- **"왜 못 내지"가 핵심.** 카드를 흐리게만 하면 이유를 모른다. `viewRules.playReason`이
  참/거짓 대신 **이유 문자열**을 돌려주고, 게임판의 흐림 처리와 힌트 줄이 같은 함수를 쓴다.
  거리·사거리·대상 판단도 `viewRules`로 모아 UI와 설명이 어긋나지 않게 했다.
- 문장 생성은 `src/game/help.ts` 순수 함수. 엔진처럼 vitest로 검증한다.
- **모바일은 두 번 탭.** hover가 없으니 도움말이 켜져 있으면 첫 탭은 설명, 같은 카드를
  한 번 더 탭하면 사용. 실수로 내는 것도 막아준다. 좌석은 조준 흐름이 이미 있어 한 번 탭 그대로.
- 헤더 `도움말` 토글(localStorage). 끄면 ②③이 사라지고 한 번 탭으로 돌아간다. ①은 켜져 있을 때만 판마다 한 번.

### 12.1 내재 능력은 장착 카드처럼 보여준다

폴 리그렛(머스탱)·주르도네(술통)·로즈 둘런(조준경)은 **카드 없이도** 그 효과를 가진다.
좌석에 아무 표시가 없으면 "머스탱도 없는데 왜 옆자리가 거리 2지?"가 된다 — 실제로 겪은 혼동이다.

- 좌석에 **점선 테두리 카드**를 하나 놓는다. 숫자/무늬 자리에는 "능력"이라고 쓴다 (실제 카드가
  아니므로 판정에도 안 쓰이고 패닉!/캣 발루로 뺏기지도 않는다 — 툴팁에 그렇게 적었다).
- 힌트 줄도 출처를 구분한다: 진짜 장착이면 "상대 머스탱 +1", 캐릭터 능력이면
  "상대 폴 리그렛 능력 +1". 같은 +1이라도 **카드를 뺏어서 없앨 수 있는지**가 다르다.
- 이미 같은 이름의 진짜 카드를 장착했으면 중복해서 그리지 않는다.
- 같은 이유로 **빗나감! 장수도 출처를 밝힌다** (`missedNote`). "빗나감! 2장으로 막을 수
  있습니다"만 보면 왜 2장인지 알 수 없다 — 슬랩 더 킬러의 뱅!이기 때문이다. 술통 판정이
  먼저 일어나 장수를 깎으므로 "슬랩인데 1장"인 상황도 생기는데, 그때가 제일 헷갈려서
  그 경우도 따로 설명한다. 게임판 프롬프트와 상황 해설이 같은 함수를 쓴다.

---

## 13. 공격 연출 (화살표)

"누가 누구를"이 로그 문장에만 있어서, 화살표를 그리려면 한글을 파싱해야 했다. 대신
**엔진이 로그에 구조화된 메타를 같이 남긴다** (`LogEntry.meta = { kind, from, to | targets }`).
문장은 사람이 읽고 메타는 화면이 읽는다. 뱅!·결투·패닉!·캣 발루·감옥·인디언!·개틀링, 그리고
막았을 때(`dodge`). 테스트로 검증 (`logmeta.test.ts`).

- `useGameEvents`가 메타를 화살표 사건으로 바꿔 기존 큐(1.35초 간격)에 태운다. 봇이 연달아
  둬도 화살표가 하나씩 보인다. 결투는 응답마다 방향이 바뀐다.
- `Table`의 `ArrowLayer`: 좌석 상자의 실제 사각형을 DOM에서 재서(`data-seat`) 상자 경계에서
  출발해 상대 경계 앞에서 멈추는 곡선을 픽셀로 그린다. %-viewBox를 비율 무시로 늘리면 선
  굵기가 가로세로로 달라지고, `seatCenter`는 상자가 위/아래 변 기준으로 앉아 있어 실제
  중심과 어긋난다. 측정 기준 div는 고정하고 안쪽만 key로 교체한다 — 바깥을 갈아끼우면
  `ResizeObserver`가 떨어진 옛 div의 0×0을 마지막으로 보고해 다음 화살표가 사라졌다. 중간에
  카드 아이콘 원 — 무슨 카드인지 안 읽어도 보이게. 색: 뱅!/개틀링 빨강, 인디언! 주황,
  결투 보라, 패닉!/캣 발루 노랑, 감옥 회색.
- 막으면 좌석에 "빗나감!" 배지가 튀어오른다. 맞았을 때만 연출이 있고 막았을 땐 아무것도
  없던 걸 채웠다.
- **선은 좌석 위(z-25)에 그리고 어두운 테두리를 깐다.** 처음엔 좌석 뒤(z-15)에 뒀는데,
  6~7인이라 상자가 서로 겹치면 화살표가 통째로 가려졌다. 굵은 검은 선을 먼저 긋고 그 위에
  색을 얹으면 밝은 상자 위에서도 형태가 읽힌다. 화살촉에도 같은 테두리를 준다.
- **짧은 화살표일수록 크게 휘어** 빈 공간으로 빼낸다(`bend` 최소 26px). 좌석이 세로로
  붙어 있으면 거리가 짧아 곡선이 상자 사이에 파묻혔다.
- **선 길이를 최소 84px 확보한다**(`MIN_LINE`). 양 끝을 상자 경계까지 물리면, 좌석이
  붙어 있을 때 여백만으로 길이를 다 먹어 **화살촉만 남은 토막**이 됐다. 남는 길이가
  모자라면 양쪽 여백을 같은 비율로 줄이고, 완전히 겹쳤으면 중심에서 중심으로 긋는다.
  84px인 이유는 곡선 중앙에 28px 카드 아이콘이 얹히기 때문 — 더 짧으면 아이콘이 선을 덮는다.
