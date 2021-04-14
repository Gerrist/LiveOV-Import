import * as fs from 'fs';
import * as ftp from 'basic-ftp';
import * as zlib from 'zlib';
import * as xml2js from 'xml2js';

const prefix = "[DownloadCHB] ";

let stripPrefix = xml2js.processors.stripPrefix;
// we also use these built in parsers to coerce types for string values like "true" and "34"
let parseBooleans = xml2js.processors.parseBooleans;
let parseNumbers = xml2js.processors.parseNumbers;
// construct xml to JSON parser
let parser = new xml2js.Parser({
    explicitArray: false,
    tagNameProcessors: [stripPrefix],
    valueProcessors: [parseNumbers, parseBooleans],
});

function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
}

async function gunzip(source, destination): Promise<void> {
    // check if source file exists
    return new Promise((resolve, reject) => {
        if (!fileExists(source)) {
            reject();
        }

        try {
            // prepare streams
            var src = fs.createReadStream(source);
            var dest = fs.createWriteStream(destination);

            // extract the archive
            src.pipe(zlib.createGunzip()).pipe(dest);

            // callback on extract completion
            dest.on('close', function () {
                resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function convert(file: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
        parser.parseString(fs.readFileSync(file), (err, result) => {
            let json = JSON.stringify(result.export);
            fs.writeFile(destination, json, () => {
                resolve();
            });
        });
    });
}

async function main() {
    const client = new ftp.Client()
    try {
        console.log(prefix + "Connecting to FTP");
        await client.access({
            host: "data.ndovloket.nl",
            // user: "very",
            // password: "password",
            // secure: true

        })
        console.log(prefix + "Listing remote files");
        await client.cd('haltes');
        let files = await client.list();
        console.log(prefix + "Downloading CHB files");

        let filesToConvert = [];

        for (let file of files.map(f => f.name)) {
            let resultName = "unknown";
            if (file.indexOf('PassengerStopAssignmentExportCHB') == 0) {
                resultName = __dirname + '/PassengerStopAssignmentExportCHB';
            }
            if (file.indexOf('ExportCHB') == 0) {
                resultName = __dirname + '/ExportCHB';
            }
            await client.downloadTo(resultName + '.gz', file);
            console.log(prefix + `Decompressing '${resultName}'`);
            await gunzip(resultName + '.gz', resultName + '.xml');
            console.log(prefix + `Converting '${resultName}'`);
            await convert(resultName + '.xml', resultName + '.json');

        }

    } catch (err) {
        console.log(err)
    }
    client.close();
}

main();
