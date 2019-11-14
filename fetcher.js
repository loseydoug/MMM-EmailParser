var SimpleParser =  require('mailparser').simpleParser;
var Imap = require('imap');

/* Fetcher
 * Responsible for requesting an update on the set interval and broadcasting the data.
 *
 * attribute reloadInterval number - Reload ineterval in milliseconds.
 */

var Fetcher = function(reloadInterval, encoding, account) {
	var self = this;
	if (reloadInterval < 1000) {
		reloadInterval = 1000;
	}

	var reloadTimer = null;
	var items = [];

	var fetchFailedCallback = function() {};
	var itemsReceivedCallback = function() {};

	// host gmail
	var imap = new Imap();
	/* private methods */

	/* fetchMail()
	 * Request the new items.
	 */
	console.log("fetcher init")
	var fetchMail = function() {
		console.log("Create new email fetcher for account: " + account.user);
		clearTimeout(reloadTimer);
		reloadTimer = null;
		items = [];

		//Once the mail box is read to open
		imap.once('ready', () => {
			imap.openBox('INBOX', false, (err, box) => {
				if (err) {
					console.log(err);
				}
				// Search unseen emails having “hello world” in their Subject headers
				// imap.search(['UNSEEN', ['HEADER', 'SUBJECT',“hello world”]], (err1, results) => {
				imap.search(['UNSEEN'], (err1, results) => {

					if (err1) {
						console.log(err1);
					}
					try {
						// var f = imap.fetch(results, { bodies: 'TEXT' });
						var f = imap.fetch(results, {
							bodies: '', // “[\'HEADER.FIELDS (FROM TO SUBJECT DATE)\', '']”,
							struct: true,
						});
						f.on('message', (msg, seqno) => {
							msg.on('body', (stream, info) => {
								SimpleParser(stream, (err2, mail) => {
									if (err2) {
										log('Read mail executor error …..', err2);
										// this.emit(EXECUTOR_EVENTS.STOPPED, { reason: END_REASON.ERROR, error: err2 });
									}

									var emailEnvolope = {};
									emailEnvolope.from = mail.from.text;
									emailEnvolope.date = mail.date;
									emailEnvolope.to = mail.to.text;
									emailEnvolope.subject = mail.subject;
									emailEnvolope.text = mail.text;
									emailEnvolope.attachments = [];
									console.log(mail.text);

									log('processing mail done….');
								});
							});
							msg.once('attributes', (attrs) => {
								// Mark the above mails as read
								var { uid } = attrs;
								imap.addFlags(uid, ['\\Seen'], (err2) => {
									if (err2) {
										log(err2);
									} else {
										log('Marked as read!');
									}
								});
							});
						});

						f.once('end', () => {
							imap.end();
						});
					} catch (errorWhileFetching) {
						log(errorWhileFetching.message);
						if (errorWhileFetching.message === 'Nothing to fetch') {
							log('no mails fetched, temp directory not created');
							log('Read mail executor finished …..');
							// this.emit(EXECUTOR_EVENTS.STOPPED, { reason: END_REASON.COMPLETE });
							imap.end();
						}
						imap.end();
						// this.emit(EXECUTOR_EVENTS.STOPPED, { reason: END_REASON.ERROR });
					}
				});
			}); // close open mailbox
		}); // close ready
		// if error occurs in connection making
		imap.once('error', (err) => {
			console.log(err);
			console.log('Read mail executor error …..');
			// this.emit(EXECUTOR_EVENTS.STOPPED, { reason: END_REASON.ERROR });
		});
		// Once it ends
		imap.once('end', () => {
			console.log('Read mail executor finished …..');
			// this.emit(EXECUTOR_EVENTS.STOPPED, { reason: END_REASON.COMPLETE });
		});
		// initiating connection
		imap.connect();
	};

	/* scheduleTimer()
	 * Schedule the timer for the next update.
	 */

	var scheduleTimer = function() {
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function() {
			fetchMail();
		}, reloadInterval);
	};

	/* public methods */

	/* setReloadInterval()
	 * Update the reload interval, but only if we need to increase the speed.
	 *
	 * attribute interval number - Interval for the update in milliseconds.
	 */
	this.setReloadInterval = function(interval) {
		if (interval > 1000 && interval < reloadInterval) {
			reloadInterval = interval;
		}
	};

	/* startFetch()
	 * Initiate fetchMail();
	 */
	this.startFetch = function() {
		fetchMail();
	};

	/* broadcastItems()
	 * Broadcast the existing items.
	 */
	this.broadcastItems = function() {
		if (items.length <= 0) {
			return;
		}
		itemsReceivedCallback(self);
	};

	this.onReceive = function(callback) {
		itemsReceivedCallback = callback;
	};

	this.onError = function(callback) {
		fetchFailedCallback = callback;
	};

	this.items = function() {
		return items;
	};
};

module.exports = Fetcher;
