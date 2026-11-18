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
            document.querySelector('quick-add-drawer').show(this.button);
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

        // ModalDialog se déplace lui-même dans le body : le drawer précédent vit donc hors de sa section.
        document.querySelectorAll(`#${section.id}, quick-add-drawer`).forEach((element) => element.remove());
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
      show(opener) {
        // Drawer tout juste inséré : lire une propriété de layout fige son état fermé, et la transition peut se jouer.
        void this.offsetHeight;
        super.show(opener);
      }
    }
  );
}
