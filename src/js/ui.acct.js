// Copyright 2012 Google Inc. All Rights Reserved.

/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * @author nickski15@gmail.com (Nick Mihailovski)
 *
 * @fileoverview
 * Provides the gadash.ui.AcctSelect control to allow users to
 * select an account, web property, and finally a profile. The contorl can then
 * be used to retrieve the user selected table id. This can then be used with
 * the various reporting APIs.
 */


/**
 * Namespace for all ui controls.
 */
gadash.ui = gadash.ui || {};


/**
 * Namespace for this specific account control.
 */
gadash.ui.acct = gadash.ui.acct || {};


/**
 * Object to cache various requests.
 */
gadash.ui.acct.cache = {};



/**
 * Create a new AcctSelect object that allows users to visually select
 * account, web properties, and finally profiles. This dynamically
 * replaces the contents of divId with a set of controls.
 * @param {String} divId The ID of the containing div in which to render
 *     this control.
 * @constructor.
 */
gadash.ui.AcctSelect = function(divId) {
  this.divId = divId;
  this.selected = {};
  this.isFromLoad = false;

  this.initView(divId);

  if (gadash.isLoaded) {
    this.initLoad();
  } else {
    gadash.util.pubsub.subscribe(
        gadash.util.pubsub.libsLoaded,
        gadash.util.bindMethod(this, this.initLoad));
  }
};


/**
 * Adds handlers and loads accounts.
 */
gadash.ui.AcctSelect.prototype.initLoad = function() {

  var selected = gadash.util.load(this.divId);
  if (selected) {
    this.selected = selected;
    this.isFromLoad = true;
  }

  this.addChangeHandler('acct-select');
  this.addChangeHandler('property-select');
  this.addChangeHandler('profile-select');
  this.loadAccounts();
};


/**
 * Add hadnlers to each select element.
 * @param {String} selectId The ID of the element to add a handler.
 * @this points to the AcctSelect instance.
 */
gadash.ui.AcctSelect.prototype.addChangeHandler = function(selectId) {
  document.getElementById(this.getId_(selectId)).addEventListener('change',
      gadash.util.bindMethod(this, this.getChangeHandler(selectId)));
};


/**
 * Returns the selected table ID as a string.
 * @return {String} The selected profileId.
 */
gadash.ui.AcctSelect.prototype.getTableId = function() {
  return 'ga:' + this.selected.profileId;
};


/**
 * Returns the selected table ID as a CoreQuery config object.
 * This is useful for adding directly in the each CoreQuery set method.
 * @return {Object} The profileId set in a Core Query config object.
 */
gadash.ui.AcctSelect.prototype.getTableIdConfig = function() {
  return {
    query: {
      ids: this.getTableId()
    }
  };
};


/**
 * Returns a namespaced id for this control. The ID of the element for this
 * control is used as a namespace.
 * @param {String} id The ID to namespace.
 * @return {String} The namespaced ID.
 * @private.
 */
gadash.ui.AcctSelect.prototype.getId_ = function(id) {
  return this.divId + '-' + id;
};


/**
 * Adds the HTML controls to the UI.
 */
gadash.ui.AcctSelect.prototype.initView = function() {
  document.getElementById(this.divId).innerHTML = [
    '<div style="margin-top:5px">Select an account: ',
    '<select id="', this.getId_('acct-select'), '">',
    '<option>Loading...</option></select></div>',
    '<div style="margin-top:5px">Select a property: ',
    '<select id="', this.getId_('property-select'), '">',
    '<option>Loading...</option></select></div>',
    '<div style="margin-top:5px">Select a profile: ',
    '<select id="', this.getId_('profile-select'), '">',
    '<option>Loading...</option></select></div>'
  ].join('');
};


/**
 * Load accounts from the Management API.
 * This is the inital traversal of the account hiearchy.
 */
gadash.ui.AcctSelect.prototype.loadAccounts = function() {
  gapi.client.analytics.management.accounts.list().execute(
      gadash.util.bindMethod(this, this.handleAccounts));
};


/**
 * Handle accounts from the Management API.
 * @param {Object} results The results object returned from the API.
 */
gadash.ui.AcctSelect.prototype.handleAccounts = function(results) {
  if (!this.isError(results)) {

    if (!this.isFromLoad) {
      this.selected.accountId = results.items[0].id;
    }

    gadash.ui.acct.sortResults(results);

    document.getElementById(this.getId_('acct-select')).innerHTML =
        gadash.ui.acct.getOptionsFromResults(results, this.selected.accountId);

    this.loadProperties();
  }
};


/**
 * Returns whether an error occured.
 * @param {Object} results The results from the API.
 * @return {Boolean} True if an error occured.
 */
gadash.ui.AcctSelect.prototype.isError = function(results) {
  if (results.error) {

    var message = 'There was an API error in the account picker: ' +
        results.error.message;
    gadash.util.displayError(message);
    return true;

  } else if (!results.items || !results.items.length) {
    switch (results.kind) {
      case 'analytics#account':
        document.getElementById(this.getId_('acct-select')).innerHTML =
            gadash.ui.acct.getOption('none', 'No account found');

      case 'analytics#webproperty':
        document.getElementById(this.getId_('acct-select')).innerHTML =
            gadash.ui.acct.getOption('none', 'No properties found');

      case 'analytics#profile':
        document.getElementById(this.getId_('acct-select')).innerHTML =
            gadash.ui.acct.getOption('none', 'No profiles found');
    }
    return true;
  }
  return false;
};


