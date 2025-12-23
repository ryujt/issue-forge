# Job Flow Diagram Guide

## 기본 규칙

### 기본 구조

```jobflow
master: [오케스트레이터 객체]
Object: [객체1], [객체2], [객체3], ...
```

* **master**: 프로세스 흐름을 제어하는 오케스트레이터 객체
* **Object**: 다이어그램에 등장하는 모든 객체 목록 (master 포함)

### master 객체의 역할

* 다른 객체들을 멤버로 소유하고, 이들 간의 협력을 조율한다.
* 모든 `-->`는 master 내부 코드에서 일어나는 흐름을 나타낸다.
* master의 Public 메서드가 시나리오의 시작점이 된다.

### 구성 요소

| 요소 | 표기 | 설명 |
|-----|------|------|
| 메서드 | `Object.MethodName` | Public 메서드 호출 |
| 이벤트 | `Object.OnEventName` | 이벤트 발생 |
| 반환값 | `Object.Method.result` | 메서드 반환값 |
| 조건값 | `Object.Method.value` | 분기 조건 |

### 제한 사항

* 객체 내부 프로세스는 표시하지 않는다 (필요시 `Public → Private` 한 단계만 허용).
* 메서드 파라미터는 표기하지 않는다.

## 표현 규칙

아래 예시에서 `Master`는 master 객체를 의미한다.
* `Master.Method --> B.Method`: master가 자신의 메서드에서 B를 직접 호출
* `A.OnEvent --> B.Method`: master가 A의 이벤트를 B의 메서드에 구독 연결

### 순차 호출

```jobflow
Master.MethodName --> A.MethodName
Master.MethodName --> B.MethodName
```
* master의 메서드가 A와 B를 순차적으로 호출한다.

### 이벤트 구독

```jobflow
A.OnEventName --> B.MethodName
```
* A의 이벤트 발생 시 B의 메서드가 호출된다.
* master 생성자에서 `A.OnEventName += B.MethodName`으로 구독 설정한다.

### 반환값 처리

```jobflow
A.MethodName --> B.MethodName
B.MethodName.result --> A.HandleResult
```
* B의 반환값을 `.result`로 표기한다.
* A가 B를 호출하고 결과를 받아 후속 처리한다.

### 반환값을 다른 객체에 전달

```jobflow
A.OnEventName --> B.MethodName
B.MethodName.result --> C.HandleResult
```
* A의 이벤트로 B가 호출되고, B의 결과를 C가 처리한다.

### 반환값을 받아 다시 전달 (체이닝)

```jobflow
A.MethodName --> B.MethodName
B.MethodName.result --> A.MethodName.result
A.MethodName.result --> C.HandleResult
```
* A가 B를 호출하고 결과를 받는다.
* A가 받은 결과를 C에게 전달한다.

### 반환값에 따른 분기

```jobflow
A.MethodName --> B.MethodName
B.MethodName.Value1 --> C.HandleValue1
B.MethodName.Value2 --> D.HandleValue2
```
* B의 반환값에 따라 다른 객체의 메서드가 호출된다.

### 불리언 분기

```jobflow
A.MethodName --> B.MethodName
B.MethodName.true --> C.HandleTrue
B.MethodName.false --> C.HandleFalse
```

### 단일 조건 분기 (false 무시)

```jobflow
A.MethodName --> B.MethodName
B.MethodName.true --> C.MethodName
```

## 다이어그램 예제

### Job Flow Diagram

```jobflow
master: VideoPlayer
Object: VideoPlayer, FileStream, VideoDecoder, AudioDecoder, VideoRenderer
VideoPlayer.Open --> VideoDecoder.Initialize
VideoPlayer.Open --> AudioDecoder.Initialize
VideoPlayer.Open --> FileStream.Open
VideoPlayer.Play --> FileStream.StartReading
FileStream.OnVideoData --> VideoDecoder.Decode
FileStream.OnAudioData --> AudioDecoder.Decode
VideoRenderer.OnFrameRequested --> VideoDecoder.GetFrameBitmap
VideoDecoder.GetFrameBitmap.result --> VideoRenderer.DrawFrame
```

### 코드 구현 예시 (C#)

```csharp
public class VideoPlayer
{
   private readonly FileStream _fileStream = new FileStream();
   private readonly VideoDecoder _videoDecoder = new VideoDecoder();
   private readonly AudioDecoder _audioDecoder = new AudioDecoder();
   private readonly VideoRenderer _videoRenderer = new VideoRenderer();

   public VideoPlayer()
   {
       _fileStream.OnVideoData += _videoDecoder.Decode;
       _fileStream.OnAudioData += _audioDecoder.Decode;
       _videoRenderer.OnFrameRequested += HandleFrameRequested;
   }

   public void Open(string path)
   {
       _videoDecoder.Initialize();
       _audioDecoder.Initialize();
       _fileStream.Open(path);
   }

   public void Play()
   {
       _fileStream.StartReading();
   }

   private void HandleFrameRequested(object sender, FrameRequestedEventArgs e)
   {
       Bitmap frameBitmap = _videoDecoder.GetFrameBitmap();
       _videoRenderer.DrawFrame(frameBitmap);
   }
}
```

## 재귀적 세분화

### 목적

* 시스템 전체 관점의 Job Flow Diagram을 먼저 작성한다.
* 그 안에서 복잡성이 높은 구성 요소(모듈/객체)를 식별한다.
* 해당 구성 요소를 중심으로 **별도의 Job Flow Diagram을 다시 작성**하여 설계를 세분화한다.
* 이때 **세분화 다이어그램의 master는 “복잡 모듈 객체”**가 된다.

### 예시

#### 시스템 전체 관점의 Job Flow Diagram

```jobflow
master: VideoPlayer
Object: VideoPlayer, FileStream, VideoDecoder, AudioDecoder
... 시스템 전체 관점의 예
```

#### 복잡 모듈 중심으로 재귀적 세분화

```jobflow
master: VideoDecoder
Object: VideoDecoder, Worker, Decoder, Renderer
... VideoDecoder 관점의 예
```

