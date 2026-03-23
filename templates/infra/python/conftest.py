import pytest
import os
from typing import Generator

@pytest.fixture
def app():
    from app.main import create_app
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

@pytest.fixture(scope="session")
def db_url() -> str:
    return os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql://test:test@localhost:5432/test"
    )

@pytest.fixture(scope="session")
def redis_url() -> str:
    return os.environ.get(
        "TEST_REDIS_URL",
        "redis://localhost:6379/1"
    )
