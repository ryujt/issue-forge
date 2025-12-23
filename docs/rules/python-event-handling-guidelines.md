# 파이썬 이벤트 작성 지침

* 이벤트는 object.on_event 같은 속성으로 정의한다.
* 이벤트 처리기는 함수(또는 메서드)를 직접 할당한다.
* 이벤트 발생 시 내부적으로 해당 핸들러를 호출한다.

 ```python
class Patternizer:
   def __init__(self):
       self.on_template = None
   def extract_template(self, log, ts):
       template = re.sub(r'\d+', '{n}', log)
       if self.on_template:
           self.on_template(template, ts)

class PatternRepository:
   def __init__(self, cooldown_sec=60):
       self.on_is_new = None
       self.on_cooldown_elapsed = None
   def check_and_set(self, template, ts):
       if new_pattern(template, ts):
           if self.on_is_new:
               self.on_is_new(template, ts, 'IsNew')
       else:
           if self.on_cooldown_elapsed:
               self.on_cooldown_elapsed(template, ts, 'CooldownElapsed')

class LogFilter:
   def __init__(self, patternizer, repository):
       self.patternizer = patternizer
       self.repository = repository
       self.on_accepted = None
       self.patternizer.on_template = self.repository.check_and_set
       self.repository.on_is_new = self._handle_accept
       self.repository.on_cooldown_elapsed = self._handle_accept
   def execute(self, log, ts):
       self.patternizer.extract_template(log, ts)
   def _handle_accept(self, template, ts, reason):
       if self.on_accepted:
           self.on_accepted(template, ts, reason)
```

