from django import forms


class SearchForm(forms.Form):
    query = forms.CharField(
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Search...'})
    )
    category = forms.ChoiceField(
        required=False,
        choices=[
            ('', 'Select category'),
            ('vegetables', 'Vegetables'),
            ('fruits', 'Fruits'),
            ('grain', 'Grain'),
            ('dairy_products', 'Dairy products'),
            ('mushrooms', 'Mushrooms'),
            ('herbs_spices', 'Herbs and spices'),
            ('grapes', 'Grapes'),
            ('bee_products', 'Bee products'),
            ('other', 'Other'),
        ],
        widget=forms.Select(attrs={'class': 'form-select'})
    )
