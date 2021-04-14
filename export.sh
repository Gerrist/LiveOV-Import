#!/bin/bash
tsc
#npm i
#apt install unzip
cd build
[ -d out ] || mkdir out
#node downloadCHB.js
#node handleCHB.js
echo "[Export]      CSVing stop-areas.json"
#json2csv -i out/stop-areas.json -o out/stop-areas.csv
echo "[Export]      CSVing stops.json"
#json2csv -i out/stops.json -o out/stops.csv
echo "[Export]      Downloading GTFS file"
#wget http://gtfs.ovapi.nl/nl/gtfs-nl.zip -O gtfs.zip
echo "[Export]      Unzipping GTFS"
#unzip -o gtfs.zip -d gtfs
echo "[Export]      Splitting GTFS"
#mkdir gtfs/stop_times_parts
#split -l 100000 gtfs/stop_times.txt gtfs/stop_times_parts/stop_times_
echo "[Export]      Parsing GTFS"
node parseGTFS.js --max_old_space_size=4000


#echo "[Export]      Removing temporary files"
#rm ExportCHB.gz
#rm ExportCHB.xml
#rm ExportCHB.json
#rm -rf gtfs
#rm PassengerStopAssignmentExportCHB.gz
#rm PassengerStopAssignmentExportCHB.xml
#rm PassengerStopAssignmentExportCHB.json
#rm -rf scrapeNDOV
rm out/stops.json
rm out/stop-areas.json
