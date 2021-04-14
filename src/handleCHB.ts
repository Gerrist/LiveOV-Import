import * as fs from 'fs';
import * as rdToWgs84 from 'rd-to-wgs84';
import {type} from "os";

const prefix = "[HandleCHB]   ";

async function main() {
    console.log(prefix + 'Handling CHB json files');
    // let exportCHBJSON = fs.readFileSync(__dirname + '/ExportCHB.json');
    let passengerStopAssignmentExportCHBJSON = JSON.parse(fs.readFileSync(__dirname + '/ExportCHB.json').toString());

    let stopplaces = passengerStopAssignmentExportCHBJSON.stopplaces.stopplace;
        // .filter(sp => {
        //     return (sp.stopplacename.town == "Arnhem" && sp.stopplacename.publicname.indexOf("Centraal Station") > -1)
        // })

    let stopareas = [];
    let stops = [];

    for (const sp of stopplaces) {
        let lat = -1;
        let lon = -1;

        if(typeof sp.quays.quay != 'undefined'){
            for (const q of sp.quays.quay) {
                let ll = rdToWgs84(
                    q.quaylocationdata["rd-x"],
                    q.quaylocationdata["rd-y"],
                );

                lat = ll.lat;
                lon = ll.lon;

                stops.push({
                    stopArea: sp.stopplacecode,
                    code: "S:" + q.quaycode.split(":S:")[1],
                    name: q.quaynamedata.quayname,
                    platform: q.quaynamedata.stopsidecode ?? "",
                });
            }
        }

        stopareas.push({
            code: sp.stopplacecode,
            name: sp.stopplacename.publicname,
            town: sp.stopplacename.town ?? "",
            street: sp.stopplacename.street ?? "",
            lat,
            lon,
            type: sp.stopplacetype ?? "unknown"
        });
    }

    console.log(prefix + "Writing stop-areas.json");
    fs.writeFileSync(__dirname + '/out/stop-areas.json', JSON.stringify(stopareas));
    console.log(prefix + "Writing stops.csv");
    fs.writeFileSync(__dirname + '/out/stops.json', JSON.stringify(stops));

    // console.log(passengerStopAssignmentExportCHBJSON.places.place);
}

main();
