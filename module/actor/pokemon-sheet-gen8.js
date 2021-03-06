/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class PTUGen8PokemonSheet extends ActorSheet {
	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ['ptu', 'sheet', 'actor', 'gen8'],
			template: 'systems/ptu/templates/actor/pokemon-sheet-gen8.hbs',
			width: 1200,
			height: 675,
			tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'stats' }]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	getData() {
		const data = super.getData();
		data.dtypes = ['String', 'Number', 'Boolean'];

		// Prepare items.
		if (this.actor.data.type == 'pokemon') {
			this._prepareCharacterItems(data);
		}

		data['compendiumItems'] = game.ptu.items;
		data['natures'] = game.ptu.natureData;

		return data;
	}

	/**
	 * Organize and classify Items for Character sheets.
	 *
	 * @param {Object} actorData The actor to prepare.
	 *
	 * @return {undefined}
	 */
	_prepareCharacterItems(sheetData) {
		sheetData['skills'] = this.actor.data.data.skills
		
		const actorData = sheetData.actor;

		// Initialize containers.
		const abilities = [];
		const capabilities = [];
		const moves = [];
		const edges = [];

		// Iterate through items, allocating to containers
		// let totalWeight = 0;
		for (let i of sheetData.items) {
			let item = i.data;
			i.img = i.img || DEFAULT_TOKEN;

			switch (i.type) {
				case 'ability':
					abilities.push(i);
					break;
				case 'move':
					moves.push(i);
					break;
				case 'capability':
					capabilities.push(i);
					break;
				case 'pokeedge':
					edges.push(i);
					break;
			}
		}

		// Assign and return
		actorData.abilities = abilities;
		actorData.moves = moves;
		actorData.capabilities = capabilities;
		actorData.edges = edges;
	}

	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		// Everything below here is only needed if the sheet is editable
		if (!this.options.editable) return;

		// Add Inventory Item
		html.find('.item-create').click(this._onItemCreate.bind(this));

		// Update Inventory Item
		html.find('.item-edit').click((ev) => {
			const li = $(ev.currentTarget).parents('.item');
			const item = this.actor.getOwnedItem(li.data('itemId'));
			item.sheet.render(true);
		});

		// Delete Inventory Item
		html.find('.item-delete').click((ev) => {
			const li = $(ev.currentTarget).parents('.item');
			this.actor.deleteOwnedItem(li.data('itemId'));
			li.slideUp(200, () => this.render(false));
		});

		// Rollable abilities.
		html.find('.rollable.skill').click(this._onRoll.bind(this));
		html.find('.rollable.gen8move').click(this._onMoveRoll.bind(this));

		// Drag events for macros.
		if (this.actor.owner) {
			let handler = (ev) => this._onDragItemStart(ev);
			html.find('li.item').each((i, li) => {
				if (li.classList.contains('inventory-header')) return;
				li.setAttribute('draggable', true);
				li.addEventListener('dragstart', handler, false);
			});
		}

		html.find('#heldItemInput').autocomplete({
			source: game.ptu.items.map((i) => i.data.name),
			autoFocus: true,
			minLength: 1
		});
	}

	/**
	 * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onItemCreate(event) {
		event.preventDefault();
		const header = event.currentTarget;
		// Get the type of item to create.
		const type = header.dataset.type;
		// Grab any data associated with this control.
		const data = duplicate(header.dataset);
		// Initialize a default name.
		const name = `New ${type.capitalize()}`;
		// Prepare the item object.
		const itemData = {
			name: name,
			type: type,
			data: data
		};
		// Remove the type from the dataset since it's in the itemData.type prop.
		delete itemData.data['type'];

		// Finally, create the item!
		console.log(itemData);
		return this.actor.createOwnedItem(itemData);
	}

	/**
	 * Handle clickable rolls.
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onRoll(event) {
		event.preventDefault();
		const element = event.currentTarget;
		const dataset = element.dataset;

		if (dataset.roll) {
			let roll = new Roll(dataset.roll, this.actor.data.data);
			let label = dataset.label ? `Rolling ${dataset.label}` : '';
			roll.roll().toMessage({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: label
			});
		}
	}

	/**
	 * Handle clickable move rolls.
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onMoveRoll(event) {
		event.preventDefault();

		const element = event.currentTarget;
		const dataset = element.dataset;

		if (dataset.roll || dataset.type == 'Status') {
			let roll = new Roll('1d20+' + (parseInt(dataset.ac) || 0), this.actor.data.data);
			let label = dataset.label ? `To-Hit for move: ${dataset.label} ` : '';
			roll.roll().toMessage({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: label
			});
			let diceResult = -2;
			try{
			    diceResult = roll.terms[0].results[0].result;
            }
            catch(err){
            	console.log("Old system detected, using deprecated rolling...")
            	diceResult = roll.parts[0].results[0];
			}
			if (diceResult === 1) {
				CONFIG.ChatMessage.entityClass.create({
					content: `${dataset.label} critically missed!`,
					type: CONST.CHAT_MESSAGE_TYPES.OOC,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					user: game.user._id
				});
				return;
			}
			let isCrit = diceResult >= 20 - dataset.critrange;
			if(dataset.roll == -1) return;

			if (dataset.type == 'Physical' || dataset.type == 'Special') {
				let rollData = dataset.roll.split('#');
				let roll = new Roll(isCrit ? '@roll+@roll+@mod' : '@roll+@mod', {
					roll: rollData[0],
					mod: rollData[1] || 0
				});
				let label = dataset.label ? `${isCrit ? "Crit damage" : "Damage"} for move: ${dataset.label}` : '';
				roll.roll().toMessage({
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          			flavor: label
				});
			}
		}
	}
}
