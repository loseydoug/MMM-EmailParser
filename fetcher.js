var SimpleParser =  require('mailparser').simpleParser;
var google = require('googleapis').google;
var fs = require('fs');
var readline = require('readline');
var moment = require('moment');

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
	let items = [];
	let creds;
	var fetchFailedCallback = function() {};
	var itemsReceivedCallback = function() {};
	// If modifying these scopes, delete token.json.
	const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
	// The file token.json stores the user's access and refresh tokens, and is
	// created automatically when the authorization flow completes for the first
	// time.
	const TOKEN_PATH = 'token.json';


	/**
	 * Create an OAuth2 client with the given credentials, and then execute the
	 * given callback function.
	 * @param {Object} credentials The authorization client credentials.
	 * @param {function} callback The callback to call with the authorized client.
	 */
	const authorize = async (credentials, callback) => {
		const {client_secret, client_id, redirect_uris} = credentials.installed;
		const oAuth2Client = new google.auth.OAuth2(
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
	const getNewToken = (oAuth2Client, callback) => {
		const authUrl = oAuth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
		});
		console.log('Authorize this app by visiting this url:', authUrl);
		const rl = readline.createInterface({
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
	 * @param {Integer} The max number of messages to return.
	 */
	const getMessages = (auth, max, query) => {
		const gmail = google.gmail({version: 'v1', auth});
	 	gmail.users.messages.list({
		    userId: 'me',
		maxResults: account.maxEmails,
		q: account.query
		}, (err, res) => {
		    if (err) return console.log('The API returned an error: ' + err);
			    const messages = res.data.messages;
			    if (messages.length) {
				const promises = messages.map(message => {
					return new Promise((resolve, reject) => gmail.users.messages.get({
					    userId: 'me',
						id: message.id
					}, (err, res) => {
			    			if (err) return console.log('The API returned an error: ' + err);						
						resolve({msg: res.data.snippet, date: moment(Number(res.data.internalDate))});
					}));
				});

				Promise.all(promises).then(values => {
					items = values;
					self.broadcastItems();
				});
		    } else {
		      console.log('No messages found.');
		    }
		});
		scheduleTimer();
	}

	/* scheduleTimer()
	 * Schedule the timer for the next update.
	 */

	var scheduleTimer = function() {
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function() {
			authorize(self.creds, getMessages);
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
		// Load client secrets from a local file.
		fs.readFile('./modules/emailparser/credentials.json', (err, content) => {
			if (err) return console.log('Error loading client secret file:', err);
			// Authorize a client with credentials, then call the Gmail API.
			self.creds = JSON.parse(content);			
			authorize(self.creds, getMessages);
		});
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
