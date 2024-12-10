from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import UpdateView

from agro_marketplace.buyers.forms import BuyersForm
from agro_marketplace.buyers.models import BuyerItems
from django.contrib import messages


def card_info_buyer(request, pk):
    item = get_object_or_404(BuyerItems, pk=pk)
    return render(request, 'buyers/card-info-buyers.html', {'item': item})


@login_required
def create_buyer(request):

    if request.method == 'POST':
        form = BuyersForm(request.POST, request.FILES)
        if form.is_valid():
            buyer_item = form.save(commit=False)
            buyer_item.profile = request.user.profile
            buyer_item.save()
            return redirect(reverse_lazy('dash'))
    else:
        form = BuyersForm()

    return render(request, 'buyers/buyers-form.html', {'buyer_form': form})


class BuyerEditView(LoginRequiredMixin, UpdateView):
    model = BuyerItems
    form_class = BuyersForm
    template_name = 'buyers/buyers-edit.html'

    def get_object(self, queryset=None):
        """Ensure the logged-in user owns the seller item."""
        buyer_item = get_object_or_404(BuyerItems, pk=self.kwargs['pk'])
        if buyer_item.profile.user != self.request.user:
            messages.error(self.request, "You are not authorized to edit this item.")
            return redirect('dash')
        return buyer_item

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
