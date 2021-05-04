/*
 * This example subscribes to topics based on the subscriptions config in the config file and
 * logs information to the console window.
 */

// Import node modules
const _ = require("lodash");

const axios = require("axios");

// Import the def module used in the templates
const defs = require("./defs");

// I did not stick this into the config.json as regex has to be stringified and then parsed every time it has to be read
// At which point I am considering removing all subscriptions from the config.json but am leaving for the moment
const topicPaths = [
  {
    regex: /v2\.analytics\.users\.([0-9a-f\-]{36})\.aggregates/,
    path: "v2.analytics.users.{id}.aggregates",
    callback: userCallback,
    endpoint: "https://notifications-dev.hivehq.co/v1/user/aggregate",
    type: "user_aggregates",
  },
  {
    regex: /v2\.users\.([0-9a-f\-]{36})\.activity/,
    path: "v2.users.{id}.activity",
    callback: userCallback,
    endpoint: "https://notifications-dev.hivehq.co/v1/user/activity",
    type: "user_activity",
  },
];

const CHANNEL_METADATA_TOPIC = "channel.metadata";

// Set instance variables
var _this;

function Integration(serviceProvder) {
  // Keep track of services
  _this = this;
  this.integration = serviceProvder.integrationService;
  this.log = serviceProvder.logger;
  this.templateService = serviceProvder.templateService;
  this.cache = serviceProvder.instanceCache;
  this.defaultCache = serviceProvder.defaultCache;

  // Set callbacks for events
  this.integration.setCallback(
    this.integration.eventStrings.INITIALIZED,
    onInitialized
  );
  this.integration.setCallback(
    this.integration.eventStrings.SOCKETOPEN,
    onSocketOpen
  );
  this.integration.setCallback(
    this.integration.eventStrings.NOTIFICATION,
    onNotification
  );
  this.integration.setCallback(this.integration.eventStrings.ERROR, onError);

  // Subscribe to notifications via config object
  this.log.debug("subscribing notifications");
  const subscriptionChannels = Object.keys(
    _this.defaultCache.get("users")
  ).reduce((result, user) => {
    const userId = user?.id;
    const topics = topicPaths.reduce((topicResults, topic) => {
      return [...topicResults, topic.path.replace(/{.*}/gi, userId)];
    }, []);
    return [...result, ...topics];
  }, []);
  this.integration.subscribeNotifications(subscriptionChannels);

  this.log.debug(
    `There are ${
      _.keys(_this.defaultCache.get("users")).length
    } users in the default cache`
  );
}

module.exports = Integration;

// Event callbacks

function onInitialized(topic, data) {
  _this.log.debug(`onInitialized: topic=${topic} data=`, data);
}

function onSocketOpen(topic, data) {
  _this.log.debug(`onSocketOpen: topic=${topic} data=`, data);
}

function onNotification(topic, data) {
  /*
   * For more information on template formatting, see the doT docs: http://olado.github.io/doT/
   *
   * This function receives a notification from PureCloud, matches the topic, updates data in the
   * cache where appropriate, formats a message, and sends the message to all connected clients.
   */

  try {
    // Heartbeat
    if (topic.toLowerCase() == CHANNEL_METADATA_TOPIC) {
      // The 'defs' module is available as 'def' and the 'data' object is available as 'it'
      _this.log.info(
        _this.templateService.executeTemplate(
          "Heartbeat ({{# def.now() }}): {{= it.eventBody.message }}",
          data,
          defs
        )
      );
      return;
    }

    // Get the function that we will call
    topicPaths.forEach((tp) => {
      if (topic.match(tp.regex)) {
        const success = tp.callback(tp.type, tp.endpoint, data);
        if (!success) {
          _this.log.warn(`Unmatched notification topic: ${topic}`);
        }
      }
    });
  } catch (err) {
    _this.log.error(`Error handling notification: ${err.message}`);
    _this.log.error(err);
  }
}

// This is a cover all for the user stuff that will point at different api endpoints
function userCallback(type, endpoint, data) {
  axios
    .post(
      endpoint,
      JSON.stringify({
        type,
        typeId: data.eventBody.id,
        message: data,
      })
    )
    .then((response) => {
      // do something here?
      _this.log.info({ responseData: response.data, TIMESTAMP: Date.now() });
    })
    .catch((err) => {
      // We errored out...
      console.log({
        FUNCTION: "Integration::conversationCallback",
        ERROR: err,
      });
    });
  return true;
}

function onError(topic, data) {
  _this.log.debug(`On error: topic=${topic} message=${data.message}`);
  _this.log.error(data);
}
