# Python Project Rules

## Project Structure

```
python-project/
├── run.py                    # Entry point
├── .env                      # Environment variables (gitignored)
├── .env.example              # Environment template
├── requirements.txt          # Dependencies
├── src/
│   ├── main.py               # Application bootstrap
│   ├── config/               # Configuration management
│   │   ├── __init__.py
│   │   └── settings.py       # Dataclass-based settings
│   ├── core/                 # Core business logic modules
│   │   ├── ModuleName/       # PascalCase directory
│   │   │   ├── __init__.py
│   │   │   ├── ModuleName.py # Main class (same name)
│   │   │   └── Helper.py     # Related classes
│   │   └── ...
│   ├── services/             # Service layer
│   │   ├── __init__.py
│   │   └── ServiceName.py
│   ├── utils/                # Utility classes
│   │   ├── __init__.py
│   │   └── UtilityName.py
│   └── test/                 # Test files
│       ├── __init__.py
│       └── test_ModuleName.py
├── docs/                     # Documentation
└── examples/                 # Example code
```

## Naming Conventions

### Files & Directories

| Type             | Convention             | Example                           |
| ---------------- | ---------------------- | --------------------------------- |
| Module directory | PascalCase             | `ProphetModel/`, `ErrorDetector/` |
| Class file       | PascalCase             | `MinioLoader.py`, `LlmService.py` |
| Test file        | snake_case with prefix | `test_MinioLoader.py`             |
| Config file      | snake_case             | `settings.py`                     |
| Entry point      | snake_case             | `run.py`, `main.py`               |

### Code

| Type            | Convention         | Example                |
| --------------- | ------------------ | ---------------------- |
| Class           | PascalCase         | `class ErrorDetector:` |
| Function/Method | snake_case         | `def process_data():`  |
| Variable        | snake_case         | `max_queue_size`       |
| Constant        | UPPER_SNAKE_CASE   | `MAX_RETRIES = 3`      |
| Private         | Leading underscore | `_internal_method()`   |

## Configuration

### Environment Variables (.env)

```bash
# Format: UPPER_SNAKE_CASE
MINIO_ENDPOINT=localhost:9000
LLM_API_KEY=your-api-key
DEBUG_MODE=false
```

### Settings Access

```python
from src.config import settings

# Access via dataclass attributes
settings.minio.endpoint
settings.llm.api_key
settings.debug_mode
```

## Module Structure

### Core Module Pattern

```
src/core/ModuleName/
├── __init__.py          # Export main class
├── ModuleName.py        # Main class with same name
├── SubComponent.py      # Related components
└── types.py             # Type definitions (optional)
```

### **init**.py Pattern

```python
from .ModuleName import ModuleName

__all__ = ["ModuleName"]
```

## Import Rules

### Order

1. Standard library
2. Third-party packages
3. Local modules (src.*)

### Style

```python
# Standard library
import sys
from pathlib import Path

# Third-party
import pandas as pd
from minio import Minio

# Local
from src.config import settings
from src.core.ErrorDetector import ErrorDetector
from src.utils.LogFormatter import LogFormatter
```

## Event-Driven Architecture

### Callback Pattern

```python
class Module:
    def __init__(self):
        self.on_event = None  # Callback placeholder

    def process(self, data):
        if self.on_event:
            self.on_event(result)
```

### Event Wiring (in main.py)

```python
self.module_a.on_data_ready = self.module_b.enqueue
self.module_b.on_processed = self.module_c.analyze
```

## Testing

### Test File Naming

* Location: `src/test/`
* Format: `test_{ModuleName}.py`
* Example: `test_MinioLoader.py`, `test_LlmService.py`

### Run Tests

```bash
python -m pytest src/test/
```

## Execution

### Development

```bash
# Load environment variables
source .venv/bin/activate
python run.py
```

### Entry Point Structure

```python
# run.py
#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.main import main

if __name__ == "__main__":
    main()
```