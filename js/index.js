'use strict';
/**
 * Currency exchange web application.
 * @author Balázs Ankes
 */

var App = {};
App.tools = (function() {
    var doAjax = function() {
        var request = $.ajax({
            type: 'POST',
            url: 'getCurrency.php',
            dataType: 'json',
            data: {
                url: 'http://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'
            }
        });

        request.done(function(data) {
            processJson(data);
            $(document).trigger('dataReady');
        });

        request.fail(function(jqXHR, textStatus) {
            console.error('Request failed: ' + textStatus);
        });
    };

    /**
     * Processes the JSON from server into a global data structure
     * @param  {Object} data - data from server
     * @return {Object} App.model.dates - the global object
     */
    var processJson = function(data) {
        var rawCurrencies = data.Cube.Cube,
            l = rawCurrencies.length;

        for (var i = 0; i < l; i++) {
            App.model.dates.push({date: rawCurrencies[i]['@attributes'].time, values: []});

            for (var j = 0, k = rawCurrencies[i].Cube.length; j < k; j++) {
                App.model.dates[i].values.push(
                    new App.model.currencyObj(rawCurrencies[i].Cube[j]));
            }
        }
    };

    /**
     * Formula for the calculation of the exchange rate
     * @param  {Int} fromValue - the quantity of the currency
     * @param  {Float} fromRate - the actual currancy rate
     * @param  {Float} toRate - the required currancy rate
     * @return {Float}           the result
     */
    var computeExchange = function(fromValue, fromRate, toRate) {
        return (1 / fromRate * toRate * fromValue);
    };

    /**
     * Manages the input values and calls the formula.
     * @return {Float} the result
     */
    var doExchange = function() {
        var $currencyQuantityFrom = $('#currencyQuantityFrom'),
            $currenciesSelectFrom = $('#currenciesSelectFrom'),
            $currenciesSelectTo = $('#currenciesSelectTo'),
            value = parseInt($currencyQuantityFrom.val()),
            fromRate = $currenciesSelectFrom.children('option:selected').data('rate'),
            toRate = $currenciesSelectTo.children('option:selected').data('rate');

        if(!value) {
            return;
        }

        return computeExchange(value, fromRate, toRate).toFixed(3);
    };

    /**
     * Forms the data to make it acceptable to Rickshaw.
     * @param  {String} currency - The currency from the selector
     * @return {Array} dataForGraph - Stores objects, {x: a, y: b}, a and b are {Int}
     */
    var createDataForGraph = function(currency) {
        var reverseDates = Array.prototype.slice.call(App.model.dates),
            l = reverseDates.length,
            dataForGraph = [];
        reverseDates.reverse();

        // TODO work out a more efficient data structure in order to prevent the embedded loop.
        for(var i = 0; i < l; i++) {
            for(var j = 0, k = reverseDates[i].values.length; j < k; j++) {
                if(reverseDates[i].values[j].currency === currency) {
                    dataForGraph.push({
                        x: new Date(reverseDates[i].date).getTime() / 1000,
                        y: parseFloat(reverseDates[i].values[j].rate)
                    });
                }
            }
        }

        return dataForGraph;
    };

    return {
        doAjax: doAjax,
        computeExchange: computeExchange,
        doExchange: doExchange,
        createDataForGraph: createDataForGraph
    };
})();

App.view = (function() {
    /**
     * Updates the currency selectors.
     */
    var updateCurrenciesSelectView = function() {
        var $option = $('<option/>'),
            $select = $('.currenciesSelect'),
            latestCurrencies = App.model.dates[0],
            l = latestCurrencies.values.length;

        if($select[0].length) {
            return;
        }

        for(var i = 0; i < l; i++) {
            $select.append(
                $option.clone().attr('data-rate', latestCurrencies.values[i].rate).text(
                    latestCurrencies.values[i].currency));
        }
    };

    /**
     * Draws the Rickshaw graph.
     * @param  {Array} data - input for the graph
     * @param  {String} name - currency label
     */
    var drawGraph = function(data, name) {
        // Does taller the y axis to make the date label visible in case of hovering.
        var max = Math.max.apply(Math, data.map(function(obj) {return obj.y;}));
        var graph = new Rickshaw.Graph( {
            element: document.querySelector('#graph'),
            renderer: 'line',
            width: 580,
            height: 300,
            max: max * 1.2,
            series: [ {
                color: 'steelblue',
                data: data,
                name: name
            } ]
        } );
        graph.render();

        var hoverDetail = new Rickshaw.Graph.HoverDetail({graph: graph});

        var axes = new Rickshaw.Graph.Axis.Time({
            graph: graph
        });
        axes.render();

        var yAxis = new Rickshaw.Graph.Axis.Y({
            graph: graph
        });
        yAxis.render();
    };

    /**
     * Refreshes the view with the given value.
     * @param  {Float} value
     */
    var refreshExchangeView = function(value) {
        $('#currencyQuantityTo').val(value);
    };

    var drawAlert = function(text) {
        var $alert = $('<div/>', {
            'class': 'alert alert-success alert-dismissible',
            'role': 'alert',
            text: text
        });
        var $dismissButton = $('<button/>', {
            'type': 'button',
            'class': 'close',
            'data-dismiss': 'alert',
            html: '<span aria-hidden="true">&times;</span><span class="sr-only">Close</span>'
        });

        $('#alertContainer').append($alert.append($dismissButton));
    };

    return {
        updateCurrenciesSelectView: updateCurrenciesSelectView,
        drawGraph: drawGraph,
        refreshExchangeView: refreshExchangeView,
        drawAlert: drawAlert
    };
})();

App.model = (function() {
    /**
     * Currency object.
     * @param  {Object} ojb
     *             {Object} @attribute
     *                 {String} currency
     *                 {String} rate
     */
    var currencyObj = function(obj) {
        this.currency = obj['@attributes'].currency;
        this.rate = obj['@attributes'].rate;
    };

    /**
     * Container object for store the currencies.
     * @type {Object}
     */
    var dates = [];

    return {
        currencyObj: currencyObj,
        dates: dates
    };
})();

$(function() {
    function doWholeExchangeProcess() {
        var exchangeRate = App.tools.doExchange();
        App.view.refreshExchangeView(exchangeRate);
    }

    function doWholeGraphDraw() {
        var $selectedCurrency = $('#currenciesSelectGraph').children('option:selected').text(),
            data = App.tools.createDataForGraph($selectedCurrency),
            name = $selectedCurrency;

        $('#graph').children().remove();

        App.view.drawGraph(data, name);
    }

    App.tools.doAjax();

    $(document).on('dataReady', function() {
        App.view.updateCurrenciesSelectView();
        doWholeGraphDraw();
        App.view.drawAlert('Successful data refresh!');

        setTimeout(function() {
            $('.alert').alert('close');
        }, 5000);
    });

    $('#currenciesSelectGraph').on('change', doWholeGraphDraw);

    $('#refreshButton').on('click', function(event) {
        App.model.dates = [];

        App.tools.doAjax();

        event.preventDefault();
    });

    $('#currencyQuantityFrom').on('change', doWholeExchangeProcess);

    $('#currenciesSelectFrom').on('change', doWholeExchangeProcess);

    $('#currenciesSelectTo').on('change', doWholeExchangeProcess);

});
