from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.views.generic import UpdateView

from agro_marketplace.sellers.forms import SellersForm
from agro_marketplace.sellers.models import SellerItems


# ============================================================
# SELLER ITEM DETAILS
# ============================================================

@login_required
def card_info_sellers(request, pk):
    """
    Показва детайлите на конкретна seller обява.
    """

    item = get_object_or_404(
        SellerItems,
        pk=pk,
    )

    return render(
        request,
        'sellers/card-info-sellers.html',
        {
            'item': item,
        },
    )


# ============================================================
# CREATE SELLER ITEM
# ============================================================

@login_required
def create_seller(request):
    """
    Създава нова seller обява за текущия user.

    profile винаги се взима от request.user.profile,
    а не от POST данните.
    """

    if request.method == 'POST':

        form = SellersForm(
            request.POST,
            request.FILES,
        )

        if form.is_valid():

            seller_item = form.save(
                commit=False
            )

            # ------------------------------------------------
            # Owner
            # ------------------------------------------------

            seller_item.profile = request.user.profile

            seller_item.save()

            messages.success(
                request,
                "Seller item created successfully!",
            )

            return redirect(
                reverse('dash')
            )

    else:

        form = SellersForm()

    return render(
        request,
        'sellers/sellers-form.html',
        {
            'seller_form': form,
        },
    )


# ============================================================
# EDIT SELLER ITEM
# ============================================================

class SellerEditView(
    LoginRequiredMixin,
    UpdateView,
):
    """
    Редактира seller обява.

    Само собственикът на обявата може да я редактира.
    """

    model = SellerItems
    form_class = SellersForm
    template_name = 'sellers/sellers-edit.html'

    # --------------------------------------------------------
    # OBJECT
    # --------------------------------------------------------

    def get_object(self, queryset=None):
        """
        Връща seller обявата само ако текущият user е собственик.

        Не използваме redirect от get_object(), защото Django
        очаква този метод да върне object.
        """

        seller_item = get_object_or_404(
            SellerItems,
            pk=self.kwargs['pk'],
        )

        if seller_item.profile.user != self.request.user:
            raise PermissionDenied(
                "You are not authorized to edit this item."
            )

        return seller_item

    # --------------------------------------------------------
    # VALID FORM
    # --------------------------------------------------------

    def form_valid(self, form):
        """
        Записва промените и връща user-а към active listings.
        """

        self.object = form.save()

        profile = self.request.user.profile

        messages.success(
            self.request,
            "Seller item updated successfully!",
        )

        return redirect(
            'active-listings',
            pk=profile.pk,
        )

    # --------------------------------------------------------
    # INVALID FORM
    # --------------------------------------------------------

    def form_invalid(self, form):
        """
        Показва формата отново при грешки.
        """

        messages.error(
            self.request,
            "There was an error updating the seller item. "
            "Please correct the errors below.",
        )

        return self.render_to_response(
            self.get_context_data(
                form=form,
            )
        )
