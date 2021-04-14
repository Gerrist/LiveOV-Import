#!/bin/bash
npm i
npm i npm i json2csv -g
npm i npm i typescript -g
tsc
apt install unzip
cd build
[ -d out ] || mkdir out
node --max_old_space_size=8000 downloadCHB.js
node --max_old_space_size=8000 handleCHB.js
echo "[Export]      CSVing stop-areas.json"
json2csv -i out/stop-areas.json -o out/stop-areas.csv
echo "[Export]      CSVing stops.json"
json2csv -i out/stops.json -o out/stops.csv
echo "[Export]      Downloading GTFS file"
wget http://gtfs.ovapi.nl/nl/gtfs-nl.zip -O gtfs.zip
echo "[Export]      Unzipping GTFS"
unzip -o gtfs.zip -d gtfs
echo "[Export]      Splitting GTFS"
mkdir gtfs/stop_times_parts
split -l 100000 gtfs/stop_times.txt gtfs/stop_times_parts/stop_times_
echo "[Export]      Parsing GTFS"
node --max_old_space_size=8000 parseGTFS.js
echo "[Export]      Inserting in DB"
mongo liveov --eval 'db.calls.createIndex( { "trip": 1, "date": 1, "stop": 1, "departureTime": 1, "arrivalTime": 1,  } ); db.trips.createIndex( { "trip": 1, "date": 1 } ); db.stops.createIndex( { "stop": 1 } );'
mongoimport --db liveov --collection stopareas --type csv --headerline --file out/stop-areas.csv --upsert --upsertFields code
mongoimport --db liveov --collection stops --type csv --headerline --file out/stops.csv --upsert --upsertFields stop
mongoimport --db liveov --collection trips --type csv --headerline --file out/trips.csv --upsert --upsertFields trip,date
mongoimport --db liveov --collection calls --type csv --headerline --file out/calls.csv --upsert --upsertFields trip,date
echo "[Export]      Removing temporary files"
rm ExportCHB.gz
rm ExportCHB.xml
rm ExportCHB.json
rm -rf gtfs
rm PassengerStopAssignmentExportCHB.gz
rm PassengerStopAssignmentExportCHB.xml
rm PassengerStopAssignmentExportCHB.json
rm -rf scrapeNDOV
rm out/stops.json
rm out/stop-areas.json
