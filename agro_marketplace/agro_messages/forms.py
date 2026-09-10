from django import forms
from .models import Message


class MessageForm(forms.ModelForm):
    class Meta:
        model = Message
        fields = ['body', 'image', 'video']
        widgets = {
            'body': forms.Textarea(attrs={
                'rows': 4,
                'class': 'form-control',
                'placeholder': 'Write your message...',
                'id': 'message-body-input',
            }),
            'image': forms.ClearableFileInput(attrs={
                'class': 'form-control',
                'accept': 'image/*',
            }),
            'video': forms.ClearableFileInput(attrs={
                'class': 'form-control',
                'accept': 'video/*',
            }),
        }
        labels = {
            'body': '',
            'image': '',
            'video': '',
        }
