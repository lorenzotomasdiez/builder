{# Tests
# Jinja - Unit Test (Model)

import pytest
from app.models.user import User


def test_user_creation():
    user = User(email="test@example.com", hashed_password="hash")
    assert user.email == "test@example.com"
    assert user.is_active is True


def test_user_default_values():
    user = User(email="test@example.com", hashed_password="hash")
    assert user.role == "user"
