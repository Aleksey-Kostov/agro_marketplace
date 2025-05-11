from pathlib import Path
from decouple import config, UndefinedValueError
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='').split(',')
CSRF_TRUSTED_ORIGINS = list(filter(None, config('CSRF_TRUSTED_ORIGINS', default='').split(',')))

# STATIC & MEDIA
if DEBUG:
    STATIC_URL = '/static/'
    MEDIA_URL = '/media/'
    STATICFILES_DIRS = [BASE_DIR / "static"]
    MEDIA_ROOT = BASE_DIR / 'media'
else:
    try:
        AZURE_CONNECTION_STRING = config('AZURE_CONNECTION_STRING')
        AZURE_ACCOUNT_NAME = config('AZURE_ACCOUNT_NAME')
        AZURE_CONTAINER = config('AZURE_CONTAINER', default='static-content')
        AZURE_MEDIA_CONTAINER = config('AZURE_MEDIA_CONTAINER', default='media-content')
        AZURE_CUSTOM_DOMAIN = f"{AZURE_ACCOUNT_NAME}.blob.core.windows.net"

        STATIC_URL = f"https://{AZURE_CUSTOM_DOMAIN}/{AZURE_CONTAINER}/"
        MEDIA_URL = f"https://{AZURE_CUSTOM_DOMAIN}/{AZURE_MEDIA_CONTAINER}/"

        STORAGES = {
            "default": {
                "BACKEND": "agro_marketplace.core.storage_backends.MediaAzureStorage",
            },
            "staticfiles": {
                "BACKEND": "agro_marketplace.core.storage_backends.StaticAzureStorage",
            },
        }
    except UndefinedValueError as e:
        raise Exception("Missing Azure environment variables for production.") from e

    STATICFILES_DIRS = [BASE_DIR / "static"]

STATIC_ROOT = BASE_DIR / 'staticfiles'

# DJANGO APPS
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'storages',

    # Local apps
    "agro_marketplace.accounts",
    "agro_marketplace.buyers",
    "agro_marketplace.common",
    "agro_marketplace.sellers",
    "agro_marketplace.agro_messages",
]

# MIDDLEWARE
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware' if DEBUG else None,
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
MIDDLEWARE = [mw for mw in MIDDLEWARE if mw is not None]

# URL & TEMPLATES
ROOT_URLCONF = 'agro_marketplace.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'agro_marketplace.wsgi.application'

# DATABASES
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config('DB_NAME'),
        "USER": config('DB_USER'),
        "PASSWORD": config('DB_PASSWORD'),
        "HOST": config('DB_HOST'),
        "PORT": config('DB_PORT'),
    }
}

# AUTH
AUTH_USER_MODEL = 'accounts.AppUser'
LOGIN_REDIRECT_URL = 'dash'
LOGOUT_REDIRECT_URL = 'home'

# PASSWORD VALIDATORS
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# LOCALE
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Europe/Sofia'
USE_I18N = True
USE_TZ = False

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
