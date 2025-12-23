# Navigation Diagram Guide

## 목적

* 화면 전환, API 호출, 내부 로직 흐름을 단순한 스크립트 형식으로 표현해 구조를 빠르게 이해할 수 있게 한다.

## 구성 요소

* **FrontPage**: 화면 이름
  * 예: Home, LoginForm, Dashboard

* **(backend api)**: 백엔드 API 호출
  * 예: (/signin), (/create_order)
  * **명명 규칙**: API 이름은 소문자 알파벳, 숫자, 슬래시 `/`, 밑줄 `_` 만 사용할 수 있다. 그 외 특수 문자는 허용하지 않는다.

* **(process)**: 내부 로직 또는 처리 단계
  * 예: (toast_error), (validation)

## 작성 규칙

1. **Page → Page**
   * 사용자의 동작에 따른 화면 전환
   * 예: `Home --> SignupForm`

2. **Page → API call**
   * 페이지에서 서버로 요청을 보낸다
   * 예: `SignupForm --> (/signup)`

3. **API call → Page**
   * API 응답 결과에 따라 화면 전환 또는 에러 처리
   * 예:
     ```
     (/signup) --> SignupForm : error
     (/signup) --> Classroom
     ```

4. **Page → Internal Process**
   * 페이지 내부에서 로직을 실행한다
   * 예: `CheckoutForm --> (validation)`

5. **Internal Process → Page or API call**
   * 로직이 끝난 뒤 화면을 전환하거나 추가 요청을 보낸다
   * 예:
     ```
     (validation) --> (/create_order)
     (/create_order) --> OrderConfirmation : success
     ```

## 분기

* `: error`, `: success`, `: invalid` 와 같이 상태만 명시한다.
* 규칙: 콜론 뒤 설명문에는 괄호를 사용하지 않는다.

  * 잘못된 예: `: (오류 발생)`
  * 올바른 예: `: 오류 발생`

## 예시

### 회원가입 예시

```navigation
Home --> SignupForm : 사용자가 회원가입 버튼을 클릭
SignupForm --> (/signup)
(/signup) --> SignupForm : error
(/signup) --> Home
```

### 로그인 예시

```navigation
Home --> LoginForm : 사용자가 로그인 버튼을 클릭
LoginForm --> (/signin)
(/signin) --> LoginForm : error
(/signin) --> Home
```

