from django import forms
from .models import SellerItems


class SellersForm(forms.ModelForm):
    class Meta:
        model = SellerItems
        fields = [
            'title',
            'category',
            'location',
            'description',
            'photo_1',
            'photo_2',
            'photo_3',
            'photo_4',
            'phone',
            'quantity',
            'unit_of_measure',
            'price_type',
            'price_per_unit',
            'currency',
            'price_all_quantity',
        ]

        labels = {
            'title': 'Product Title',
            'category': 'Product Category',
            'location': 'Location',
            'description': 'Product Description',
            'photo_1': 'Product Photo 1',
            'photo_2': 'Product Photo 2',
            'photo_3': 'Product Photo 3',
            'photo_4': 'Product Photo 4',
            'phone': 'Contact Phone',
            'quantity': 'Sell Quantity',
            'unit_of_measure': 'Unit of Measure',
            'price_type': 'Price Type',
            'price_per_unit': 'Price Per Unit',
            'currency': 'Currency',
            'price_all_quantity': 'Total Price for All Quantity',
        }

        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'price_per_unit': forms.NumberInput(attrs={'step': 'any'}),
            'price_all_quantity': forms.NumberInput(attrs={'step': 'any'}),
        }

    def __init__(self, *args, **kwargs):
        super(SellersForm, self).__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            field.widget.attrs['class'] = field.widget.attrs.get('class', '') + ' form-control'
            field.widget.attrs['placeholder'] = f"Enter {self.Meta.labels.get(field_name, field_name).lower()}"

    def clean_phone(self):
        phone = self.cleaned_data.get('phone')
        if phone:
            if not phone.isdigit() or len(phone) < 10:
                raise forms.ValidationError("Phone number must be at least 10 digits and contain only numbers.")
        return phone

    def clean_price_per_unit(self):
        price_type = self.cleaned_data.get('price_type')
        price_per_unit = self.cleaned_data.get('price_per_unit')
        if price_type == 'per_quantity' and not price_per_unit:
            raise forms.ValidationError("Price per unit is required when price type is 'per_quantity'.")

        return price_per_unit

    def clean_price_all_quantity(self):
        price_type = self.cleaned_data.get('price_type')
        price_all_quantity = self.cleaned_data.get('price_all_quantity')
        if price_type == 'all_quantity' and not price_all_quantity:
            raise forms.ValidationError("Total price for all quantity is required when price type is 'all_quantity'.")

        return price_all_quantity

    def clean_description(self):
        description = self.cleaned_data.get('description', '').strip()
        if len(description) < 50:
            raise forms.ValidationError("The description for Seller must be at least 50 characters long.")
        return description

    def clean_quantity(self):
        quantity = self.cleaned_data.get('quantity')
        if quantity is None or quantity <= 0:
            raise forms.ValidationError("Buy Quantity must be greater than zero.")
        return quantity

    def clean_title(self):
        title = self.cleaned_data.get('title', '').strip()
        if not title:
            raise forms.ValidationError("The Product Title field cannot be empty.")
        return title

    def clean_category(self):
        category = self.cleaned_data.get('category', '').strip()
        if not category:
            raise forms.ValidationError("The Product Category field cannot be empty.")
        return category

    def clean_location(self):
        location = self.cleaned_data.get('location', '').strip()
        if not location:
            raise forms.ValidationError("The Location field cannot be empty.")
        return location
