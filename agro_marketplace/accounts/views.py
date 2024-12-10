from datetime import timedelta

from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView
from django.core.paginator import Paginator
from django.http import Http404, HttpResponseForbidden
from django.shortcuts import redirect, render, get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import CreateView, FormView, UpdateView, View

from .forms import AppUserCreationForm, ProfileCreateForm, CustomAuthenticationForm, ProfileEditForm
from .helper import get_combined_items, get_item_by_slug
from .models import Profile
from django.utils.timezone import now

UserModel = get_user_model()


class AppUserLoginView(LoginView):
    template_name = 'accounts/user-login.html'

    def get_form_class(self):
        return CustomAuthenticationForm


class AppUserRegisterView(CreateView):
    model = UserModel
    form_class = AppUserCreationForm
    template_name = 'accounts/user-registration.html'
    success_url = reverse_lazy('profile-registration')

    def form_valid(self, form):
        response = super().form_valid(form)
        login(self.request, self.object)
        return response


class ProfileRegistrationView(FormView, UpdateView):
    form_class = ProfileCreateForm
    template_name = 'accounts/profile-registration.html'
    success_url = reverse_lazy('dash')

    def get_object(self, queryset=None):
        return Profile.objects.get(user=self.request.user)

    def form_valid(self, form):
        profile = form.save(commit=False)
        profile.user = self.request.user
        profile.save()
        return super().form_valid(form)


def custom_logout(request):
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect('home')


def profile_details(request, pk):
    profile = get_object_or_404(Profile, pk=pk)
    active_seller_items = profile.seller_products.filter(expiration_date__gte=now())
    active_buyer_items = profile.buyer_products.filter(expiration_date__gte=now())
    context = {
        'profile': profile,
        'active_seller_items': active_seller_items,
        'active_buyer_items': active_buyer_items,
    }
    return render(request, 'accounts/profile-details.html', context)


class EditProfileView(LoginRequiredMixin, UpdateView):
    model = Profile
    form_class = ProfileEditForm
    template_name = 'accounts/profile-edit.html'
    success_url = reverse_lazy('dash')

    def get_object(self, queryset=None):
        return Profile.objects.get(user=self.request.user)

    def form_valid(self, form):
        """
        Handle profile editing and optional password change.
        """
        new_password = self.request.POST.get('new_password')
        confirm_password = self.request.POST.get('confirm_password')

        # Save the updated Profile object
        profile = form.save(commit=False)
        profile.save()

        if new_password or confirm_password:
            if new_password != confirm_password:
                form.add_error(None, "Passwords do not match.")
                return self.form_invalid(form)
            elif new_password.strip() == "":
                form.add_error(None, "Password cannot be blank.")
                return self.form_invalid(form)
            else:
                self.request.user.set_password(new_password)
                self.request.user.save()

                logout(self.request)

                messages.success(self.request, "Password updated successfully. Please log in again.")
                return redirect('login')

        messages.success(self.request, "Profile updated successfully.")
        return super().form_valid(form)


class ProfileDeleteView(LoginRequiredMixin, View):
    template_name = 'accounts/profile-delete.html'

    def get(self, request, pk):
        """Render the profile deletion confirmation page."""
        profile = get_object_or_404(Profile, pk=pk)

        if profile.user != request.user:
            messages.error(request, "You are not authorized to delete this profile.")
            return HttpResponseForbidden("You are not authorized to delete this profile.")

        return render(request, self.template_name, {'profile': profile})

    def post(self, request, pk):
        """Handle profile and user deletion."""
        profile = get_object_or_404(Profile, pk=pk)

        if profile.user != request.user:
            messages.error(request, "You are not authorized to delete this profile.")
            return HttpResponseForbidden("You are not authorized to delete this profile.")

        user = profile.user
        profile.delete()
        user.delete()

        messages.success(request, "Your account and profile have been successfully deleted.")
        return redirect(reverse_lazy('home'))


def delete_item(request, slug):
    item = get_item_by_slug(slug)
    if not item:
        raise Http404("Item not found.")

    is_active = item.expiration_date >= now()

    if request.method == 'POST':
        item.delete()
        return redirect('active-listings' if is_active else 'inactive-listings', pk=item.profile.pk)

    return render(request, 'accounts/item-delete.html', {'object': item})


def activ_listings(request, pk):
    profile = get_object_or_404(Profile, pk=pk)
    combined_items = get_combined_items(profile, expiration_check='active')

    paginator = Paginator(combined_items, 5)
    page_number = request.GET.get('page', 1)
    items_page = paginator.get_page(page_number)

    return render(request, 'accounts/profile-activ-listings.html', {
        'items_page': items_page,
        'profile_pk': pk,
    })


def inactive_listings(request, pk):
    profile = get_object_or_404(Profile, pk=pk)
    combined_items = get_combined_items(profile, expiration_check='inactive')

    paginator = Paginator(combined_items, 5)
    page_number = request.GET.get('page', 1)
    items_page = paginator.get_page(page_number)

    return render(request, 'accounts/profile-inactive-listings.html', {
        'items_page': items_page,
        'profile_pk': pk,
    })


def activate_item(request, slug):
    item = get_item_by_slug(slug, expiration_check='inactive')
    if not item:
        raise Http404("Item not found, expired, or does not belong to the user.")

    item.expiration_date = now() + timedelta(days=30)
    item.save()
    return redirect('inactive-listings', pk=request.user.pk)
