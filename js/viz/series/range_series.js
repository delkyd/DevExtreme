"use strict";

//there are rangebar, rangearea
var commonUtils = require("../../core/utils/common"),
    extend = require("../../core/utils/extend").extend,
    _extend = extend,
    _isDefined = commonUtils.isDefined,
    _map = require("../core/utils").map,
    _noop = commonUtils.noop,

    rangeCalculator = require("./helpers/range_data_calculator"),
    scatterSeries = require("./scatter_series").chart,
    barSeries = require("./bar_series").chart.bar,
    areaSeries = require("./area_series").chart.area;

exports.chart = {};

var baseRangeSeries = {
    _beginUpdateData: _noop,

    areErrorBarsVisible: _noop,
    _createErrorBarGroup: _noop,

    _checkData: function(data) {
        return _isDefined(data.argument) && data.value !== undefined && data.minValue !== undefined;
    },

    updateTemplateFieldNames: function() {
        var that = this,
            options = that._options,
            valueFields = that.getValueFields(),
            name = that.name;

        options.rangeValue1Field = valueFields[0] + name;
        options.rangeValue2Field = valueFields[1] + name;
        options.tagField = that.getTagField() + name;
    },

    _processRange: function(point, prevPoint) {
        rangeCalculator.processTwoValues(this, point, prevPoint, "value", "minValue");
    },

    _getRangeData: function(zoomArgs, calcIntervalFunction) {
        rangeCalculator.calculateRangeData(this, zoomArgs, calcIntervalFunction, "value", "minValue");
        rangeCalculator.addRangeSeriesLabelPaddings(this);

        return this._rangeData;
    },

    _getPointData: function(data, options) {
        return {
            tag: data[options.tagField || "tag"],
            minValue: data[options.rangeValue1Field || "val1"],
            value: data[options.rangeValue2Field || "val2"],
            argument: data[options.argumentField || "arg"]
        };
    },

    _fusionPoints: function(fusionPoints, tick) {
        var calcMedianValue = scatterSeries._calcMedianValue,
            value = calcMedianValue.call(this, fusionPoints, "value"),
            minValue = calcMedianValue.call(this, fusionPoints, "minValue");

        if(value === null || minValue === null) {
            value = minValue = null;
        }
        return { minValue: minValue, value: value, argument: tick, tag: null };
    },

    getValueFields: function() {
        return [this._options.rangeValue1Field || "val1", this._options.rangeValue2Field || "val2"];
    }
};

exports.chart["rangebar"] = _extend({}, barSeries, baseRangeSeries);

exports.chart["rangearea"] = _extend({}, areaSeries, {
    _drawPoint: function(options) {
        var point = options.point;

        if(point.isInVisibleArea()) {
            point.clearVisibility();
            point.draw(this._renderer, options.groups);
            this._drawnPoints.push(point);
            if(!point.visibleTopMarker) {
                point.hideMarker("top");
            }
            if(!point.visibleBottomMarker) {
                point.hideMarker("bottom");
            }
        } else {
            point.setInvisibility();
        }
    },

    _prepareSegment: function(points, rotated) {
        var processedPoints = this._processSinglePointsAreaSegment(points, rotated),
            processedMinPointsCoords = _map(processedPoints, function(pt) { return pt.getCoords(true); });

        return {
            line: processedPoints,
            bottomLine: processedMinPointsCoords,
            area: _map(processedPoints, function(pt) { return pt.getCoords(); }).concat(processedMinPointsCoords.slice().reverse()),
            singlePointSegment: processedPoints !== points
        };
    },

    _getDefaultSegment: function(segment) {
        var defaultSegment = areaSeries._getDefaultSegment.call(this, segment);
        defaultSegment.bottomLine = defaultSegment.line;
        return defaultSegment;
    },

    _removeElement: function(element) {
        areaSeries._removeElement.call(this, element);
        element.bottomLine && element.bottomLine.remove();
    },

    _drawElement: function(segment, group) {
        var that = this,
            drawnElement = areaSeries._drawElement.call(that, segment, group);
        drawnElement.bottomLine = that._bordersGroup && that._createBorderElement(segment.bottomLine, that._styles.normal.border).append(that._bordersGroup);

        return drawnElement;
    },

    _applyStyle: function(style) {
        var that = this,
            elementsGroup = that._elementsGroup;

        elementsGroup && elementsGroup.smartAttr(style.elements);
        (that._graphics || []).forEach(function(graphic) {
            graphic.line && graphic.line.attr(style.border);
            graphic.bottomLine && graphic.bottomLine.attr(style.border);
        });
    },

    _updateElement: function(element, segment, animate, animateParams, complete) {
        areaSeries._updateElement.call(this, element, segment, animate, animateParams, complete);
        var bottomLineParams = { points: segment.bottomLine },
            bottomBorderElement = element.bottomLine;

        if(bottomBorderElement) {
            animate ? bottomBorderElement.animate(bottomLineParams, animateParams) : bottomBorderElement.attr(bottomLineParams);
            bottomBorderElement.attr(this._styles.normal.border);
        }
    }
}, baseRangeSeries);
