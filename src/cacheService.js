const _ = require('lodash');



const config = require('./configService');
const log = new (require('./loggerService'))('cache', config.data.get('settings.logLevel'));



function Cache(name = 'default') {
	this.name = name;
	this.instances = {};
	this.data = {};
	log.debug(`Cache instance "${name}" initialized`);
}



Cache.prototype.addInstance = function(name) {
	this.instances[name] = new Cache(name);
	return this.instances[name];
};

Cache.prototype.getInstance = function(name) {
	return this.instances[name];
};

Cache.prototype.removeInstance = function(name) {
	this.instances[name] = undefined;
};


Cache.prototype.get = function(key) {
	return this.data[key];
};

Cache.prototype.set = function(key, value) {
	this.data[key] = value;
};

Cache.prototype.getData = function() {
	return this.data;
};



module.exports = new Cache();