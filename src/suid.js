/**! 
 * Distributed Service-Unique IDs that are short and sweet.
 * 
 * http://download.github.io/suid
 * 
 * @Author Stijn de Witt (http://StijnDeWitt.com)
 * @Copyright (c) 2015. Some rights reserved. 
 * @License CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) 
 */
/** @namespace ws.suid */
(function(u,m,d) {var p='picolog',l; if(this.log&&this.log.INFO){l=this.log;}
	if(typeof define=='function'&&define.amd){define(u,['require'],function(r){return d(r.defined(p)?r(p):l);});}
	else if(typeof exports=='object'){try{require.resolve(p);l=require(p);}catch(e){}module.exports=d(l);}
	else{this[m] = d(l);}
}('suid','Suid',function(log){'use strict';
var
SHARDSIZE = 2,
IDSIZE = 64,
THROTTLE = 5000,
POOL = 'suidpool', 
DETECT = 'suiddetect',
ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz',
localStorageSupported = (function(ls){try{ls.setItem(DETECT, DETECT);ls.removeItem(DETECT);return true;}catch(e){return false;}})(localStorage),
currentBlock,
currentId,
readyListeners = [],
win = typeof window != 'undefined' ? window : typeof global != 'undefined' ? global : {},
config = getConfig(win.Suid, {server:'/suid/suid.json', min:3, max:4});

/**
 * Distributed Service-Unique IDs that are short and sweet.
 *  
 * <p>When called without arguments, defaults to <tt>Suid(0)</tt>.</p> 
 * 
 * <p>When called with an argument, constructs a new Suid based
 * on the given value, which may be either a:</p>
 * 
 * <ul>
 *   <li>Number</li>
 *   <li>Base-36 String</li>
 *   <li>Other Suid</li>
 * </ul>
 *
 * <p>This constructor function may be called without the <tt>new</tt> keyword.</p>
 * 
 * <p><b>Examples</b></p>
 * 
 * <big><pre>
 * // Call without arguments
 * var NOP = new Suid();
 *  
 * // call with a Number argument
 * var ZERO = new Suid(0);
 * var ONE = new Suid(1);
 * NOP.equals(ZERO); // true
 *
 * // New-less invocation
 * var TWO = Suid(2);
 * 
 * // call with a base-36 string argument
 * var suid1 = Suid('14she');
 * 
 * // call with another suid as argument
 * var suid2 = Suid(suid1);
 * </pre></big>
 * 
 * @param value The value for the new Suid.
 * 
 * @class Suid
 * @memberof! ws.suid
 */
var Suid = (function() {
	function Suid(value) {
		if (! (this instanceof Suid)) {return new Suid(value);}
		if (value === undefined) {value = 0;}
		if (typeof value === 'string') {value = parseInt(value, 36);}
		this.value = value instanceof Suid ? value.value : value;
		Number.call(this, this.value);
	}

	Suid.prototype = Object.create(Number.prototype);
	Suid.prototype.constructor = Suid;

	/** 
	 * Converts this suid to a string.
	 * 
	 * The returned String will be in base-36 format. 
	 * For example: <tt>'14she'</tt>.
	 * 
	 * @return The base-36 string.
	 * 
	 * @memberof! ws.suid.Suid#
	 */
	Suid.prototype.toString = function Suid_toString() {
		return this.value.toString(36); 
	};

	/** 
	 * Converts this suid to a JSON string.
	 * 
	 * The returned String will be in base-36 format. 
	 * For example: <tt>'14she'</tt>. This method
	 * is called by <tt>JSON.stringify</tt>.
	 * 
	 * @return The JSON string.
	 * 
	 * @memberof! ws.suid.Suid#
	 * 
	 * @see {@link ws.suid.Suid.revive}
	 */
	Suid.prototype.toJSON = function Suid_toJSON() {
		return this.toString();
	};

	/**
	 * Returns the underlying value of this suid.
	 * 
	 * @return The underlying primitive Number value.
	 * 
	 * @memberof! ws.suid.Suid#
	 */
	Suid.prototype.valueOf = function Suid_valueOf() {
		return this.value;
	};
	
	/**
	 * Compares this suid with <tt>that</tt>.
	 * 
	 * @return <tt>-1</tt> when this suid is less than, 
	 *         <tt>0</tt> when it is equal to and 
	 *         <tt>+1</tt> when it is greater than <tt>that</tt>.
	 * 
	 * @memberof! ws.suid.Suid#
	 */
	Suid.prototype.compare = function Suid_compare(that) {
		that = Suid(that);
		return this.value < that.value ? -1 : this.value > that.value ? 1 : 0;
	};
	
	/**
	 * Indicates whether this suid and <tt>that</tt> are equal.
	 * 
	 * @return <tt>true</tt> when the values are equal, <tt>false</tt> otherwise.
	 * 
	 * @memberof! ws.suid.Suid#
	 */
	Suid.prototype.equals = function Suid_equals(that) {
		return this.value === Suid(that).value;
	};

	/**
	 * Indicates whether the given string value looks like a valid suid.
	 * 
	 * If this method returns true, this only indicates that it's 
	 * *probably* valid. There are no guarantees.
	 * 
	 * @param str The string to test.
	 * @return <tt>true</tt> if it looks valid, <tt>false</tt> otherwise.
	 * 
	 * @memberof! ws.suid.Suid
	 */
	Suid.looksValid = function Suid_looksValid(value) {
		if (!value) {return false;}
		var len = value.length;
		if ((!len) || (len > 11)) {return false;}
		if ((len === 11) && (ALPHABET.indexOf(value.charAt(0)) > 2)) {return false;}
		for (var i=0; i<len; i++) {
			if (ALPHABET.indexOf(value.charAt(i)) === -1) {return false;}
		}
		return true;
	};

	/**
	 * Creates a reviver function to be used i.c.w. JSON.parse.
	 * 
	 * Example:
	 * 
	 * <big><pre>
	 * var object = {
	 *   id: Suid(),
	 *   name: 'Example'
	 * };
	 * var obj, json = JSON.stringify(object); 
	 * // json === '{"id":"19b","name":"Example"}'
	 * obj = JSON.parse(json, Suid.revive('id'));   // OR
	 * obj = JSON.parse(json, Suid.revive(['id'])); // OR
	 * obj = JSON.parse(json, Suid.revive(function(key,val){return key === 'id';}));
	 * // obj.id instanceof Suid === true
	 * </pre></big>
	 * 
	 * @param prop The (array of) name(s) of properties to be revived, or an evaluator function.
	 * @returns A reviver function
	 * 
	 * @memberof! ws.suid.Suid
	 */
	Suid.revive = function Suid_revive(prop) {
		var mayRevive = typeof prop === undefined ? function(){return true;} : function(key){return prop.indexOf(key) !== -1;};
		if (typeof prop == 'string') {prop = [prop];}
		if (typeof prop == 'function') {mayRevive = prop;}
		return function reviver(key, value) {
			return mayRevive(key, value) && Suid.looksValid(value) ? new Suid(value) : value;
		};
	};

	/**
	 * Generates the next suid.
	 * 
	 * @return The next new suid.
	 * 
	 * @memberof! ws.suid.Suid
	 */
	Suid.next = function Suid_next() {
		var pool = Pool.get();
		if ((pool.length < config.min) || ((!currentBlock && pool.length === config.min))) {
			if (config.server) {Server.fetch();}
			else {log && log.warn('No suid server configured. Please add the data-suid-server attribute to the script tag or call Suid.config before generating IDs.');}
		}
		if (! currentBlock) {
			if (pool.length === 0) {
				throw new Error('Unable to generate IDs. Suid block pool exhausted.');
			}
			currentId = 0;
			currentBlock = pool.splice(0, 1)[0];
			Pool.set(pool);
		}

		var result = currentBlock + currentId * SHARDSIZE;
		currentId++;
		if (currentId >= IDSIZE) {
			currentBlock = null;
		}
		return new Suid(result);
	};

	/**
	 * Configures the suid generator or gets the current config.
	 * 
	 * <p>This method can be used as an alternative for, or in addition to, specifying
	 * the configuration in the <tt>data-suid-server</tt> and <tt>data-suid-options</tt>
	 * script attributes.</p>
	 * 
	 * <p><b>Examples:</b></p>
	 * 
	 * <code><pre>
	 * // Assuming no config was set yet... (defaults)
	 * var config = Suid.config();       // config => {server:'/suid/suid.json', min:3, max:4}  
	 * 
	 * Suid.config({
	 *     server: '/suid.json',
	 *     min: 2,
	 *     max: 6,
	 *     seed: ['14she', '14sky']
	 * });
	 * 
	 * // The seed is used to fill the pool and then discarded: 
	 * var config = Suid.config();       // config => {server:'/suid.json', min:2, max:6}
	 * 
	 * // Config does a merge:  
	 * config = Suid.config({max: 8});   // config => {server:'/suid.json', min:2, max:8}
	 * </pre></code> 
	 * 
	 * @return The current config after the given <tt>cfg</tt> object has been processed, if any.
	 * 
	 * @memberof! ws.suid.Suid
	 */
	Suid.config = function Suid_config(cfg) {
		if (cfg) {
			config = merge(config, cfg);
			if (cfg.seed) {
				var pool = Pool.get();
				pool.push(cfg.seed);
				Pool.set(pool);
				delete config.seed;
			}
			Suid.ready();
		}
		return config;
	};

	/**
	 * Indicates if Suid is ready to generate IDs, attaches the given callback listener.
	 * 
	 * <p>This method can be used to find out whether Suid is ready to generate ID's, or
	 * to attach an event listener to the ready event. The given <tt>callback</tt> function
	 * is guaranteed to fire asynchronously, meaning this method will always return before
	 * the callback is fired. Due to this, this method may already return <tt>true</tt> even
	 * though the ready event hasn't fired yet.</p>
	 * 
	 * <p><b>Examples:</b></p>
	 * 
	 * <code><pre>
	 * if (Suid.ready()) {
	 *   // Suid is ready!
	 * } else {
	 *   // Suid is not ready yet...
	 * }
	 * 
	 * Suid.ready(function(){
	 *   // Suid is ready!
	 * });
	 * </pre></code>
	 * 
	 * @param callback The optional callback function that will be called once Suid is ready.
	 * @return <tt>true</tt> if Suid is ready, <tt>false</tt> otherwise.
	 */
	Suid.ready = function Suid_ready(callback) {
		var ready = Pool.get().length > 0;
		if (callback) {readyListeners.push(callback);}
		if (ready) {setTimeout(function(){for (var l; l=readyListeners.shift();) {l();}}, 0);}
		// give client 100ms to configure the server using Suid.configure
		else {setTimeout(function(){Server.fetch();}, 100);}
		return ready;
	};

	return Suid;
})();

var Pool = (function(){
	var pool = [];
	return {
		get: function() {
			if (localStorageSupported) {
				pool = Pool.from(localStorage.getItem(POOL));
			}
			return pool;
		},
		set: function(values){
			pool = values;
			if (localStorageSupported) {
				localStorage.setItem(POOL, Pool.to(pool));
			}
			return Pool;
		},
		from: function(str){
			var results = [];
			if (str) {
				var strings = str.split(',');
				for (var i=0, s; s=strings[i]; i++) {
					results.push(new Suid(s));
				}
			}
			return results;
		},
		to: function(obj){
			return obj.join(',');
		}
	};
})();

var Server = (function(){
	var retries = 0,
		started = 0;

	function handleSuccess(text) {
		retries = 0;
		var pool = Pool.get();
		pool.push(JSON.parse(text));
		Pool.set(pool);
		Suid.ready();
	}

	function handleError(status, request) {
		// status code 5xx ? possibly recoverable.
		switch(status) {
			case 500: // Internal server error
			case 502: // Bad Gateway
			case 503: // Service unavailable
			case 504: // Gateway Timeout
				retry(request);
				break;
			default: // unrecoverable? give up 
				log && log.error('Unable to fetch suid data from server. ', request, status);
				retries = 0;
		}
	}

	function retry(request) {
		if (retries === 0) {
			log && log.error('Giving up fetching suid data from server: ' + config.server);
			return;
		}

		retries--;
		var after = 300000; // 5 minutes
		var retryAfter = request.getResponseHeader('Retry-After');
		if (retryAfter) {
			after = parseInt(retryAfter, 10);
			if (! isNaN(after)) {
				after = after * 1000; // seconds to ms.
			}
		}
		// Is this urgent?
		if (! Pool.get().length) { // Pool is out of blocks
			if (after > 60000) {
				after = 60000; // 1 min
			}
		}
		if (currentId > (IDSIZE/2)) { // less than half of current block left
			if (after > 30000) {
				after = 30000; // 30 sec
			}
		}
		if (! currentBlock) { // completely out
			if (after > 2000) {
				after = 2000; // 2 sec
			}
		}
		
		setTimeout(function(){
			ajax(config.server, {blocks: config.max - Pool.get().length}, handleSuccess, handleError);
		}, after);
	}

	function ajax(url, data, success, error, sync) {
		var xhr = new XMLHttpRequest(), query = [], params, key; 
		for (key in data) {
			if (data.hasOwnProperty(key)) {
				query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
			}
		}
		params = query.join('&');
		xhr.open('get', url + (params ? (url.indexOf('?') !== -1 ? '&' : '?') + params : ''), !sync); 
		xhr.addEventListener('readystatechange', function(){ 
			if (this.readyState === 4) { 
				this.status === 200 ? success(this.responseText, this) : error(this.status, this);
			}
		}); 
		xhr.addEventListener('error', function () { 
			error(this, this.status); 
		}); 
		xhr.send(); 
	}

	return {
		fetch: function Server_fetch() {
			if (retries && ((new Date().getTime() - started < THROTTLE) || 
							(currentId && (currentId < (IDSIZE/2))))) {
				return; // already fetching and still recent or not urgent
			} 
			var pool = Pool.get();
			if (pool.length < config.min) {
				retries = 3;
				started = Date.now();
				ajax(config.server, {blocks: config.max - pool.length}, handleSuccess, handleError);
			}
		}
	};
})();

function merge() {
	var res={}, i, arg, key;
	for (i=0; arg=arguments[i++];) {
		for (key in arg) {res[key] = arg[key];}
	}
	return res;
}

function getConfig(cfg, def) {
	var options = {},
		config = merge(def, cfg),
		script = document.querySelector('script[data-suid-server]');
	if (!script) {script = document.querySelector('script[data-suid-options]');}
	if (script) {
		var attr = script.getAttribute('data-suid-options');
		if (attr) {
			try {
				options = JSON.parse(attr.split('\'').join('"'));
			}
			catch(error) {
				log && log.error('Unable to parse suid options as JSON: \'' + attr + '\'. Error was: ', error);
			}
		}
		options.url = script.getAttribute('data-suid-server');
		config = merge(config, options);
	}
	config.configured = cfg || script;
	return config;
}

if (config.configured) {Suid.configure(config);}
else {Suid.ready();}

log && log.info('Suid.js started.');

// EXPOSE
return Suid;

}));
