import * as fs from "fs";
import * as csvrow from "csvrow";
import * as json from "big-json";
import moment = require("moment-timezone");
import {listenerCount} from "cluster";
import {type} from "os";
import {csvheader, csvline} from "./util";

moment.tz.setDefault("Europe/Amsterdam");



namespace GTFS {
    export enum Trip {
        route_id, service_id, trip_id, realtime_trip_id, trip_headsign, trip_short_name, trip_long_name, direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed
    }

    export enum CalendarDates {
        service_id, date, exception_type
    }

    export enum StopTime {
        trip_id, stop_sequence, stop_id, stop_headsign, arrival_time, departure_time, pickup_type, drop_off_type, timepoint, shape_dist_traveled, fare_units_traveled
    }

    export enum Stop {
        stop_id, stop_code, stop_name, stop_lat, stop_lon, location_type, parent_station, stop_timezone, wheelchair_boarding, platform_code, zone_id
    }

    export enum Route {
        route_id, agency_id, route_short_name, route_long_name, route_desc, route_type, route_color, route_text_color, route_url
    }

    export enum Agency {
        agency_id, agency_name, agency_url, agency_timezone, agency_phone
    }
}

function forceArray(data: any) {
    if (typeof data.forEach == 'function') { // reliable way to tell if data is Array
        return data; // return original data (array)
    } else {
        return [data]; // return single object as array with object
    }
}

