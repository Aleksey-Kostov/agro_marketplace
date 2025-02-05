# Generated by Django 5.1.3 on 2024-12-10 18:23

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='AppUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('username', models.CharField(max_length=100, unique=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='Profile',
            fields=[
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, serialize=False, to=settings.AUTH_USER_MODEL)),
                ('profile_photo', models.ImageField(blank=True, null=True, upload_to='profile_photo/')),
                ('full_name', models.CharField(blank=True, max_length=100, null=True)),
                ('username_in_marketplace', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('email', models.EmailField(default='default@example.com', max_length=254)),
                ('description', models.CharField(blank=True, max_length=500, null=True)),
                ('country_code', models.CharField(blank=True, choices=[('+1', 'USA (+1)'), ('+44', 'UK (+44)'), ('+91', 'India (+91)'), ('+359', 'Bulgaria (+359)'), ('+33', 'France (+33)'), ('+49', 'Germany (+49)'), ('+81', 'Japan (+81)'), ('+61', 'Australia (+61)'), ('+86', 'China (+86)')], max_length=5, null=True)),
                ('phone', models.CharField(blank=True, max_length=15, null=True)),
                ('town', models.CharField(blank=True, max_length=100, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
