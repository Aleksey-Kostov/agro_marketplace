from django.db import models


class Category(models.TextChoices):
    VEGETABLES = 'vegetables', 'Vegetables'
    FRUITS = 'fruits', 'Fruits'
    GRAIN = 'grain', 'Grain'
    DAIRY_PRODUCTS = 'dairy-products', 'Dairy Products'
    MUSHROOMS = 'mushrooms', 'Mushrooms'
    HERBS_SPICES = 'herbs-spices', 'Herbs and Spices'
    GRAPES = 'grapes', 'Grapes'
    BEE_PRODUCTS = 'bee-products', 'Bee Products'
    OTHER = 'other', 'Other'


class PriceTypeChoices(models.TextChoices):
    NEGOTIATION = 'negotiation', 'Price by Negotiation'
    ALL_QUANTITY = 'all_quantity', 'Price for All Quantity'
    PER_QUANTITY = 'per_quantity', 'Price per Unit'


class Currency(models.TextChoices):
    LEVA = 'BGN', 'BGN'
    EURO = 'EUR', 'EUR'
    DOLLAR = 'USD', 'USD'


class UnitOfMeasure(models.TextChoices):
    PIECES = 'pc', 'Pieces'
    KG = 'kg', 'Kilograms'
    LITER = 'l', 'Liters'
    METER = 'm', 'Meters'
    BOXES = 'bx', 'Boxes'
    TONS = 't', 'Tons'
