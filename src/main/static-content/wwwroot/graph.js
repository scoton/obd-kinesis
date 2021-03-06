/*
 * Copyright 2014 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

// When the page loads create our graph and start updating it.
$(function() {
  graph.inject();
  uiHelper.decorate();
  uiHelper.start();
});

/**
 * Represents a Flot time series graph that is capable of updating itself with
 * new data.
 */
var Graph = function() {

  var graph, totalDurationToGraphInSeconds = 120;

  return {
    /**
     * @returns {number} the total duration of time, in seconds, this graph will display.
     */
    getTotalDurationToGraphInSeconds : function() {
      return totalDurationToGraphInSeconds;
    },

    /**
     * Creates the graph and injects in into the element with id="graph".
     */
    inject : function() {
      graph = $.plot("#graph", {},
    		  {
    	  		series: {
    	  		  stack:0,
    	  		  bars: {show: true,
    	  		         align: "center",
    	  		         barWidth: 0.4}},
    	  		xaxis: {
    	  		  axisLabel: "Klassen der Messwerte",
                  axisLabelUseCanvas: true,
                  axisLabelFontSizePixels: 12,
                  axisLabelFontFamily: 'Verdana, Arial',
                  axisLabelPadding: 10
    	  		   },
    	  		yaxis: {
                  axisLabel: "Relative Häufigkeit",
                  axisLabelUseCanvas: true,
                  axisLabelFontSizePixels: 12,
                  axisLabelFontFamily: 'Verdana, Arial',
                  axisLabelPadding: 10
    	  		   },
    	  		legend:{
                  position: "nw"
    	  		   },
          	});
    },

    /**
     * Update the graph to use the data provided. This completely replaces any
     * existing data and recomputes the axes' range.
     *
     * @param {Object}
     *          flotData Flot formatted data object that should include at a
     *          minimum series labels and their data in the format: { label: "my
     *          series", data: [[0, 10], [1, 100]] }
     */
    update : function(flotData) {
      graph.setData(flotData);

      // Calculate min and max value to update y-axis range.
      var getValue = function(tuple) {
        // Flot data values are stored as the second element of each data array
        return tuple[1];
      };
      graph.getOptions().yaxes[0].max = 100;
      graph.getOptions().yaxes[0].min = 0;

      graph.getOptions().xaxes[0].min = -1;
      graph.getOptions().xaxes[0].max = 22;

      // Redraw the graph data and axes
      graph.draw();
      graph.setupGrid();
    }
  }
}

/**
 * A collection of methods used to manipulate visible elements of the page.
 */
