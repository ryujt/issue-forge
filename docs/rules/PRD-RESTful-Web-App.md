# PRD - RESTful Web App 예시

## 개요

IssueBoard는 팀이 이슈를 등록하고, 목록에서 검색과 필터로 탐색하며, 상세 화면에서 내용을 확인하고 수정하는 웹 애플리케이션이다.
문서 목적은 “PRD를 어떤 형식으로 쓰는지”를 보여주는 간략 템플릿 예시다.

## 기능 요구사항

* 인증과 세션
  * 이메일 로그인
  * 액세스 토큰 기반 인증
  * 401 발생 시 로그인 화면으로 이동
* 프로젝트
  * 프로젝트 목록 조회
  * 프로젝트 선택 상태 유지
* 이슈
  * 목록 조회 검색, 필터, 정렬, 페이지네이션
  * 상세 조회
  * 생성
  * 수정
* 관리자 대시보드
  * 사용자 관리
  * 감사 로그 조회

## 시스템 구성

* System
  * DB
    * MySQL 8.0
    * Redis 7
  * Backed
    * Frontend API Server
      * Node.js 24.12 LTS
    * Backend API Server
      * Node.js 24.12 LTS
    * Batch Agent
      * Node.js 24.12 LTS
  * Frontend
    * React 18
    * Vite 5
    * React Router 6
  * Dashboard
    * React 18
    * Vite 5

## 핵심 사용자 시나리오

```navigation
App -> Login
Login -> IssueList
IssueList -> IssueDetail
IssueList -> IssueCreate
IssueDetail -> IssueEdit
IssueCreate -> IssueList
IssueEdit -> IssueDetail
IssueList -> AdminDashboard
AdminDashboard -> UserAdmin
AdminDashboard -> AuditLog
Any -> NotFound
Any -> Login
```

* 로그인 성공 후 IssueList로 진입
* IssueList에서 검색과 필터로 이슈를 찾고 IssueDetail로 이동
* IssueCreate에서 생성 후 IssueList로 복귀
* AdminDashboard에서 UserAdmin, AuditLog 확인
* 인증 만료 시 Login으로 이동

## Screen Layout

### Login

```layout
Screen V Header, Main, Footer
Header > Logo, Status
Main V Title, LoginForm, HelpLinks
LoginForm V EmailField, PasswordField, LoginButton
Footer > Version, Legal
```

### IssueList

```layout
Screen V Header, Main, Footer
Header > Logo, Search, UserMenu
Main > Left Sidebar : 20, Content
Left Sidebar V ProjectPicker, SavedFilters, TagFilter
Content V TitleBar, FiltersBar, Table, Pager
TitleBar > ScreenTitle, PrimaryActions
FiltersBar > StatusFilter, AssigneeFilter, Sort
Footer > Status, Version
```

### IssueDetail

```layout
Screen V Header, Main, Footer
Header > Logo, Search, UserMenu
Main > Left Sidebar : 20, Content
Left Sidebar V ProjectPicker, SavedFilters, TagFilter
Content V Breadcrumbs, TitleBar, DetailBody, Activity
TitleBar > IssueTitle, Actions
DetailBody V Summary, Meta, Description
Activity V Tabs, Timeline
Footer > Status, Version
```

### AdminDashboard

```layout
Screen V Header, Main, Footer
Header > Logo, Search, UserMenu
Main > Left Sidebar : 20, Content
Left Sidebar V AdminMenu, SystemLinks
Content V TitleBar, MetricsRow, Table, Pager
TitleBar > ScreenTitle, PrimaryActions
MetricsRow > Metric1, Metric2, Metric3
Footer > Status, Version
```

## 핵심 모듈 설계

### 시스템 전체 관점의 Job Flow Diagram

```jobflow
master: IssueBoard
Object: Frontend, Backend, Redis, etc, ...
```

* 설명...

###  복잡성이 높은모듈에 대한 Job Flow Diagram

```jobflow
...
```

## RESTful API 요구사항

### 공통

* Base URL은 `/api/v1`
* 인증은 `Authorization: Bearer access_token`
* 응답은 JSON
* 시간은 ISO 8601 문자열
* 페이지네이션은 `page`, `page_size`, `total`
* 표준 오류 응답

```json
{
  "error": {
    "code": "AUTH_EXPIRED",
    "message": "Access token expired",
    "request_id": "req_01JFRW1V6KQZ4QK2S7TQ1N0M3P"
  }
}
```

### 리소스 모델

```json
{
  "issue": {
    "id": "ISSUE-1024",
    "project_id": "PROJ-1",
    "title": "Cannot save settings",
    "status": "Open",
    "priority": "P2",
    "assignee_id": "user-12",
    "tags": ["ui", "settings"],
    "description": "Repro steps and expected behavior",
    "created_at": "2025-12-19T05:10:00Z",
    "updated_at": "2025-12-19T06:00:00Z"
  }
}
```

### Frontend API

* POST `/auth/login`

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

```json
{
  "access_token": "token_01JFRW1V6KQZ4QK2S7TQ1N0M3P",
  "expires_in": 3600,
  "user": {
    "id": "user-12",
    "role": "Member",
    "name": "Ryu"
  }
}
```

* GET `/projects`

```json
{
  "items": [
    {
      "id": "PROJ-1",
      "name": "Core Service"
    }
  ]
}
```

* GET `/issues`

쿼리 파라미터: `project_id`, `q`, `status`, `assignee_id`, `tag`, `sort`, `page`, `page_size`

```json
{
  "items": [
    {
      "id": "ISSUE-1024",
      "project_id": "PROJ-1",
      "title": "Cannot save settings",
      "status": "Open",
      "priority": "P2",
      "assignee_id": "user-12",
      "tags": ["ui", "settings"],
      "updated_at": "2025-12-19T06:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```