/**
 * Handler to manage changes on dropdowns.
 * @param {String} selectId The selectId to which to add a change handler.
 * @return {function} Returns a the handler function.
 */
gadash.ui.AcctSelect.prototype.getChangeHandler = function(selectId) {
  return function(evt) {
    switch (selectId) {
      case 'acct-select':
        this.selected.accountId = evt.target.value;
        this.loadProperties();
        break;

      case 'property-select':
        this.selected.propertyId = evt.target.value;
        this.loadProfiles();
        break;

      case 'profile-select':
        this.selected.profileId = evt.target.value;
        gadash.util.save(this.divId, this.selected);
        break;
    }
  }
};


/**
 * Load properties from the Management API.
 */
gadash.ui.AcctSelect.prototype.loadProperties = function() {
  var results = this.loadFromCache(this.selected.accountId);
  if (results) {
    this.handleProperties(results);

  } else {
    gapi.client.analytics.management.webproperties.list({
      'accountId': this.selected.accountId}).execute(
        gadash.util.bindMethod(this, this.handleProperties));
  }
};


/**
 * Handles properties from Management API.
 * @param {Object} results teh results object returned from the API.
 */
gadash.ui.AcctSelect.prototype.handleProperties = function(results) {
  if (!this.isError(results)) {

    gadash.ui.acct.sortResults(results);
    this.saveToCache(this.selected.accountId, results);

    if (!this.isFromLoad) {
      this.selected.propertyId = results.items[0].id;
    }

    document.getElementById(this.getId_('property-select')).innerHTML =
        gadash.ui.acct.getOptionsFromResults(results,
            this.selected.propertyId);

    this.loadProfiles();
  }
};


/**
 * Load profiles from the Management API.
 */
gadash.ui.AcctSelect.prototype.loadProfiles = function() {
  var results = this.loadFromCache(this.selected.propertyId);
  if (results) {
    this.handleProfiles(results);

  } else {
    gapi.client.analytics.management.profiles.list({
      'accountId': this.selected.accountId,
      'webPropertyId': this.selected.propertyId}).execute(
        gadash.util.bindMethod(this, this.handleProfiles));
  }
};


/**
 * Handles profiles from Management API.
 * @param {Object} results teh results object returned from the API.
 */
gadash.ui.AcctSelect.prototype.handleProfiles = function(results) {
  if (!this.isError(results)) {

    gadash.ui.acct.sortResults(results);
    this.saveToCache(this.selected.propertyId, results);

    if (!this.isFromLoad) {
      this.selected.profileId = results.items[0].id;
    }

    document.getElementById(this.getId_('profile-select')).innerHTML =
        gadash.ui.acct.getOptionsFromResults(results, this.selected.profileId);

    gadash.util.save(this.divId, this.selected);
    this.isFromLoad = false;
  }
};


/**
 * Returns a string of options that can be used inside of a dropdown.
 * @param {Object} results The successful result object returned from the
 *     management API.
 * @param {String=} opt_selectedId The id of the selected element.
 * @return {String} A list of option elements to be used in a select element.
 */
gadash.ui.acct.getOptionsFromResults = function(results, opt_selectedId) {

  var selectedId = opt_selectedId || '';

  var output = [];
  for (var i = 0, item; item = results.items[i]; ++i) {
    var isSelected = item.id == selectedId ? true : false;
    output.push(gadash.ui.acct.getOption(item.id, item.name, isSelected));
  }
  return output.join('');
};


/**
 * Returns a single option element as a string to be added to a select element.
 * @param {Boolean} id The id of the option.
 * @param {String} name The display name of the option.
 * @param {Boolean=} opt_isSelected Whether the option should be selected.
 * @return {String} The HTML of the option element as a string.
 */
gadash.ui.acct.getOption = function(id, name, opt_isSelected) {
  var selected = opt_isSelected ? ' selected ' : '';

  return ['<option value="', id, '"', selected, '>',
    gadash.util.htmlEscape(name), '</option>'
  ].join('');
};


/**
 * Stores an object in the gadash.ui.acct.cache object. Uses this objets
 * divId as a namespce.
 * @param {String} key The cache key.
 * @param {Object} data The object to store.
 */
gadash.ui.AcctSelect.prototype.saveToCache = function(key, data) {
  // Create the namespaced cache if it doesn exist.
  gadash.ui.acct.cache[this.divId] = gadash.ui.acct.cache[this.divId] || {};

  gadash.ui.acct.cache[this.divId][key] = data;
};


/**
 * Returns an object fmor the gadash.ui.acct.cache object. Uses this objets
 * divId as a namespce.
 * @param {String} key The cache key.
 * @return {Object} The object in the cache.
 */
gadash.ui.AcctSelect.prototype.loadFromCache = function(key) {
  if (gadash.ui.acct.cache[this.divId]) {
    return gadash.ui.acct.cache[this.divId][key];
  }
};


/**
 * Sorts the items in the results by account name in decending order.
 * @param {Object} results The result object returned from the API.
 */
gadash.ui.acct.sortResults = function(results) {
  results.items.sort(function(a, b) {
    if (a.name.toLowerCase() < b.name.toLowerCase()) {
      return -1;
    } else if (a.name.toLowerCase() > b.name.toLowerCase()) {
      return 1;
    }
    return 0;
  });
};