var UIHelper = function(data, graph) {
  // How frequently should we poll for new data and update the graph?
  var updateIntervalInMillis = 2000;
  // How often should the top N display be updated?
  var intervalsPerTopNUpdate = 1;
  // How far back should we fetch data at every interval?
  var rangeOfDataToFetchEveryIntervalInSeconds = 2;
  // What should N be for our Top N display?
  var topNToCalculate = 3;
  // Keep track of when we last updated the top N display.
  var topNIntervalCounter = 1;
  // Controls the update loop.
  var running = true;
  // Set the active resource to query for counts when updating data.
  var activeResource = "undefined";

  /**
   * Fetch counts from the last secondsAgo seconds.
   *
   * @param {string}
   *          resource The resource to fetch counts for.
   * @param {number}
   *          secondsAgo The range in seconds since now to fetch counts for.
   * @param {function}
   *          callback The callback to invoke when data has been updated.
   */
  var updateData = function(resource, secondsAgo, callback) {
    // Fetch data from our data provider
    activeResource = document.getElementById("myVIN").value;
    if (activeResource==""){activeResource="undefined";}
    document.getElementById("return_VIN").innerHTML = "Nutze Vehicle ID: " +activeResource;
    provider.getData(resource, secondsAgo, function(newData) {
      // Store the data locally
      data.addNewData(newData);
      // Remove data that's outside the window of data we are displaying. This
      // is unnecessary to keep around.
      /*data.removeDataOlderThan((new Date()).getTime()
          - (graph.getTotalDurationToGraphInSeconds() * 1000));
          */
      if (callback) {
        callback();
      }
    });
  }

  /**
   * Update the top N display.
   */
  var updateTopN = function() {
    var topN = data.getTopN(topNToCalculate);

    var table = $("<table/>").addClass("topN");
    $.each(topN, function(_, v) {
      console.loog
      var row = $("<tr/>");
      row.append($("<td/>").addClass('referrerColumn').text(v.referrer));
      row.append($("<td/>").addClass('countColumn').text(v.count));
      table.append(row);
    });

    $("#topN").html(table);
  }

  /**
   * Update the graph with new data.
   */
  var update = function() {
    // Update our local data for the active resource
    updateData(activeResource, rangeOfDataToFetchEveryIntervalInSeconds);

    // Update top N every intervalsPerTopNUpdate intervals
    if (topNIntervalCounter++ % intervalsPerTopNUpdate == 0) {
      updateTopN(data);
      topNIntervalCounter = 1;
    }

    // Update the graph with our new data, transformed into the data series
    // format Flot expects
    graph.update(data.toFlotData());

    // Update the last updated display
    setLastUpdatedBy(data.getLastUpdatedBy());

    // If we're still running schedule this method to be executed again at the
    // next interval
    if (running) {
      setTimeout(arguments.callee, updateIntervalInMillis);
    }
  }

  /**
   * Set the page description header.
   *
   * @param {string}
   *          desc Page description.
   */
  var setDescription = function(desc) {
    $("#description").text(desc);
  }

  /**
   * Set the last updated label, if one is provided.
   *
   * @param {string}
   *          s The new host that last updated our count data. If one is not
   *          provided the last updated label will not be shown.
   */
  var setLastUpdatedBy = function(s) {
    var message = s ? "Letztes Update von: " + s : "";
    $("#updatedBy").text(message);
  }

  return {
    /**
     * Set the active resource the graph is displaying counts for. This is for
     * debugging purposes.
     *
     * @param {string}
     *          resource The resource to query our data provider for counts of.
     */
    setActiveResource : function(resource) {
      activeResource = resource;
      data.removeDataOlderThan((new Date()).getTime());
    },

    /**
     * Decorate the page. This will update various UI elements with dynamically
     * calculated values.
     */
    decorate : function() {
      setDescription("Relative Häufigkeit der Messwerte RPM / LOAD im Zeitfenster 60 s. Aktualisierung alle "+updateIntervalInMillis+" ms");
      $("#topNDescription").text("Statistische Kenngrößen");
    },

    /**
     * Starts updating the graph at our defined interval.
     */
    start : function() {
      setDescription("Loading data...");
      var _this = this;
      // Load an initial range of data, decorate the page, and start the update polling process.
      updateData(activeResource, rangeOfDataToFetchEveryIntervalInSeconds,
          function() {
            // Decorate again now that we're done with the initial load
            _this.decorate();
            // Start our polling update
            running = true;
            update();
          });
    },

    /**
     * Stop updating the graph.
     */
    stop : function() {
      running = false;
    }
  }
};

/**
 * Provides easy access to count data.
 */
var CountDataProvider = function() {
  var _endpoint = "http://" + location.host + "/api/GetCounts";

  /**
   * Builds a URL to fetch the number of counts for a given resource in the past
   * range_in_seconds seconds.
   *
   * @param {string}
   *          resource The resource to request counts for.
   * @param {number}
   *          range_in_seconds The range in seconds, since now, to request
   *          counts for.
   *
   * @returns The URL to send a request for new data to.
   */
  buildUrl = function(resource, range_in_seconds) {
    return _endpoint + "?resource=" + resource + "&range_in_seconds="
        + range_in_seconds;
  };

  return {
    /**
     * Set the endpoint to request counts with.
     */
    setEndpoint : function(endpoint) {
      _endpoint = endpoint;
    },

    /**
     * Requests new data and passed it to the callback provided. The data is
     * expected to be returned in the following format. Note: Referrer counts
     * are ordered in descending order so the natural Top N can be derived per
     * interval simply by using the first N elements of the referrerCounts
     * array.
     *
     * [{
     *   "resource" : "/index.html",
     *   "timestamp" : 1397156430562,
     *   "host" : "worker01-ec2",
     *   "referrerCounts" : [
     *     {"referrer":"http://www.amazon.com","count":1002},
     *     {"referrer":"http://aws.amazon.com","count":901}
     *   ]
     * }]
     *
     * @param {string}
     *          resource The resource to request counts for.
     * @param {number}
     *          range_in_seconds The range in seconds, since now, to request
     *          counts for.
     * @param {function}
     *          callback The function to cavar load_data =[];ll when data has been returned from
     *          the endpoint.
     */
    getData : function(resource, range_in_seconds, callback) {
      $.ajax({
        url : buildUrl(resource, range_in_seconds)
      }).done(callback);
    }
  }
}

/**
 * Internal representation of count data. The data is stored in an associative
 * array by timestamp so it's easy to update a range of data without having to
 * manually deduplicate entries. The internal representation is then transformed
 * to what Flot expects with toFlotData().
 */
