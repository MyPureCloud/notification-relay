/*
 * This module exports a set of functions and properties. The module can be written in any format 
 * as long as the the functions and properties are accessible when they are passed into the function 
 * to execute a template.
 */

// Require a library
const moment = require('moment');

// Constructor
function Defs() {

}

// Functions

// Returns the current date and time in the given format
Defs.prototype.now = function(format) {
	return (new moment()).format(format ? format : 'h:mm:ss a');
};

// Export module instance
module.exports = new Defs();