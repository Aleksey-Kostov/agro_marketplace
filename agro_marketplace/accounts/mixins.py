from agro_marketplace.accounts import forms


class EmailFormMixin:
    def clean_email(self):
        email = self.cleaned_data.get('email')
        allowed_domains = [
            'gmail.com',
            'yahoo.com',
            'outlook.com',
            'icloud.com',
            'abv.bg',
            'mail.bg'
        ]
        domain = email.split('@')[-1]
        if domain not in allowed_domains:
            raise forms.ValidationError("Email domain must be one of: {}".format(", ".join(allowed_domains)))
        return email