var CountData = function() {
  // Data format:
  // {
  //   "http://www.amazon.com" : {
  //     "label" : "http://www.amazon.com",
  //     "lastUpdatedBy" : "worker01-ec2"
  //     "data" : {
  //       "1396559634129" : 150
  //     }
  //   }
  // }
  var data = {};

  // Totals format:
  // {
  //   "http://www.amazon.com" : 102333
  // }
  var totals = {};
  var load_totals = {};
  var speed_totals = {};
  var load_data =[];
  var speed_data =[];


  // What host last updated the counts? This is useful to visualize how failover
  // happens when a worker is replaced.
  var lastUpdatedBy;

  /**
   * Update the total count for a given referrer.
   *
   * @param {string}
   *          referrer Referrer to update the total for.
   */
  var updateTotal = function(referrer) {
    // Simply loop through all the counts and sum them if there is data for this
    // referrer
    if (data[referrer]) {
      totals[referrer] = 0;
      $.each(data[referrer].data, function(ts, count) {
        totals[referrer] = count;
      });
    } else {
      // No data for the referrer, remove the total if it exists
      delete totals[referrer];
    }
  }

  /**
   * Set the host that last updated data.
   *
   * @param {string}
   *          host The host that last provided update counts.
   */
  var setLastUpdatedBy = function(host) {
    lastUpdatedBy = host;
  }

  return {
    /**
     * @returns {object} The internal representation of referrer data.
     */
    getData : function() {
      return data;
    },

    /**
     * @returns {string} The host that last updated our count data.
     */
    getLastUpdatedBy : function() {
      return lastUpdatedBy;
    },

    /**
     * @returns {object} An associative array of referrers to their total
     *          counts.
     */
    getTotals : function() {
      return totals;
    },

    /**
     * Compute local top N using the entire range of data we currently have.
     *
     * @param {number}
     *          n The number of top referrers to calculate.
     *
     * @returns {object[]} The top referrers by count in descending order.
     */
    getTopN : function(n) {
      // Create an array out of the totals so we can sort it
      var totalsAsArray = $.map(totals, function(count, referrer) {
        return {
          'referrer' : referrer,
          'count' : count
        };
      });
      // Sort descending by count
      var sorted = totalsAsArray.sort(function(a, b) {
        return b.count - a.count;
      });
      // Return the first N
      //return sorted.slice(0, Math.min(n, sorted.length));
      var results = [];
      var useage = 0;
      // LOAD
      var mittelwert = 0;
      var standardabweichung = 0;
      var woeblung = 0;
      var temp = $.map(load_totals,function(i,n){return [[parseInt(n.substring(0,2)),i]]});
      var N = $.map(load_totals,function(i,n){return [i] }).reduce(function(pv, cv) { return pv + cv; }, 0);
      //
      for (var i=0;i<temp.length;i++){
          mittelwert+=(temp[i][0]+0.5)*temp[i][1];
        }
      mittelwert /= N;
      results.push({"referrer":"LOAD Mittelwert [%] ","count":(mittelwert*5).toFixed(0)});
      for (var i=0;i<temp.length;i++){
          standardabweichung+=Math.pow(temp[i][0]+0.5-mittelwert,2)*temp[i][1];
        }
      standardabweichung /= N;
      standardabweichung = Math.sqrt(standardabweichung);
      if (standardabweichung<0.01){standardabweichung=0.1;}
      results.push({"referrer":"LOAD Stand.Abw. [%] ","count":(standardabweichung*5).toFixed(0)});
      if (standardabweichung<=0.1){mittelwert*=0.95;}
      for (var i=0;i<temp.length;i++){
        woeblung+= Math.pow((temp[i][0]+0.5-mittelwert)/standardabweichung,4)*temp[i][1];
        }
      woeblung /= N;
      results.push({"referrer":"LOAD Kurtosis [%^4] ","count":(woeblung*5).toFixed(0)});
      results.push({"referrer":"LOAD Messerte in 60s [] ","count":N});
      useage = mittelwert*woeblung;
      // RPM
      var mittelwert = 0;
      var standardabweichung = 0;
      var woeblung = 0;
      var temp = $.map(speed_totals,function(i,n){return [[parseInt(n.substring(0,2)),i]]});
      var N = $.map(speed_totals,function(i,n){return [i] }).reduce(function(pv, cv) { return pv + cv; }, 0);
      //
      for (var i=0;i<temp.length;i++){
          mittelwert+=(temp[i][0]+0.5)*temp[i][1];
        }
      mittelwert /= N;
      results.push({"referrer":"RPM Mittelwert [rpm] ","count":(mittelwert*300).toFixed(0)});
      for (var i=0;i<temp.length;i++){
          standardabweichung+=Math.pow(temp[i][0]+0.5-mittelwert,2)*temp[i][1];
        }
      standardabweichung /= N;
      standardabweichung = Math.sqrt(standardabweichung);
      if (standardabweichung<0.01){standardabweichung=0.1;}
      results.push({"referrer":"RPM Stand.Abw. [rpm] ","count":(standardabweichung*300).toFixed(0)});
      if (standardabweichung<=0.1){mittelwert*=0.95;}
      for (var i=0;i<temp.length;i++){
          woeblung+= Math.pow((temp[i][0]+0.5-mittelwert)/standardabweichung,4)*temp[i][1];
        }
        woeblung /= N;
        results.push({"referrer":"RPM Kurtosis [rpm^4] ","count":(woeblung*300).toFixed(0)});
	results.push({"referrer":"RPM Messwerte in 60s [] ","count":N});
      //
      useage *= mittelwert*woeblung;
      results.push({"referrer":"_________________________","count":"===="});
      results.push({"referrer":"Modellbasierter Maschinen\n Nutzungsindex","count":useage.toFixed(0)});
      return results;
    },

    /**
     * Merges new count data in to our existing data set.
     *
     * @param {object} Count data returned by our data provider.
     */
    addNewData : function(newCountData) {
      // Expected data format:
      // [{
      //   "resource" : "/index.html",
      //   "timestamp" : 1397156430562,
      //   "host" : "worker01-ec2",
      //   "referrerCounts" : [{"referrer":"http://www.amazon.com","count":1002}]
      // }]
      newCountData.forEach(function(count) {
        // Update the host who last calculated the counts
        setLastUpdatedBy(count.host+" um "+ new Date(count.timestamp).toUTCString());
        // Add individual referrer counts
        count.referrerCounts.forEach(function(refCount) {
        	//if (refCount.referrer.substring(3, 6) == "RPM"){
          // Reuse or create a new data series entry for this referrer
          refData = data[refCount.referrer] || {
            label : refCount.referrer,
            data : {}
          };
        	
          // Set the count
          refData.data[count.timestamp] = refCount.count;
          // Update the referrer data
          data[refCount.referrer] = refData;
          // Update our totals whenever new data is added
          updateTotal(refCount.referrer);
        	//}
        });
      });
    },

    /**
     * Removes data older than a specific time. This will also prune referrers
     * that have no data points.
     *
     * @param {number}
     *          timestamp Any data older than this time will be removed.
     */
    removeDataOlderThan : function(timestamp) {
      // For each referrer
      $.each(data, function(referrer, referrerData) {
        var shouldUpdateTotals = false;
        // For each data point
        $.each(referrerData.data, function(ts, count) {
          // If the data point is older than the provided time
          if (ts < timestamp) {
            // Remove the timestamp from the data
            delete referrerData.data[ts];
            // Indicate we need to update the totals for the referrer since we
            // removed data
            shouldUpdateTotals = true;
            // If the referrer has no more data remove the referrer entirely
            if (Object.keys(referrerData.data).length == 0) {
              // Remove the empty referrer - it has no more data
              delete data[referrer];
            }
          }
        });
        if (shouldUpdateTotals) {
          // Update the totals if we removed any data
          updateTotal(referrer);
        }
      });
    },

    /**
     * Convert our internal data to a Flot data object.
     *
     * @returns {object[]} Array of data series for every referrer we know of.
     */
    toFlotData : function() {
      load_totals ={};
      $.each(totals,function(n,i){
        if (n.substring(3,7)=="LOAD"){
         load_totals[n]=i;
        }
      });
      //
      speed_totals ={};
      $.each(totals,function(n,i){
        if (n.substring(3,6)=="RPM"){
         speed_totals[n]=i;
        }
      });
      //
      sum_count = $.map(load_totals,function(i,n){return [i] }).reduce(function(pv, cv) { return pv + cv; }, 0);
      load_data = $.map(load_totals,function(i,n){return [[parseInt(n.substring(0,2))-0.25,i/sum_count*100]] });
      //
      sum_count = $.map(speed_totals,function(i,n){return [i] }).reduce(function(pv, cv) { return pv + cv; }, 0);
      speed_data = $.map(speed_totals,function(i,n){return [[parseInt(n.substring(0,2))+0.25,i/sum_count*100]] });

      flotData = [{label: "RPM",data: speed_data},{label: "LOAD",data: load_data}];
    /*flotData =[];
      $.each(data, function(referrer,referrerData) {
        flotData.push({
          label : referrer,
          // Flot expects time series data to be in the format:
          // [[timestamp as number, value]]
          data : $.map(referrerData.data, function(count, ts) {
            return [ [ parseInt(ts), count ] ];
          })
        });
      });*/
      return flotData;
    }
  }
}

var data = new CountData();
var provider = new CountDataProvider();
var graph = new Graph();
var uiHelper = new UIHelper(data, graph);
