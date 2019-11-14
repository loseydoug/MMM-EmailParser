var SimpleParser =  require('mailparser').simpleParser;
var Imap = require('imap');
var google = require('googleapis').google;
var fs = require('fs');
var readline = require('readline');
/* Fetcher
 * Responsible for requesting an update on the set interval and broadcasting the data.
 *
 * attribute reloadInterval number - Reload ineterval in milliseconds.
 */

var Fetcher = function(reloadInterval, encoding, account) {
	// If modifying these scopes, delete token.json.
	var SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
	// The file token.json stores the user's access and refresh tokens, and is
	// created automatically when the authorization flow completes for the first
	// time.
	var TOKEN_PATH = 'token.json';

	// Load client secrets from a local file.
	fs.readFile('./modules/emailparser/credentials.json', (err, content) => {
	  if (err) return console.log('Error loading client secret file:', err);
	  // Authorize a client with credentials, then call the Gmail API.
	  authorize(JSON.parse(content), listLabels);
	});


	/**
	 * Create an OAuth2 client with the given credentials, and then execute the
	 * given callback function.
	 * @param {Object} credentials The authorization client credentials.
	 * @param {function} callback The callback to call with the authorized client.
	 */
	function authorize(credentials, callback) {
	  var {client_secret, client_id, redirect_uris} = credentials.installed;
	  var oAuth2Client = new google.auth.OAuth2(
	      client_id, client_secret, redirect_uris[0]);

	  // Check if we have previously stored a token.
	  fs.readFile(TOKEN_PATH, (err, token) => {
	    if (err) return getNewToken(oAuth2Client, callback);
	    oAuth2Client.setCredentials(JSON.parse(token));
	    callback(oAuth2Client);
	  });
	}

	/**
	 * Get and store new token after prompting for user authorization, and then
	 * execute the given callback with the authorized OAuth2 client.
	 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
	 * @param {getEventsCallback} callback The callback for the authorized client.
	 */
	function getNewToken(oAuth2Client, callback) {
	  var authUrl = oAuth2Client.generateAuthUrl({
	    access_type: 'offline',
	    scope: SCOPES,
	  });
	  console.log('Authorize this app by visiting this url:', authUrl);
	  var rl = readline.createInterface({
	    input: process.stdin,
	    output: process.stdout,
	  });
	  rl.question('Enter the code from that page here: ', (code) => {
	    rl.close();
	    oAuth2Client.getToken(code, (err, token) => {
	      if (err) return console.error('Error retrieving access token', err);
	      oAuth2Client.setCredentials(token);
	      // Store the token to disk for later program executions
	      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
	        if (err) return console.error(err);
	        console.log('Token stored to', TOKEN_PATH);
	      });
	      callback(oAuth2Client);
	    });
	  });
	}

	/**
	 * Lists the labels in the user's account.
	 *
	 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
	 */
	function listLabels(auth) {
	  var gmail = google.gmail({version: 'v1', auth});
	  gmail.users.messages.list({
	    userId: 'me',
	  }, (err, res) => {
	    if (err) return console.log('The API returned an error: ' + err);
	    var labels = res.data.messages;
	    if (labels.length) {
	      console.log('Labels:');
	      labels.forEach((label) => {
		gmail.users.messages.get({
			userId: 'me',
			id: label.id,
		}, (err, res) => {
			if (err) return console.log('The API returned an error: ' + err);
	    		console.log(res.data.payload.snippet);
			var message = res.data;
	        	console.log(`- ${Object.keys(message.payload).join(',')}`);
		});
	      });
	    } else {
	      console.log('No labels found.');
	    }
	  });
	}

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
		console.log(account)
		clearTimeout(reloadTimer);
		reloadTimer = null;
		items = [];

		//Once the mail box is read to open
		imap.once('ready', () => {

			console.log("inbox ready")

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
