"use strict";

var $ = require("../../core/renderer"),
    commonUtils = require("../../core/utils/common"),
    SelectionStrategy = require("./selection.strategy"),
    errors = require("../widget/ui.errors"),
    dataQuery = require("../../data/query");

module.exports = SelectionStrategy.inherit({

    getSelectedItems: function() {
        return this._loadFilteredData(this.options.selectionFilter);
    },

    getSelectedItemKeys: function() {
        var d = $.Deferred(),
            that = this,
            key = this.options.key(),
            select = commonUtils.isString(key) ? [key] : key;

        this._loadFilteredData(this.options.selectionFilter, null, select).done(function(items) {
            var keys = items.map(function(item) {
                return that.options.keyOf(item);
            });

            d.resolve(keys);
        }).fail(d.reject);

        return d.promise();
    },

    selectedItemKeys: function(keys, preserve, isDeselect, isSelectAll) {
        if(isSelectAll) {
            var filter = this.options.filter();

            if(!filter) {
                this._setOption("selectionFilter", isDeselect ? [] : null);
            } else {
                this._addSelectionFilter(isDeselect, filter, false);
            }

        } else {
            if(!preserve) {
                this._setOption("selectionFilter", []);
            }

            for(var i = 0; i < keys.length; i++) {
                if(isDeselect) {
                    this.removeSelectedItem(keys[i]);
                } else {
                    this.addSelectedItem(keys[i]);
                }
            }
        }

        this.onSelectionChanged();

        return $.Deferred().resolve();
    },

    setSelectedItems: function(keys) {
        this._setOption("selectionFilter", null);
        for(var i = 0; i < keys.length; i++) {
            this.addSelectedItem(keys[i]);
        }
    },

    isItemDataSelected: function(itemData) {
        return this.isItemKeySelected(itemData);
    },

    isItemKeySelected: function(itemData) {
        var selectionFilter = this.options.selectionFilter;

        if(!selectionFilter) {
            return true;
        }

        return !!dataQuery([itemData]).filter(selectionFilter).toArray().length;
    },

    _processSelectedItem: function(key) {
        var keyField = this.options.key(),
            filter = [keyField, "=", key];


        if(Array.isArray(keyField)) {
            filter = [];
            for(var i = 0; i < keyField.length; i++) {
                filter.push([keyField[i], "=", key[keyField[i]]]);
                if(i !== keyField.length - 1) {
                    filter.push("and");
                }
            }
        }

        return filter;
    },

    addSelectedItem: function(key) {
        var filter = this._processSelectedItem(key);

        this._addSelectionFilter(false, filter, true);
    },

    removeSelectedItem: function(key) {
        var filter = this._processSelectedItem(key);

        this._addSelectionFilter(true, filter, true);
    },

    validate: function() {
        var key = this.options.key;

        if(key && key() === undefined) {
            throw errors.Error("E1042");
        }
    },

    _hasSameFilter: function(selectionFilter, currentFilter) {
        return this._findSubFilter(selectionFilter, currentFilter) >= 0;
    },

    _findSubFilter: function(selectionFilter, filter) {
        if(!selectionFilter) return -1;
        var filterString = JSON.stringify(filter);

        for(var index = 0; index < selectionFilter.length; index++) {
            var subFilter = selectionFilter[index];
            if(subFilter && JSON.stringify(subFilter) === filterString) {
                return index;
            }
        }

        return -1;
    },

    _isLastSubFilter: function(selectionFilter, filter) {
        if(selectionFilter && filter) {
            return this._findSubFilter(selectionFilter, filter) === selectionFilter.length - 1;
        }
        return false;
    },

    _addFilterOperator: function(selectionFilter, filterOperator) {
        if(selectionFilter.length > 1 && commonUtils.isString(selectionFilter[1]) && selectionFilter[1] !== filterOperator) {
            selectionFilter = [selectionFilter];
        }
        if(selectionFilter.length) {
            selectionFilter.push(filterOperator);
        }
        return selectionFilter;
    },

    _denormalizeFilter: function(filter) {
        if(filter && commonUtils.isString(filter[0])) {
            filter = [filter];
        }
        return filter;
    },

    _addSelectionFilter: function(isDeselect, filter, isUnique) {
        var that = this,
            needAddFilter = true,
            currentFilter = isDeselect ? ["!", filter] : filter,
            selectionFilter = that.options.selectionFilter || [];

        selectionFilter = that._denormalizeFilter(selectionFilter);

        if(selectionFilter && selectionFilter.length) {
            if(that._hasSameFilter(selectionFilter, currentFilter)) {
                return;
            }

            if(that._removeInvertedFilter(selectionFilter, isDeselect, filter)) {
                needAddFilter = !isUnique;
            }

            if(needAddFilter) {
                selectionFilter = that._addFilterOperator(selectionFilter, isDeselect ? "and" : "or");
            }
        }

        if(needAddFilter) {
            selectionFilter.push(currentFilter);
        }

        selectionFilter = that._normalizeFilter(selectionFilter);

        that._setOption("selectionFilter", !isDeselect && !selectionFilter.length ? null : selectionFilter);
    },

    _normalizeFilter: function(filter) {
        if(filter && filter.length === 1) {
            filter = filter[0];
        }
        return filter;
    },

    _removeInvertedFilter: function(selectionFilter, isDeselect, filter) {
        filter = isDeselect ? filter : ["!", filter];

        var filterIndex = this._findSubFilter(selectionFilter, filter);

        if(JSON.stringify(filter) === JSON.stringify(selectionFilter)) {
            selectionFilter.splice(0, selectionFilter.length);
            return true;
        }

        if(filterIndex >= 0) {
            if(filterIndex > 0) {
                selectionFilter.splice(filterIndex - 1, 2);
            } else {
                selectionFilter.splice(filterIndex, 2);
            }
            return true;
        }
        return false;
    },

    getSelectAllState: function() {
        var filter = this.options.filter(),
            selectionFilter = this.options.selectionFilter;

        if(!selectionFilter) return true;
        if(!selectionFilter.length) return false;
        if(!filter || !filter.length) return undefined;

        selectionFilter = this._denormalizeFilter(selectionFilter);

        if(this._isLastSubFilter(selectionFilter, filter)) {
            return true;
        }

        if(this._isLastSubFilter(selectionFilter, ["!", filter])) {
            return false;
        }

        return undefined;
    }
});
