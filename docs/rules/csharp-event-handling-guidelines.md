# C# 이벤트 사용 가이드

```csharp
using System;

namespace EventGuide
{
    public class Worker
    {
        public event Action<int> Done;
        public event Action<string> Error;

        public void Run()
        {
            try
            {
                Console.WriteLine("작업 실행 중...");
                int result = 42;
                Done?.Invoke(result);
            }
            catch (Exception e)
            {
                Error?.Invoke(e.Message);
            }
        }
    }

    public static class Program
    {
        static void HandleDone(int result)
        {
            Console.WriteLine($"작업 완료, 결과: {result}");
        }

        static void HandleError(string message)
        {
            Console.WriteLine($"에러 발생: {message}");
        }

        public static void Main(string[] args)
        {
            var worker = new Worker();
            worker.Done += HandleDone;
            worker.Error += HandleError;
            worker.Run();
        }
    }
}
```