// Force working directory to be where this script resides
// The purpose of this is for relative paths loaded in configs to be relative to the script, not where it was invoked from
process.chdir(__dirname);

const _ = require('lodash');
const moment = require('moment');

const config = require('./configService');
const log = new (require('./loggerService'))('main', config.data.get('settings.logLevel'));
const Integration = require('./integrationService');
const pureCloud = require('./pureCloudService');
const cache = require('./cacheService');



var integrations = [];


log.writeBox(`Notification Relay\n${(new moment()).format('h:mm:ss a')}`);

log.debug('Debug message');


pureCloud.login()
	.then(function() {
		log.info('Populating default cache...');
		// TODO: Populate cache with entities defined in config (users, queues, etc)
		return pureCloud.getUsers();
	})
	.then(function(users) {
		cache.set('users', users);
		log.info(`Loaded ${_.keys(cache.get('users')).length} users into default cache`);
	})
	.then(function() {
		return pureCloud.getQueues();
	})
	.then(function(queues) {
		cache.set('queues', queues);
		log.info(`Loaded ${_.keys(cache.get('queues')).length} queues into default cache`);
	})
	.then(function() {
		return pureCloud.getPresences();
	})
	.then(function(presences) {
		cache.set('presences', presences);
		log.info(`Loaded ${_.keys(cache.get('presences')).length} presences into default cache`);
	})
	.then(function() {
		// Load integrations
		_.forEach(config.data.integrations, function(integration) {
			integrations.push(new Integration(integration));
		});
	})
	.catch(function(err) {
		console.log(err);
	});