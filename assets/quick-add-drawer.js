if (!customElements.get('quick-add-opener')) {
  customElements.define(
    'quick-add-opener',
    class QuickAddOpener extends HTMLElement {
      constructor() {
        super();

        this.button = this.querySelector('button');
        this.button.addEventListener('click', this.open.bind(this));
      }

      open() {
        if (this.button.classList.contains('loading')) return;

        const sectionUrl = new URL(this.dataset.productUrl, window.location.origin);
        sectionUrl.searchParams.set('section_id', 'quick-add-drawer');

        this.toggleLoading(true);

        fetch(sectionUrl)
          .then((response) => {
            if (!response.ok) throw new Error(`Quick add drawer request failed: ${response.status}`);
            return response.text();
          })
          .then((responseText) => {
            this.renderSection(responseText);
            // Un produit en rupture n'a pas de drawer, seulement la pop-up Notify me.
            const dialog = document.querySelector('quick-add-drawer') || document.querySelector('.notify-me');
            dialog.show(this.button);
          })
          .catch((error) => {
            console.error(error);
            // La fiche produit reste le moyen d'acheter quand le drawer ne peut pas être chargé.
            window.location.assign(this.dataset.productUrl);
          })
          .finally(() => this.toggleLoading(false));
      }

      renderSection(responseText) {
        const section = new DOMParser().parseFromString(responseText, 'text/html').querySelector('.shopify-section');

        // ModalDialog se déplace lui-même dans le body : les dialogues précédents vivent donc hors de leur section.
        document
          .querySelectorAll(`#${section.id}, quick-add-drawer, .notify-me`)
          .forEach((element) => element.remove());
        document.body.appendChild(section);
      }

      toggleLoading(loading) {
        this.button.classList.toggle('loading', loading);
        this.button.setAttribute('aria-disabled', loading);
        this.querySelector('.loading__spinner').classList.toggle('hidden', !loading);
      }
    }
  );
}

if (!customElements.get('quick-add-drawer')) {
  customElements.define(
    'quick-add-drawer',
    class QuickAddDrawer extends ModalDialog {
      constructor() {
        super();

        this.onModalClosed = this.onModalClosed.bind(this);
        this.addEventListener('change', this.onColorChange.bind(this));
        this.addEventListener('click', this.onNotifyClick.bind(this));
      }

      disconnectedCallback() {
        this.stopListening();
      }

      show(opener) {
        // Drawer tout juste inséré : lire une propriété de layout fige son état fermé, et la transition peut se jouer.
        void this.offsetHeight;
        super.show(opener);

        this.unsubscribeFromCartUpdate = subscribe(PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate.bind(this));
        document.body.addEventListener('modalClosed', this.onModalClosed);
      }

      hide() {
        this.stopListening();
        super.hide();
      }

      stopListening() {
        this.unsubscribeFromCartUpdate?.();
        document.body.removeEventListener('modalClosed', this.onModalClosed);
      }

      onColorChange(event) {
        if (event.target.name !== 'quick-add-color') return;

        this.querySelectorAll('[data-color]').forEach((variants) => {
          variants.hidden = variants.dataset.color !== event.target.value;
        });
      }

      onCartUpdate(event) {
        if (event.source !== 'product-form') return;

        // Le panier rend le focus à l'élément actif à l'envoi : une ligne de ce drawer, sur le point d'être masquée.
        const cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        cart?.setActiveElement(this.openedBy);

        this.hide();
      }

      onNotifyClick(event) {
        const trigger = event.target.closest('[data-notify-variant]');
        if (!trigger) return;

        const popup = document.querySelector('.notify-me');
        popup.querySelector('notify-me-form').reset(trigger.dataset.notifyVariant);
        popup.show(trigger);
      }

      onModalClosed() {
        // La pop-up s'est fermée au-dessus de ce drawer. ModalDialog a débloqué le scroll de la page et, une fois
        // cet événement traité, retire le piège à focus : les deux sont rétablis pour le drawer, toujours ouvert.
        setTimeout(() => {
          document.body.classList.add('overflow-hidden');
          trapFocus(this, document.activeElement);
        });
      }
    }
  );
}

if (!customElements.get('notify-me-form')) {
  customElements.define(
    'notify-me-form',
    class NotifyMeForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.email = this.form.elements.email;
        this.error = this.querySelector('#NotifyMeError');
        this.success = this.querySelector('.notify-me__success');

        this.form.addEventListener('submit', this.onSubmit.bind(this));
        this.email.addEventListener('input', () => this.toggleError(false));
      }

      reset(variantId) {
        this.form.reset();
        this.form.elements.variant.value = variantId;
        this.form.hidden = false;
        this.success.hidden = true;
        this.toggleError(false);
      }

      onSubmit(event) {
        event.preventDefault();

        if (!this.email.checkValidity()) {
          this.toggleError(true);
          this.email.focus();
          return;
        }

        this.subscribe(new FormData(this.form)).then(() => {
          this.form.hidden = true;
          this.success.hidden = false;
          // Les champs du formulaire ont disparu : le piège à focus est reposé sur ce qui reste focalisable.
          trapFocus(this.closest('modal-dialog'), this.success);
        });
      }

      // Aucun service d'alerte de retour en stock n'est branché : la requête est simulée et réussit toujours.
      subscribe(formData) {
        return Promise.resolve(formData);
      }

      toggleError(visible) {
        this.error.hidden = !visible;
        this.email.setAttribute('aria-invalid', visible);
      }
    }
  );
}
