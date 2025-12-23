# Layout Diagram Guide

## 기본 구조

```layout
Screen V Header, Main, Footer
Header > Logo, Search, UserMenu
Main > Left Sidebar : 20, Content
Content V Title, Filters, Table, Pager
Footer > Status, Version
```

* 각 줄은 “왼쪽 컨테이너”의 자식 배치 방향과 자식 목록을 선언한다.
* 첫 줄은 루트 컨테이너를 선언한다. 관례적으로 `Screen`을 사용한다.

## 방향 연산자

| 연산자 | 의미    | 자식 배치 순서 |
| --- | ----- | -------- |
| `V` | 세로 적층 | 위에서 아래   |
| `>` | 가로 배치 | 왼쪽에서 오른쪽 |

## 문법

### 기본 문법

```layout
Container1 V Child1, Child2, ...
Container2 > Child1, Child2, ...
```

* `Container`는 “영역 컨테이너” 이름이다.
* `Child`는 “하위 영역(컨테이너 또는 컴포넌트)” 이름이다.
* 자식은 콤마 `,`로 구분하며, 순서가 곧 배치 순서다.
* 이름은 공백을 포함할 수 있다. 구분은 연산자(`V` 또는 `>`)와 콤마로만 한다.

### 크기 지정

```layout
Container1 > Child1 : 20, Child2 : 80
Container2 > Child1 : 40, Child2
ContainerX V Child1 : 10, Child2 : 80, Child3 : 10
```

* 비율을 지정하고 싶을 때에는 `Child` 다음 `: %`를 붙여서 차지하는 크기를 지정한다.
* `Container2`의 경우 크기가 지정된 `Child`와 지정안된 `Child`가 섞여 있는 경우 크기 지정안된 `Child`들은 남은 영역을 같은 크기로 나눠서 차지한다.
* 세로의 경우에는 크기 지정을 무시한다. 따라서 `ContainerX`의 `Child` 크기 지정 코드는 모두 무시된다.

## 컨테이너와 컴포넌트

* 컨테이너: 좌변에 등장하는 이름(예: `Header`, `Main`, `Content`)
  * 내부에 다른 자식을 가지며, 별도 줄로 레이아웃을 정의한다.
* 컴포넌트: 좌변에 등장하지 않는 이름(예: `Logo`, `Search`, `Title` 등)
  * 더 이상 분해하지 않는 말단 요소로 간주한다.

## 제한 사항

* 좌표, 픽셀, 여백, 정렬 같은 시각 스타일은 다루지 않는다.
* 같은 컨테이너를 여러 줄에서 중복 정의하지 않는다.
* 자식 목록에 등장한 컨테이너는 반드시 어딘가에서 좌변으로 정의되어야 한다(루트 제외 가능).

## 기본 구조를 HTML로 표현한 결과

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Layout Test</title>
  <style>
    html, body {
      height: 100%;
      margin: 0;
    }
    .layout-preview {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      overflow: auto;
    }
    .layout-container {
      display: flex;
      gap: 8px;
      padding: 8px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      min-height: 40px;
      min-width: 0;
    }
    .layout-vertical {
      flex-direction: column;
    }
    .layout-horizontal {
      flex-direction: row;
    }
    .layout-component {
      padding: 8px 12px;
      border: 1px dashed #adb5bd;
      border-radius: 4px;
      background: #e9ecef;
      color: #495057;
      text-align: center;
      white-space: nowrap;
    }
    .layout-container > .layout-container:not([style]),
    .layout-container > .layout-component:not([style]) {
      flex: 1;
    }
  </style>
</head>
<body>
  <div class="layout-preview">
    <div id="screen" class="layout-container layout-vertical">
      <div id="header" class="layout-container layout-horizontal">
        <div id="logo" class="layout-component">Logo</div>
        <div id="search" class="layout-component">Search</div>
        <div id="userMenu" class="layout-component">UserMenu</div>
      </div>
      <div id="main" class="layout-container layout-horizontal">
        <div id="leftSidebar" class="layout-component" style="flex: 0 0 20%">Left Sidebar</div>
        <div id="content" class="layout-container layout-vertical">
          <div id="title" class="layout-component">Title</div>
          <div id="filters" class="layout-component">Filters</div>
          <div id="table" class="layout-component">Table</div>
          <div id="pager" class="layout-component">Pager</div>
        </div>
      </div>
      <div id="footer" class="layout-container layout-horizontal">
        <div id="status" class="layout-component">Status</div>
        <div id="version" class="layout-component">Version</div>
      </div>
    </div>
  </div>
</body>
</html>
```