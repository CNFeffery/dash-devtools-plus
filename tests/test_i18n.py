import re
from pathlib import Path


I18N_DIR = Path(__file__).parents[1] / "frontend" / "src" / "i18n"
KEY_PATTERN = re.compile(r"^\s*([A-Za-z0-9_]+):", re.MULTILINE)


def _dictionary_keys(filename: str) -> set[str]:
    source = (I18N_DIR / filename).read_text(encoding="utf-8")
    return set(KEY_PATTERN.findall(source))


def test_english_and_chinese_dictionaries_have_identical_keys():
    assert _dictionary_keys("en.js") == _dictionary_keys("zh-CN.js")
