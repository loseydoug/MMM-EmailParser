/* Magic Mirror
 * Node Helper: emailParser
 *
 * Adapted from NewsFeed by Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var Fetcher = require("./fetcher.js");

module.exports = NodeHelper.create({
	// Subclass start method.
	start: function() {
		console.log("Starting module: " + this.name);
		this.fetchers = [];
	},

	// Subclass socketNotificationReceived received.
	socketNotificationReceived: function(notification, payload) {
		console.log(payload)
		if (notification === "ADD_FEED") {
			this.createFetcher(payload.account, payload.config);
			return;
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
		var self = this;

		var encoding = "UTF-8";
		var reloadInterval = feed.reloadInterval || config.reloadInterval || 5 * 60 * 1000;

		var fetcher;
		fetcher = new Fetcher(reloadInterval, encoding, account);

		fetcher.onReceive(function(fetcher) {
			self.broadcastFeeds(email);
		});

		fetcher.onError(function(fetcher, error) {
			self.sendSocketNotification("FETCH_ERROR", {
				url: fetcher.url(),
				error: error
			});
		});

		self.fetchers[account.user] = fetcher;


		fetcher.startFetch();
	},

	/* broadcastFeeds()
	 * Creates an object with all feed items of the different registered feeds,
	 * and broadcasts these using sendSocketNotification.
	 */
	broadcastFeeds: function(email) {
		this.sendSocketNotification("NEW_MAIL", email);
	}
});