from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserChangeForm, UserCreationForm, AuthenticationForm

from agro_marketplace.accounts.mixins import EmailFormMixin
from agro_marketplace.accounts.models import Profile
from django.core.exceptions import ValidationError


UserModel = get_user_model()


class CustomAuthenticationForm(AuthenticationForm):
    class Meta:
        labels = {
            'username': 'Username',
            'password': 'Password',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = field.widget.attrs.get('class', '') + ' form-control'
            field.widget.attrs['placeholder'] = f"Enter {self.Meta.labels.get(field_name, field_name).lower()}"


class AppUserChangeForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = UserModel


class AppUserCreationForm(EmailFormMixin, UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = UserModel
        fields = ('username',
                  'email',
                  'password1',
                  'password2'
                  )

        labels = {
            'username': 'Username',
            'email': 'Email',
            'password1': 'Password',
            'password2': 'Repeat Password',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = field.widget.attrs.get('class', '') + ' form-control'
            field.widget.attrs['placeholder'] = f"Enter {self.Meta.labels.get(field_name, field_name).lower()}"


class ProfileBaseForm(EmailFormMixin, forms.ModelForm):
    class Meta:
        model = Profile
        fields = [
            'profile_photo',
            'full_name',
            'username_in_marketplace',
            'email',
            'description',
            'country_code',
            'phone',
            'town',
        ]
        labels = {
            'profile_photo': 'Profile Photo',
            'full_name': 'Full Name',
            'username_in_marketplace': 'Name in Marketplace',
            'email': 'Email Address',
            'description': 'Description',
            'country_code': 'Country Code',
            'phone': 'Phone Number',
            'town': 'Town/City',
        }
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'profile_photo': forms.ClearableFileInput(attrs={'class': 'form-control'}),
        }

    def clean_phone(self):
        """
        Custom validation for phone number.
        """
        phone = self.cleaned_data.get('phone')
        if phone:
            if not phone.isdigit():
                raise ValidationError("Phone number must contain only digits.")
            if len(phone) < 9:
                raise ValidationError("Phone number must be at least 9 digits long.")
        return phone

    def clean_full_name(self):
        full_name = self.cleaned_data.get('full_name')
        if full_name and len(full_name.split()) < 2:
            raise forms.ValidationError("Full Name must include at least first name and last name.")
        return full_name

    def clean_profile_photo(self):
        profile_photo = self.cleaned_data.get('profile_photo')
        if profile_photo and profile_photo.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Profile photo size must not exceed 5 MB.")
        return profile_photo

    def __init__(self, *args, **kwargs):
        super(ProfileBaseForm, self).__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = field.widget.attrs.get('class', '') + ' form-control'
            field.widget.attrs['placeholder'] = f"Enter {self.Meta.labels.get(field_name, field_name).lower()}"


class ProfileCreateForm(ProfileBaseForm):
    pass


class ProfileEditForm(ProfileBaseForm):
    new_password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
        required=False,
        label="New Password",
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
        required=False,
        label="Repeat New Password",
    )

    class Meta:
        model = Profile
        fields = ['profile_photo',
                  'full_name',
                  'username_in_marketplace',
                  'email',
                  'country_code',
                  'phone',
                  'town',
                  'description',
                  ]

        labels = {
            'profile_photo': 'Profile Photo',
            'full_name': 'Full Name',
            'username_in_marketplace': 'Name in Marketplace',
            'email': 'Email Address',
            'description': 'Description',
            'country_code': 'Country Code',
            'phone': 'Phone Number',
            'town': 'Town/City',
            'confirm_password': 'Confirm Password',
            'new_password': 'New Password',
        }

        widgets = {
            'profile_photo': forms.ClearableFileInput(attrs={'class': 'profile-photo-input'}),
            'full_name': forms.TextInput(attrs={'class': 'form-control'}),
            'username_in_marketplace': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'country_code': forms.Select(attrs={'class': 'form-control'}),
            'phone': forms.TextInput(attrs={'class': 'form-control'}),
            'town': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'rows': 4}),
        }

    def clean_new_password(self):
        """
        Custom validation for new password.
        """
        new_password = self.cleaned_data.get("new_password")
        if new_password:
            if len(new_password) < 8:
                raise ValidationError("Password must be at least 8 characters long.")
        return new_password

    def clean(self):
        """
        Perform cross-field validation for the form.
        """
        cleaned_data = super().clean()
        new_password = cleaned_data.get("new_password")
        confirm_password = cleaned_data.get("confirm_password")

        if new_password or confirm_password:
            if new_password != confirm_password:
                self.add_error('confirm_password', "Passwords do not match.")

        return cleaned_data
