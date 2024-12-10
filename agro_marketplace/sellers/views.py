from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse_lazy, reverse
from django.views.generic import UpdateView

from agro_marketplace.sellers.forms import SellersForm
from agro_marketplace.sellers.models import SellerItems
from django.contrib import messages


def card_info_sellers(request, pk):
    item = get_object_or_404(SellerItems, pk=pk)
    return render(request, 'sellers/card-info-sellers.html', {'item': item})


@login_required
def create_seller(request):

    if request.method == 'POST':
        form = SellersForm(request.POST, request.FILES)
        if form.is_valid():
            seller_item = form.save(commit=False)
            seller_item.profile = request.user.profile
            seller_item.save()
            return redirect(reverse('dash'))
    else:
        form = SellersForm()

    return render(request, 'sellers/sellers-form.html', {'seller_form': form})


class SellerEditView(LoginRequiredMixin, UpdateView):
    model = SellerItems
    form_class = SellersForm
    template_name = 'sellers/sellers-edit.html'

    def get_object(self, queryset=None):
        """Ensure the logged-in user owns the seller item."""
        seller_item = get_object_or_404(SellerItems, pk=self.kwargs['pk'])
        if seller_item.profile.user != self.request.user:
            messages.error(self.request, "You are not authorized to edit this item.")
            return redirect('dash')
        return seller_item

    def form_valid(self, form):
        """Display success message and redirect to active listings."""
        self.object = form.save()
        profile = self.request.user.profile

        messages.success(self.request, "Seller item updated successfully!")
        return redirect('active-listings', pk=profile.pk)

    def form_invalid(self, form):
        """Handle invalid form submission."""
        messages.error(self.request, "There was an error updating the seller item. Please correct the errors below.")
        return self.render_to_response(self.get_context_data(form=form))
