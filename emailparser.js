/* global Module */

/* Magic Mirror
 * Module: emailParser
 * 
 * Adapted from NewsFeed by Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("emailparser",{
	// Default module config.
	defaults: {
		showTimestamp: true,
		lengthDescription: 400,
		hideLoading: false,
		reloadInterval: 5 * 60 * 1000, // every 5 minutes
		updateInterval: 10 * 1000,
		animationSpeed: 2.5 * 1000,
		scrollLength: 500
	},

	// Define required scripts.
	getScripts: function() {
		return ["moment.js"];
	},

	// Define required translations.
	getTranslations: function() {
		// The translations for the default modules are defined in the core translation files.
		// Therefor we can just return false. Otherwise we should have returned a dictionary.
		// If you're trying to build your own module including translations, check out the documentation.
		return false;
	},

	// Define start sequence.
	start: function() {
		console.log("Starting main module: " + this.name);

		// Set locale.
		moment.locale(config.language);

		this.emails = [];
		this.loaded = false;
		this.activeItem = 0;
		this.scrollPosition = 0;

		this.registerFeeds();

		this.isShowingDescription = this.config.showDescription;
	},

	// Override socket notification handler.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "NEW_MAIL") {
			this.generateFeed(payload);

			if (!this.loaded) {
				this.scheduleUpdateInterval();
			}

			this.loaded = true;
		}
	},

	// Override dom generator.
	getDom: function() {
		const wrapper = document.createElement("div");

		if (this.activeItem >= this.emails.length) {
			this.activeItem = 0;
		}

		if (this.emails.length > 0) {

			// this.config.showTimestamp is a run-time configuration, triggered by optional notifications
			if (this.config.showTimestamp) {
				const timestamp = document.createElement("div");
				timestamp.className = "newsfeed-source light small dimmed";
				timestamp.innerHTML += moment(new Date(this.emails[this.activeItem].date)).fromNow();

				wrapper.appendChild(timestamp);
			}

			if (this.config.hideLoading) {
				this.show();
			}

		} else {
			if (this.config.hideLoading) {
				this.hide();
			} else {
				wrapper.innerHTML = this.translate("LOADING");
				wrapper.className = "small dimmed";
			}
		}
		var msg = document.createElement("div");
		msg.className = "newsfeed-title bright medium light" + (!this.config.wrapTitle ? " no-wrap" : "");
		msg.innerHTML = this.emails[this.activeItem].msg;
		wrapper.appendChild(msg);

		return wrapper;
	},


	/* registerFeeds()
	 * registers the feeds to be used by the backend.
	 */
	registerFeeds: function() {
		this.config.accounts.forEach(account => {
			this.sendSocketNotification("ADD_FEED", {
				account: account,
				config: this.config
			});
		});
	},

	/* generateFeed()
	 * Generate an ordered list of items for this configured module.
	 *
	 * attribute feeds object - An object with feeds returned by the node helper.
	 */
	generateFeed: function(msgs) {
		const emails = [];
		msgs.forEach(item => {
			item.sourceTitle = this.titleForFeed(item);
			if (!(this.config.ignoreOldItems && ((Date.now() - new Date(item.date)) > this.config.ignoreOlderThan))) {
				emails.push(item);
			}
		})

		emails.sort(function(a,b) {
			const dateA = new Date(a.date);
			const dateB = new Date(b.date);
			return dateB - dateA;
		});

		if(this.config.maxEmails > 0) {
			emails = emails.length = this.config.maxEmails
		}

		// get updated email items and broadcast them
		const updatedItems = [];
		emails.forEach(value => {
			if (this.emails.findIndex(value1 => value1 === value) === -1) {
				// Add item to updated items list
				updatedItems.push(value);
			}
		});

		// check if updated items exist, if so and if we should broadcast these updates, then lets do so
		if (this.config.broadcastNewsUpdates && updatedItems.length > 0) {
			this.sendNotification("EMAIL_UPDATE", {items: updatedItems});
		}

		this.emails = emails;
	},

	/* titleForFeed()
	 *
	 * attribute feedUrl string - Url of the feed to check.
	 *
	 * returns string
	 */
	titleForFeed: function(account) {
		return account.title || "";
	},

	/* scheduleUpdateInterval()
	 * Schedule visual update.
	 */
	scheduleUpdateInterval: function() {
		const self = this;

		self.updateDom(self.config.animationSpeed);

		// Broadcast NewsFeed if needed
		if (self.config.broadcastNewsFeeds) {
			self.sendNotification("NEW_MAIL", {items: self.emails});
		}

		let timer = setInterval(function() {
			self.activeItem++;
			self.updateDom(self.config.animationSpeed);

			// Broadcast NewsFeed if needed
			if (self.config.broadcastNewsFeeds) {
				self.sendNotification("NEW_MAIL", {items: self.emails});
			}
		}, this.config.updateInterval);
	},

	/* capitalizeFirstLetter(string)
	 * Capitalizes the first character of a string.
	 *
	 * argument string string - Input string.
	 *
	 * return string - Capitalized output string.
	 */
	capitalizeFirstLetter: function(string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	}

});