# BANG! 온라인

친구들과 브라우저로 즐기는 BANG! 보드게임 (기본판, 4~7인). 닉네임만 입력하면 방을 만들고, 코드로 입장하고, 관전할 수 있습니다.

설계는 [DESIGN.md](DESIGN.md) 참고.

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속. Upstash 환경변수가 없으면 인메모리 스토어로 동작하므로 DB 없이 바로 테스트할 수 있습니다 (서버 재시작 시 방이 사라짐).

여러 명 테스트는 브라우저 시크릿 창 여러 개로 하면 됩니다 (세션이 localStorage에 저장되어 창마다 다른 플레이어가 됩니다).

## 테스트

```bash
npm test          # 게임 엔진 단위 테스트
npm run lint
npx tsc --noEmit
```

## Vercel 배포

1. GitHub에 push 후 Vercel에서 프로젝트 Import
2. Vercel 대시보드 → **Storage** → **Create Database** → **Upstash Redis** (무료 티어) → 프로젝트에 연결
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 환경변수가 자동으로 추가됩니다
3. Redeploy

로컬에서 Upstash를 쓰려면 Upstash 콘솔의 REST URL/Token을 `.env.local`에 넣으세요 (`.env.example` 참고).

## 구조

```
src/game/      순수 게임 엔진 (React/Next 의존 없음, vitest로 검증)
src/server/    세션·방·락·폴링 처리 (Route Handler에서 호출)
src/app/api/   HTTP 엔드포인트
src/app/       로비 / 방 페이지
src/components 대기실, 게임판, 결과 화면
src/hooks/     세션 복구, 상태 폴링
```
