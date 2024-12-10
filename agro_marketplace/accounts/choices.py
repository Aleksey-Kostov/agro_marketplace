from django.db import models


class CountryCode(models.TextChoices):
    USA = "+1", "USA (+1)"
    UK = "+44", "UK (+44)"
    INDIA = "+91", "India (+91)"
    BULGARIA = "+359", "Bulgaria (+359)"
    FRANCE = "+33", "France (+33)"
    GERMANY = "+49", "Germany (+49)"
    JAPAN = "+81", "Japan (+81)"
    AUSTRALIA = "+61", "Australia (+61)"
    CHINA = "+86", "China (+86)"
