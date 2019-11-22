/* Magic Mirror
 * Node Helper: emailParser
 *
 * Adapted from NewsFeed by Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const Fetcher = require("./fetcher.js");
const moment = require('moment');

module.exports = NodeHelper.create({
	// Subclass start method.
	start: function() {
		console.log("Starting helper module: " + this.name);
		this.fetchers = [];
		this.buttonClicks = 0;
	},

	// Subclass socketNotificationReceived received.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "ADD_FEED") {
			this.createFetcher(payload.account, payload.config);
			return;
		}

		if (notification === "EMAIL_READ") {
			if (this.buttonClicks === 0) {
				this.buttonClicks++;
				const startTime = moment();
			} else if (this.buttonClicks > 3) {
				this.buttonClicks++;
			} else {
				const endTime = moment();
				console.log(moment.duration(endTime.diff(startTime).as('seconds'));
				moment.duration(endTime.diff(startTime).as('seconds') < 3 ? exec('sudo shutdown -h now, null') : this.buttonClicks = 0;
			}
		}
	},

	/* createFetcher(fseed, config)
	 * Creates a fetcher for a new feed if it doesn't exist yet.
	 * Otherwise it reuses the existing one.
	 *
	 * attribute feed object - A feed object.
	 * attribute config object - A configuration object containing reload interval in milliseconds.
	 */
	createFetcher: function(account, config) {
		const self = this;
		let fetcher;
		const encoding = "UTF-8";
		const reloadInterval = account.reloadInterval || config.reloadInterval || 5 * 60 * 1000;
		if (typeof self.fetchers[account.user] === "undefined") {
			console.log("Create new news fetcher for account: " + account.user + " - Interval: " + reloadInterval);

			fetcher = new Fetcher(reloadInterval, encoding, account);

			fetcher.onReceive(function(fetcher) {
				self.broadcastFeeds();
			});

			fetcher.onError(function(fetcher, error) {
				self.sendSocketNotification("FETCH_ERROR", {
					error: error
				});
			});

			self.fetchers.push(fetcher);

		} else {
			console.log("Use existing email fetcher for account: " + account.user);
			fetcher = self.fetchers[url];
			fetcher.setReloadInterval(reloadInterval);
			fetcher.broadcastItems();
		}

		fetcher.startFetch();
	},

	/* broadcastFeeds()
	 * Creates an object with all feed items of the different registered feeds,
	 * and broadcasts these using sendSocketNotification.
	 */
	broadcastFeeds: function() {
		const feeds = this.fetchers[0].items();
		this.sendSocketNotification("NEW_MAIL", feeds);
	}
});