try {
    let ovTrips = {};
    let ovStops = {};


    // let relativeTimestamps = true;
    //
    // if(fs.existsSync(__dirname + '/ovdrs-config.json')){
    //     let config = JSON.parse(fs.readFileSync(__dirname + '/ovdrs-config.json').toString());
    //
    //     relativeTimestamps = config.relativeTimestamps;
    // }

    let GTFScalendarDates = fs.readFileSync(__dirname + '/gtfs/calendar_dates.txt').toString();
    let GTFSRoutes = fs.readFileSync(__dirname + '/gtfs/routes.txt').toString();
    let GTFSTrips = fs.readFileSync(__dirname + '/gtfs/trips.txt').toString();
    let GTFStops = fs.readFileSync(__dirname + '/gtfs/stops.txt').toString();

    let pCalendarDates = {};

    GTFScalendarDates.split("\n").forEach(c => {
        let cd = c.split(",");
        pCalendarDates[cd[GTFS.CalendarDates.service_id]] = cd[GTFS.CalendarDates.date];
    });

    let pRoutes = {};

    GTFSRoutes.split("\n").forEach(s => {
        let route = s.split(',');
        pRoutes[route[GTFS.Route.route_id]] = route;
    });

    let pTrips = {};
    let pServices = {};

    GTFSTrips.split("\n").forEach(s => {
        let trip = csvrow.parse(s).map(x => x.split(",").join("!C!"));

        pTrips[trip[GTFS.Trip.trip_id]] = trip;
        pTrips[pServices[GTFS.Trip.service_id]] = trip;
    });

    let pStops = {};

    GTFStops.split("\n").forEach(s => {
        let stop = csvrow.parse(s);

        if(stop[GTFS.Stop.zone_id].indexOf("IFF:") > -1){
            stop[GTFS.Stop.stop_code] = stop[GTFS.Stop.zone_id].replace("IFF:", "S:");
        } else {
            stop[GTFS.Stop.stop_code] = "S:" + stop[GTFS.Stop.zone_id];
        }
        pStops[stop[GTFS.Stop.stop_id]] = stop;
    });

    // GTFSstops.forEach(r => {
    //     let stop = r.split(",");
    //
    //     // console.log(r.split(",")[GTFS.Stop.stop_id], r.split(","));
    //     stops[stop[GTFS.Stop.stop_id]] = r.split(",");
    //     let csv = csvrow.parse(r);
    //     let code = stop[GTFS.Stop.stop_code];
    //     // console.log(`'${r.split(",")[GTFS.Stop.stop_code]}' '${r.split(",")[GTFS.Stop.zone_id]}'`)
    //     if (typeof stop[GTFS.Stop.zone_id] == 'string') {
    //         if (stop[GTFS.Stop.zone_id].indexOf("IFF:") > -1) {
    //             if (stop[GTFS.Stop.platform_code] == '') {
    //                 code = stop[GTFS.Stop.zone_id];
    //
    //             } else {
    //                 code = stop[GTFS.Stop.zone_id] + ':' + stop[GTFS.Stop.platform_code];
    //             }
    //         }
    //     }
    //
    //     ovStops["S:" + code] = [csv[GTFS.Stop.stop_name], csv[GTFS.Stop.location_type], csv[GTFS.Stop.platform_code], [csv[GTFS.Stop.stop_lat], csv[GTFS.Stop.stop_lon]]];
    // });
    //
    // console.log(`Getting routes`);
    // let GTFSroutes = fs.readFileSync(__dirname + '/' + process.argv[2] + '/gtfs/routes.txt').toString().split("\n")
    // let routes = {};
    // GTFSroutes.forEach(r => {
    //     routes[r.split(",")[GTFS.Route.route_id]] = r.split(",");
    // });
    //
    // console.log(`Getting operators`);
    // let GTFSoperators = fs.readFileSync(__dirname + '/' + process.argv[2] + '/gtfs/agency.txt').toString().split("\n")
    // let operators = {};
    // GTFSoperators.forEach(r => {
    //     operators[r.split(",")[GTFS.Agency.agency_id]] = r.split(",")[GTFS.Agency.agency_name];
    // });
    //
    // console.log(`Getting today's trips`);
    // let GTFStrips = fs.readFileSync(__dirname + '/' + process.argv[2] + '/gtfs/trips.txt').toString().split("\n");
    // let tripsObj = {};
    // let trips = GTFStrips.filter((t) => {
    //     let trip = t.split(",");
    //     return services.includes(trip[GTFS.Trip.service_id]);
    // });
    // trips.forEach(t => {
    //     tripsObj[t.split(",")[GTFS.Trip.trip_id]] = t;
    // });
    //
    // console.log(`Getting stop times`);
    // let stopTimes = {};
    //
    // var GTFSstopTimes = [];
    // let skipped = 0;
    // let tempTripTimes = {};

    let tTripCalls = {};

    let calls = [];
    let trips = {};

    fs.readdir(__dirname + '/gtfs/stop_times_parts', async (err, files) => {
        let skippedHeader = false;
        let approxLines = files.length * 100100;
            for (const file of files) {
            let filePath = __dirname + '/gtfs/stop_times_parts/' + file;

            for (const straw of fs.readFileSync(filePath).toString().split('\n')) {
                if (!skippedHeader) {
                    skippedHeader = true;

                } else {
                    let stopTime = straw.split(',');

                    if(stopTime.length > 1){
                        if(stopTime[GTFS.StopTime.trip_id] in pTrips){
                            if(pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id] in pCalendarDates){
                                let arrivalMoment = moment(stopTime[GTFS.StopTime.arrival_time] + ' ' + pCalendarDates[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id]], 'HH:mm:ss YYYYMMDD');
                                let departureMoment = moment(stopTime[GTFS.StopTime.departure_time] + ' ' + pCalendarDates[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id]], 'HH:mm:ss YYYYMMDD');

                                let tripKey = pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.realtime_trip_id] + '-' + pCalendarDates[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id]];

                                if (!(tripKey in tTripCalls)) {
                                    tTripCalls[tripKey] = 0;
                                }

                                tTripCalls[tripKey]++;


                                trips[tripKey] = {
                                    trip: pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.realtime_trip_id],
                                    date: pCalendarDates[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id]],
                                    // line: pRoutes[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.realtime_trip_id]][GTFS.Route.agency_id] + ":" + pRoutes[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.realtime_trip_id]][GTFS.Route.route_id],
                                    line: pRoutes[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.route_id]][GTFS.Route.route_short_name],
                                    destination: pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.trip_headsign],
                                    operator: pRoutes[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.route_id]][GTFS.Route.agency_id],
                                    formula: pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.trip_long_name],
                                };

                                let call = {
                                    trip: pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.realtime_trip_id],
                                    date: pCalendarDates[pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id]],
                                    stop: pStops[stopTime[GTFS.StopTime.stop_id]][GTFS.Stop.stop_code],
                                    departureTime: arrivalMoment.unix(),
                                    arrivalTime: departureMoment.unix(),
                                    platform: pStops[stopTime[GTFS.StopTime.stop_id]][GTFS.Stop.platform_code],
                                    sequence: stopTime[GTFS.StopTime.departure_time][GTFS.StopTime.stop_sequence],
                                    doNotBoard: false,
                                };

                                calls.push(call);

                                if ((calls.length % 25000) == 0) {
                                    console.log('Approx. progress: ' + ((calls.length / approxLines) * 100).toFixed(3) + '%');
                                }
                            } else {
                                console.log(pTrips[stopTime[GTFS.StopTime.trip_id]][GTFS.Trip.service_id] + ' not in calendardates');
                            }
                        } else {
                            console.log(stopTime, ' not in trips');
                        }
                    }


                }
            }
        }

        for (const c of calls) {
            c.doNotBoard = tTripCalls[c.trip + "-" + c.date] - 1 == c.sequence;
        }

        console.log(`Writing trips (${Object.values(trips).length})`);
        fs.writeFileSync(__dirname + '/out/trips.csv', csvheader(Object.values(trips)[0]) + '\n');
        let tc = 0;
        for (const trip of Object.values(trips)) {
            tc++;
            fs.appendFileSync(__dirname + '/out/trips.csv', csvline(trip) + "\n");

            if((tc % 10000) == 0){
                console.log("Appended: " + tc);
            }
        }

        console.log(`Writing calls (${calls.length})`);
        fs.writeFileSync(__dirname + '/out/calls.csv', csvheader(calls[0]) + '\n');
        let cc = 0;
        for (const call of calls) {
            cc++;
            fs.appendFileSync(__dirname + '/out/calls.csv', csvline(call) + "\n");

            if((cc % 10000) == 0){
                console.log("Appended " + ((cc/calls.length)*100).toFixed(2) + "% (" + cc + ")");
            }
        }


        // console.log(`Writing calls (${calls.length})`);
        // fs.writeFileSync(__dirname + '/out/calls.csv', csvrow.stringify(Object.keys(calls[0])) + '\n');


        // let callsStr = "[";
        // let cc = 0;
        // for (const c of calls) {
        //     cc++;
        //     callsStr += JSON.stringify(c);
        //     if(cc < calls.length){
        //         callsStr += ",";
        //     }
        // }
        // callsStr += "]"
        // fs.writeFileSync(__dirname + '/out/calls.json', callsStr);

        // console.log("Temp trips: " + Object.keys(tempTripTimes).length);
        // console.log("Done. Reduced size by skipping " + skipped + ' lines');
        // console.log("Processing...");
        //
        // for (const t of trips) {
        //     // console.log(GTFStrips[t.split(",")[GTFS.Trip.trip_id]])
        //
        //     let routeId = t.split(",")[GTFS.Trip.route_id];
        //     let tripId = t.split(",")[GTFS.Trip.trip_id];
        //     let realtimeTripId = t.split(",")[GTFS.Trip.realtime_trip_id];
        //
        //
        //     let tripStops = tempTripTimes[realtimeTripId];
        //     let route = [];
        //     let calls = [];
        //     let arrived = [];
        //     let departed = [];
        //     let arrivalTimes = [];
        //     let departureTimes = [];
        //
        //     tripStops.sort((a, b) => {
        //         if (parseInt(a[GTFS.StopTime.stop_sequence]) < parseInt(b[GTFS.StopTime.stop_sequence])) {
        //             return -1;
        //         }
        //         if (parseInt(a[GTFS.StopTime.stop_sequence]) > parseInt(b[GTFS.StopTime.stop_sequence])) {
        //             return 1;
        //         }
        //         return 0;
        //     });
        //
        //     for (const s of tripStops) {
        //         // if(realtimeTripId == "GVB:52:520607"){
        //         //     console.log();
        //         //     console.log();
        //         //     console.log();
        //         //
        //         //     console.log(stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.stop_name], s[GTFS.StopTime.arrival_time], s[GTFS.StopTime.departure_time])
        //         //
        //         //     console.log();
        //         //     console.log();
        //         //     console.log();
        //         // }
        //
        //         let code = stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.stop_code];
        //         if (typeof stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.zone_id] == 'string') {
        //             if (stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.zone_id].indexOf("IFF:") > -1) {
        //                 let hasPlatform = stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.platform_code] != "";
        //                 code = stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.zone_id] + (hasPlatform ? ':' + stops[s[GTFS.StopTime.stop_id]][GTFS.Stop.platform_code] : '');
        //             }
        //         }
        //
        //         route.push(`S:${code}`);
        //         calls.push(`S:${code}`);
        //         arrived.push(false);
        //         departed.push(false);
        //
        //         let departureTime = moment(targetDateWD, "YYYY-MM-DD").add(moment.duration(s[GTFS.StopTime.departure_time], 'minutes').asSeconds(), 'seconds').unix();
        //         let arrivalTime = moment(targetDateWD, "YYYY-MM-DD").add(moment.duration(s[GTFS.StopTime.arrival_time], 'minutes').asSeconds(), 'seconds').unix();
        //
        //         arrivalTimes.push(arrivalTime);
        //         departureTimes.push(departureTime);
        //         // console.log(s[GTFS.StopTime.stop_sequence], s[GTFS.StopTime.arrival_time], s[GTFS.StopTime.departure_time], s[GTFS.StopTime.stop_id], typeof s[GTFS.StopTime.stop_id], ]);
        //     }
        //
        //     ovTrips[realtimeTripId] = {
        //         line: routes[routeId][GTFS.Route.agency_id] + ":" + routes[routeId][GTFS.Route.route_short_name],
        //         operator: routes[routeId][GTFS.Route.agency_id],
        //         destination: t.split(",")[GTFS.Trip.trip_headsign],
        //         formula: t.split(",")[GTFS.Trip.trip_long_name],
        //         arrived: arrived,
        //         departed: departed,
        //         route: route,
        //         calls: calls,
        //         cancelled: [],
        //         extra: [],
        //         date: targetDateWD,
        //         arrivalTimes: arrivalTimes,
        //         departureTimes: departureTimes
        //     }
        // }
        //
        // console.log("Inserting BTM stopArea's");
        // let stopAreasBTM = JSON.parse(fs.readFileSync(__dirname + '/' + process.argv[2] + '/chb.btm.json').toString());
        //
        // console.log("Inserting Train stopArea's");
        // let stopAreasTrain = JSON.parse(fs.readFileSync(__dirname + '/' + process.argv[2] + '/chb.train.json').toString());
        //
        //
        // let dataSet = {
        //     date: process.argv[3],
        //     stops: ovStops,
        //     operators: operators,
        //     stopAreas: Object.assign(stopAreasBTM, stopAreasTrain),
        //     // stopAreas: stopAreasTrain,
        //     trips: ovTrips
        // }
        //
        // console.log("Writing dataset to " + __dirname + '/' + process.argv[3] + '.json');
        //
        // fs.writeFileSync(__dirname + '/' + process.argv[3] + '.json', JSON.stringify(dataSet));
        //
        // console.log("Done!");


    });



    // fs.createReadStream(__dirname + '/' + process.argv[2] + '/gtfs/stop_times.txt')
    //     .pipe(parse({delimiter: ','}))
    //     .on('data', function (csvrow) {
    //         GTFSstopTimes.push(csvrow);
    // })
    // .on('end', function (err) {
    //     console.log(err);
    // })
    // .on('end', function () {
    //     console.log("end");
    // GTFSstopTimes.forEach(stt => {
    //     let st = stt.split(",");
    //
    //     if (!(st[GTFS.StopTime.trip_id] in stopTimes)) {
    //         stopTimes[st[GTFS.StopTime.trip_id]] = [];
    //     }
    //
    //     stopTimes[st[GTFS.StopTime.trip_id]].push(st);
    // });
    //
    // console.log(stopTimes);


    //
    // console.log(tripsObj);
    //
    // trips.forEach(t => {
    //     // console.log(GTFStrips[t.split(",")[GTFS.Trip.trip_id]])
    //
    //     let routeId = t.split(",")[GTFS.Trip.route_id];
    //     let tripId = t.split(",")[GTFS.Trip.trip_id];
    //     let realtimeTripId = t.split(",")[GTFS.Trip.realtime_trip_id];
    //
    //     // console.log();
    //     // console.log(routeId);
    //     // console.log(tripId);
    //     // console.log(realtimeTripId);
    //     // console.log(routes[routeId]);
    //
    //     ovTrips[realtimeTripId] = {
    //         line: routes[routeId][GTFS.Route.route_short_name],
    //         operator: routes[routeId][GTFS.Route.agency_id],
    //         destination: t.split(",")[GTFS.Trip.trip_headsign],
    //         route: [],
    //         calls: [],
    //         cancelled: [],
    //         arrivalTimes: [],
    //         departureTimes: []
    //     }
    // });
    //
    // // console.log(`Getting stop times`);
    // // let GTFSstops = fs.readFileSync(__dirname + '/' + process.argv[2] + '/gtfs/stops.txt').toString().split("\n")
    // // let stops = GTFSstops.filter((s) => {
    // //     let stop = s.split(",");
    // //     return trips.includes(stop[GTFS.Stop.]);
    // // });
    //
    // console.log(ovTrips);
    // });


    // let GTFSstopTimes = fs.readFileSync(__dirname + '/' + process.argv[2] + '/gtfs/stop_times.txt').toString().split("\n")
    // let stopTimes = {};


    // fs.writeFileSync(__dirname + '/' + process.argv[2] + '/chb.btm.json', JSON.stringify(stopAreas));
} catch (e) {
    throw e;
}
