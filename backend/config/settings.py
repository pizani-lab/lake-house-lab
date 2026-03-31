"""LakeHouse Lab — Django Settings"""
import os
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(os.path.join(BASE_DIR.parent, ".env"))
# .env.local sobrepõe .env — use para overrides locais sem modificar o .env do Docker
_env_local = os.path.join(BASE_DIR.parent, ".env.local")
if os.path.exists(_env_local):
    environ.Env.read_env(_env_local, overwrite=True)

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "corsheaders", "django_celery_results",
    "rest_framework_simplejwt", "lakehouse",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

DATABASES = {"default": env.db("DATABASE_URL", default="sqlite:///db.sqlite3")}

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = "django-db"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}

CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]

# LLM Provider ("anthropic" ou "ollama")
LLM_PROVIDER = env("LLM_PROVIDER", default="ollama")

# Anthropic
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", default="claude-sonnet-4-20250514")

# Ollama
OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="http://localhost:11434")
OLLAMA_MODEL = env("OLLAMA_MODEL", default="llama3")

# LakeHouse Paths
DATA_DIR = Path(env("DATA_DIR", default=str(BASE_DIR.parent / "data")))
BRONZE_DIR = Path(env("BRONZE_DIR", default=str(DATA_DIR / "bronze")))
SILVER_DIR = Path(env("SILVER_DIR", default=str(DATA_DIR / "silver")))
GOLD_DIR = Path(env("GOLD_DIR", default=str(DATA_DIR / "gold")))
DUCKDB_PATH = env("DUCKDB_PATH", default=str(DATA_DIR / "lakehouse.duckdb"))

# dbt
DBT_PROJECT_DIR = env("DBT_PROJECT_DIR", default=str(BASE_DIR.parent / "dbt_project"))
DBT_PROFILES_DIR = env("DBT_PROFILES_DIR", default=str(BASE_DIR.parent / "dbt_project"))

# Ensure data dirs exist (silencia PermissionError em ambientes sem /data, ex: testes locais)
for d in [DATA_DIR, BRONZE_DIR, SILVER_DIR, GOLD_DIR]:
    try:
        d.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        pass

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [],
    "APP_DIRS": True, "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug", "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages",
    ]},
}]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB
