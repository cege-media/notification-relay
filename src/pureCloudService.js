const _ = require('lodash');
const platformClient = require('purecloud-platform-client-v2');
const Q = require('q');

const config = require('./configService');
const Logger = require('./loggerService');

const logLevel = config.data.get('settings.logLevel');
const log = new Logger('purecloud', logLevel);



var client = platformClient.ApiClient.instance;
if (config.data.settings.enableSdkDebugging === true) {
	var sdkDebugLog = new Logger('purecloud-sdk', logLevel);
	client.setDebugLog(sdkDebugLog.debug.bind(sdkDebugLog), 25);
}
var authorizationApi = new platformClient.AuthorizationApi();
var notificationsApi = new platformClient.NotificationsApi();
var usersApi = new platformClient.UsersApi();



function PureCloud() {
	client.loginClientCredentialsGrant(config.data.pureCloud.clientId, config.data.pureCloud.clientSecret)
		.then(function() {
			// Do authenticated things 
		})
		.catch(function(response) {
			if (response.status) {
				log.error(`${response.status} - ${response.error.message}`);
				log.error(response.error);
			} else {
				log.error(response);
			}
		});
}

PureCloud.prototype.login = function() {
	var deferred = Q.defer();
	var _this = this;

	client.loginClientCredentialsGrant(config.data.pureCloud.clientId, config.data.pureCloud.clientSecret)
		.then(function() {
			return authorizationApi.getAuthorizationPermissions();
		})
		.then(function(data) {
    	log.silly(`getAuthorizationPermissions success! permissions count: ${data.total}`);
			deferred.resolve();
		})
		.catch(function(response) {
			if (response.status) {
				log.error(`${response.status} - ${response.error.message}`);
				log.error(response.error);
			} else {
				log.error(response);
			}
			deferred.reject(response);
		});

	return deferred.promise;
};

PureCloud.prototype.createChannel = function() {
	var deferred = Q.defer();
	var _this = this;

	notificationsApi.postNotificationsChannels()
		.then(function(data) {
    	log.debug(`Created channel ID: ${data.id}`);
			deferred.resolve(data);
		})
		.catch(function(response) {
			if (response.status) {
				log.error(`${response.status} - ${response.error.message}`);
				log.error(response.error);
			} else {
				log.error(response);
			}
			deferred.reject(response);
		});

	return deferred.promise;
};

PureCloud.prototype.getOrCreateChannel = function() {
	var deferred = Q.defer();
	var _this = this;

	/*
	 * Potential bug
	 * This process isn't threadsafe if it's called again before the first response returns. Need to put in
	 * some kind of locking/blocking mechanism to prevent multiple concurrent requests. Return a shared promise?
	 */

	if (this.notificationChannel) {
		// Return existing channel
		deferred.resolve(this.notificationChannel);
	} else {
		// Create new channel
		this.createChannel()
			.then(function(channel) {
				deferred.resolve(channel);
			})
			.catch(function(err) {
				deferred.reject(err);
			});
	}

	return deferred.promise;
};

PureCloud.prototype.subscribeTopics = function(topics, channelId, replace) {
	var deferred = Q.defer();
	var _this = this;

	// Format request body
	var body = [];
	_.forEach(topics, function(topic) {
		body.push({ 'id': topic });
	});
	body = JSON.stringify(body);

	// Make request
	var request;
	if (replace === true) {
		request = notificationsApi.putNotificationsChannelSubscriptions(channelId, body);
	} else {
		request = notificationsApi.postNotificationsChannelSubscriptions(channelId, body);
	}
	// Handle response
	request
		.then(function(data) {
			deferred.resolve(data);
		})
		.catch(function(response) {
			if (response.status) {
				log.error(`${response.status} - ${response.error.message}`);
				log.error(response.error);
			} else {
				log.error(response);
			}
			deferred.reject(response);
		});

	return deferred.promise;
};



/*
 * Helpers
 */

PureCloud.prototype.getUsers = function() {
	// Returns a promise
	return getUsersImpl();
};

function getUsersImpl(users = {}, deferred = Q.defer(), pageNumber = 1) {
	var _this = this;

	usersApi.getUsers({ 'pageSize': 100, 'pageNumber': pageNumber })
	  .then(function(data) {
	  	// Add users to cache
	  	_.forEach(data.entities, function(user) {
	  		users[user.id] = user;
	  	});

	  	// Done processing?
	  	if (pageNumber >= data.pageCount) {
	  		log.debug(`getUsers: Got ${_.keys(users).length} users`);
	  		deferred.resolve(users);
	  		return;
	  	}

	  	// Recurse function
	  	_this.getUsers(pageNumber + 1);
	  })
		.catch(function(response) {
			if (response.status) {
				log.error(`${response.status} - ${response.error.message}`);
				log.error(response.error);
			} else {
				log.error(response);
			}
			deferred.reject(response);
		});

	return deferred.promise;
}




module.exports = new PureCloud();