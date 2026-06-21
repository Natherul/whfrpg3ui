class WFRP3eHUD extends Application {
  constructor(options = {}) {
    super(options);
    this.hookId = Hooks.on("updateActor", this._onActorUpdate.bind(this));
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wfrp3e-player-hud",
      title: "WFRP3e HUD",
      template: "modules/wfrp3e-player-hud/templates/hud.hbs",
      popOut: true,
      width: game.user.isGM ? 600 : 300,
      height: "auto",
      resizable: true,
      minimizable: true,
      closable: false,
      classes: ["wfrp3e-hud-app"]
    });
  }

  async _render(force, options) {
    await super._render(force, options);
    
    // Set a default position at bottom left if it hasn't been moved/saved
    // We check if it's currently at the default center position or missing
    if (!this.position.left || this.position.left === (window.innerWidth - this.position.width) / 2) {
      this.setPosition({
        left: 15,
        top: window.innerHeight - this.element.height() - 80
      });
    }
  }

  getData() {
    const isGM = game.user.isGM;
    let characters = [];
    let character = null;

    if (isGM) {
      // GM sees all player characters
      characters = game.actors.filter(a => a.hasPlayerOwner && a.type === "character");
    } else {
      // Player sees their assigned character
      character = game.user.character;
    }

    return {
      isGM,
      characters,
      character
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Handle Add XP button
    html.find('.add-xp-btn').click(async (event) => {
      event.preventDefault();
      if (!game.user.isGM) return;

      const characters = game.actors.filter(a => a.hasPlayerOwner && a.type === "character");
      let count = 0;
      for (const actor of characters) {
        let currentTotal = foundry.utils.getProperty(actor, "system.experience.total") || 0;
        await actor.update({ "system.experience.total": currentTotal + 1 });
        count++;
      }
      ui.notifications.info(`Added 1 XP to ${count} characters.`);
    });

    // Handle plus/minus buttons
    html.find('.stat-btn').click(async (event) => {
      event.preventDefault();
      const btn = event.currentTarget;
      const action = btn.dataset.action;
      const statPath = btn.dataset.stat;
      const container = $(btn).closest('.wfrp3e-hud-character');
      const actorId = container.data('actor-id');
      const actor = game.actors.get(actorId);

      if (!actor) return;

      let currentValue = foundry.utils.getProperty(actor, statPath) || 0;
      
      if (action === 'increase') {
        currentValue++;
      } else if (action === 'decrease') {
        currentValue--;
      }

      await actor.update({ [statPath]: currentValue });
    });

    // Handle direct input change
    html.find('.stat-input').change(async (event) => {
      event.preventDefault();
      const input = event.currentTarget;
      const statPath = input.dataset.stat;
      let value = parseInt(input.value, 10);
      
      if (isNaN(value)) return;

      const container = $(input).closest('.wfrp3e-hud-character');
      const actorId = container.data('actor-id');
      const actor = game.actors.get(actorId);

      if (!actor) return;

      await actor.update({ [statPath]: value });
    });
  }

  _onActorUpdate(actor, data, options, userId) {
    // Only re-render if it's a character we care about
    if (actor.type !== "character") return;
    
    if (game.user.isGM) {
      if (actor.hasPlayerOwner) {
        this.render(false);
      }
    } else {
      if (game.user.character && actor.id === game.user.character.id) {
        this.render(false);
      }
    }
  }

  close(options) {
    Hooks.off("updateActor", this.hookId);
    return super.close(options);
  }
}

Hooks.once('ready', () => {
  // Only show for users who have a character, or GMs
  if (game.user.isGM || game.user.character) {
    window.wfrp3eHUD = new WFRP3eHUD();
    window.wfrp3eHUD.render(true);
  } else {
    ui.notifications.warn("WFRP3e HUD: No character assigned to your user.");
  }
});

// Add a button to the token controls to reopen the HUD if closed
Hooks.on('getSceneControlButtons', (controls) => {
  const tokenControls = controls.find(c => c.name === 'token');
  if (tokenControls) {
    tokenControls.tools.push({
      name: 'wfrp3eHUD',
      title: 'Open WFRP3e HUD',
      icon: 'fas fa-id-card',
      visible: game.user.isGM || !!game.user.character,
      onClick: () => {
        if (window.wfrp3eHUD) {
          window.wfrp3eHUD.render(true);
        } else {
          window.wfrp3eHUD = new WFRP3eHUD();
          window.wfrp3eHUD.render(true);
        }
      },
      button: true
    });
  }
});
