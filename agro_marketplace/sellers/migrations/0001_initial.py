# Generated by Django 5.1.3 on 2024-12-10 18:23

import agro_marketplace.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SellerItems',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('slug', models.SlugField(blank=True, max_length=300, unique=True)),
                ('category', models.CharField(choices=[('vegetables', 'Vegetables'), ('fruits', 'Fruits'), ('grain', 'Grain'), ('dairy-products', 'Dairy Products'), ('mushrooms', 'Mushrooms'), ('herbs-spices', 'Herbs and Spices'), ('grapes', 'Grapes'), ('bee-products', 'Bee Products'), ('other', 'Other')], max_length=20)),
                ('location', models.CharField(max_length=255)),
                ('description', models.TextField()),
                ('photo_1', models.ImageField(blank=True, null=True, upload_to='seller_items/', validators=[agro_marketplace.validators.FileSizeValidator(5)])),
                ('photo_2', models.ImageField(blank=True, null=True, upload_to='seller_items/', validators=[agro_marketplace.validators.FileSizeValidator(5)])),
                ('photo_3', models.ImageField(blank=True, null=True, upload_to='seller_items/', validators=[agro_marketplace.validators.FileSizeValidator(5)])),
                ('photo_4', models.ImageField(blank=True, null=True, upload_to='seller_items/', validators=[agro_marketplace.validators.FileSizeValidator(5)])),
                ('phone', models.CharField(blank=True, max_length=15, null=True)),
                ('quantity', models.PositiveIntegerField()),
                ('price_type', models.CharField(choices=[('negotiation', 'Price by Negotiation'), ('all_quantity', 'Price for All Quantity'), ('per_quantity', 'Price per Unit')], default='negotiation', max_length=20)),
                ('price_per_unit', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('price_all_quantity', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('currency', models.CharField(choices=[('BGN', 'BGN'), ('EUR', 'EUR'), ('USD', 'USD')], default='BGN', max_length=3)),
                ('unit_of_measure', models.CharField(choices=[('pc', 'Pieces'), ('kg', 'Kilograms'), ('l', 'Liters'), ('m', 'Meters'), ('bx', 'Boxes'), ('t', 'Tons')], default='kg', max_length=3)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expiration_date', models.DateTimeField(blank=True, editable=False, null=True)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seller_products', to='accounts.profile')),
            ],
        ),
    ]
