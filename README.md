# Issue Forge

GitHub 이슈를 자동으로 처리하는 멀티 에이전트 AI 협업 시스템

## 개요

Issue Forge는 GitHub 이슈를 가져와서 복수의 AI 에이전트가 협력하여 개발하고, 완성 후 Pull Request를 생성하는 자동화 도구입니다.

### 주요 기능

- **멀티 에이전트 협업**: 5개의 전문 에이전트가 역할을 분담
  - Strategist: 전략 수립 및 실패 시 재전략
  - Architect: 설계 및 구현 계획
  - Coder: 코드 구현
  - Tester: 테스트 작성 및 실행
  - Reviewer: 코드 리뷰 및 승인/거절 판정

- **Strategy-Execute-Evaluate 루프**: 최대 3회 반복 시도
- **다중 프로젝트 지원**: 여러 프로젝트를 라운드 로빈 방식으로 순회
- **무한 루프 실행**: 데몬으로 실행하며 지속적으로 이슈 처리
- **Rate Limit 대응**: API 제한 시 자동 대기 후 재시도

## 설치

```bash
# 저장소 클론
git clone https://github.com/your-repo/issue-forge.git
cd issue-forge

# 의존성 설치
npm install

# 전역 설치 (선택)
npm link
```

## 요구사항

- Node.js 24.12.0+ LTS
- GitHub CLI (`gh`) 설치 및 인증
- Claude Code CLI (`claude`) 또는 Gemini CLI (`gemini`)
- GitHub Personal Access Token (환경변수: `GITHUB_TOKEN`)

## 실행 방법

전역 설치 여부에 따라 두 가지 방식으로 실행할 수 있습니다:

```bash
# 전역 설치한 경우 (npm link)
issue-forge <명령어>

# 전역 설치 없이 직접 실행
node src/index.js <명령어>
```

아래 예시에서는 `issue-forge`를 사용하지만, 전역 설치하지 않았다면 `node src/index.js`로 대체하세요.

## 설정

### 설정 파일 생성

```bash
issue-forge init
# 또는: node src/index.js init
```

### config.yaml 예시

```yaml
global:
  polling_interval: 600  # 이슈 없을 때 대기 시간 (초)
  ai_provider: claude    # claude 또는 gemini

logging:
  level: debug
  file_enabled: true
  file_path: ./logs
  max_files: 7

notifications:
  enabled: false
  provider: slack  # Options: slack, telegram, none
  # webhookUrl: "https://hooks.slack.com/services/..."  # Optional: Can use env var instead

projects:
  - path: "/Users/ryu/projects/project-a"
  - path: "/Users/ryu/projects/project-b"
```

## 알림 설정

Issue Forge는 이슈 처리 완료 시 Slack 또는 Telegram으로 알림을 보낼 수 있습니다.

### Slack 설정

1. Slack Workspace에서 Incoming Webhook 생성:
   - https://api.slack.com/messaging/webhooks 접속
   - "Create your Slack app" 클릭
   - Incoming Webhooks 활성화
   - "Add New Webhook to Workspace" 클릭
   - 알림을 받을 채널 선택
   - Webhook URL 복사

2. config.yaml에 추가:
```yaml
notifications:
  enabled: true
  provider: slack
  webhookUrl: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

또는 환경변수로 설정:
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### Telegram 설정

1. Telegram Bot 생성:
   - @BotFather에게 `/newbot` 명령 전송
   - Bot 이름 및 username 설정
   - Bot Token 복사

2. Chat ID 확인:
   - 생성한 Bot과 대화 시작 (메시지 전송)
   - https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates 접속
   - `chat.id` 값 확인

3. Webhook URL 형식으로 설정:
```yaml
notifications:
  enabled: true
  provider: telegram
  webhookUrl: "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/sendMessage?chat_id={YOUR_CHAT_ID}"
```

또는 환경변수로 설정:
```bash
export TELEGRAM_WEBHOOK_URL="https://api.telegram.org/bot{TOKEN}/sendMessage?chat_id={CHAT_ID}"
```

### 알림 메시지

**성공 시 (PR 생성)**:
- 이슈 번호 및 제목
- PR 번호 및 링크

**에스컬레이션 시 (3회 실패)**:
- 이슈 번호 및 제목
- 반복 횟수
- 수동 검토 필요 안내

### 문제 해결

알림이 전송되지 않는 경우:
1. Webhook URL이 올바른지 확인
2. 로그 파일에서 에러 메시지 확인: `./logs/issue-forge-*.log`
3. curl로 테스트:
```bash
# Slack
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  YOUR_SLACK_WEBHOOK_URL

# Telegram
curl "https://api.telegram.org/bot{TOKEN}/sendMessage?chat_id={CHAT_ID}&text=Test"
```

## 사용법

### 데몬 실행

```bash
# 무한 루프로 이슈 처리 시작
issue-forge start

# 설정 파일 지정
issue-forge start -c /path/to/config.yaml
```

### 단일 이슈 처리

```bash
# 가장 오래된 이슈 하나 처리
issue-forge run

# 특정 이슈 처리
issue-forge run -i 42

# 특정 프로젝트의 이슈 처리
issue-forge run -p /path/to/project -i 42
```

### 이슈 스캔

```bash
# 모든 프로젝트의 열린 이슈 목록
issue-forge scan
```

## 동작 방식

### 실행 흐름

```
1. 설정된 프로젝트 목록 로드
2. 무한 루프 시작
   ├─ 프로젝트 A의 이슈 하나 처리
   ├─ 프로젝트 B의 이슈 하나 처리
   └─ 모든 프로젝트에 이슈 없으면 대기
3. 이슈 처리 (최대 3회 반복)
   ├─ Iteration 1: 초기 전략 → 설계 → 구현 → 테스트 → 리뷰
   ├─ Iteration 2: 실패 분석 → 재전략 → 재설계 → 재구현 → 리뷰
   └─ Iteration 3: 대안 탐색 → 새 전략 → 재설계 → 재구현 → 리뷰
4. 승인 시 PR 생성, 3회 실패 시 사람에게 에스컬레이션
```

### 메모리 파일

각 이슈 처리 시 `.issue-forge/issue-{번호}.md` 파일에 에이전트 간 협업 로그가 저장됩니다.

## AI 프로바이더

| 프로바이더 | 모델 | 컨텍스트 |
|-----------|------|----------|
| Claude | opus | 200K |
| Gemini | pro | 1M |

## 프로젝트 구조

```
issue-forge/
├── src/
│   ├── index.js           # CLI 엔트리포인트
│   ├── config/            # 설정 로더
│   ├── core/              # 오케스트레이터
│   ├── agents/            # 5개 에이전트
│   ├── providers/         # AI 프로바이더
│   ├── github/            # GitHub 클라이언트
│   ├── memory/            # 마크다운 메모리
│   └── utils/             # 유틸리티
├── templates/prompts/     # 에이전트 프롬프트
└── config.yaml            # 설정 파일
```

## 라이선스

MIT
