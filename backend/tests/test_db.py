import pytest

from app.db import normalize_database_url


@pytest.mark.parametrize(
    ("provided", "expected"),
    [
        ("postgres://user:pass@host/db", "postgresql+psycopg://user:pass@host/db"),
        ("postgresql://user:pass@host/db", "postgresql+psycopg://user:pass@host/db"),
        ("postgresql+psycopg://user:pass@host/db", "postgresql+psycopg://user:pass@host/db"),
        ("sqlite:///./local.db", "sqlite:///./local.db"),
    ],
)
def test_normalize_database_url(provided: str, expected: str) -> None:
    assert normalize_database_url(provided) == expected
