import * as fs from "fs";
import * as path from "path";
import * as waapi from 'waapi-client';
import { ak } from 'waapi';
import { promisify } from 'util';

var Parser = require("jison").Parser;


const grammar = {
    "lex": {
        "macros": {
            "digit": "[0-9]",
            "int": "-?(?:[0-9]|[1-9][0-9]+)",
            "frac": "(?:\\.[0-9]+)",
            "esc": "\\\\",
            "name": "[a-zA-Z_][a-zA-Z0-9_]*\\b"
        },

        "rules": [
            ["\\s+", "/* skip whitespace */"],
            ["\/\/.*\\n", "return 'COMMENT';"],
            ["{int}{frac}?\\b", "return 'NUMBER';"],
            ["\\<{name}>", "return 'HEADER'"],
            ["{name}=", "return 'PROPERTY'"],
            ["true\\b", "return 'TRUE'"],
            ["false\\b", "return 'FALSE'"],
            ["[^<>:\"\/\\\\|?*]+.wav", "return 'FILENAME';"],
            ["[^<>:\"\/|?*]*\\n", "return 'PATH';"],
        ]
    },

    "operators": [
        ["left", ":"]
    ],

    "bnf": {
        "SFZ": [
            "SFZComment",
            "SFZHeader",
            "SFZPropertyList",
            "SFZ SFZComment",
            "SFZ SFZHeader",
            "SFZ SFZPropertyList"
        ],
        "SFZComment": ["COMMENT"],
        "SFZPath": ["PATH"],
        "SFZNumber": ["NUMBER"],
        "SFZFilename": ["FILENAME"],
        "SFZBooleanLiteral": ["TRUE", "FALSE"],
        "SFZValue": [
            "SFZBooleanLiteral",
            "SFZPath",
            "SFZNumber",
            "SFZFilename"],
        //"SFZProperty": [["PROPERTY SFZValue", "setProp($1.substring(0, $1.length - 1),$2)"]],
        "SFZProperty": [["PROPERTY SFZValue", "yyYext = [$2]"]],
        "SFZPropertyList": [
            "SFZProperty",
            "SFZPropertyList SFZProperty"],
        "SFZHeader": [["HEADER", "setHeader($1)"]]
    },
    actionInclude: function () {
        function saveRegion() {
            let merge = Object.assign({}, region, group, global);
            regions.push(merge);
            region = {};
        }
        
        let global: any = {};
        let group: any = {};
        let region: any = {};
        
        let regions: any[] = [];        
        function setProp(name: string, value: number | string | boolean) {
            //console.log(`PROPERTY:${name}:${value}`);
        
            if (region) {
                region[name] = value;
            }
            else if (group) {
                group[name] = value;
            }
            else if (global) {
                global[name] = value;
            }
        }
        
        function setHeader(name: string) {
            //console.log(`HEADER:${name}`);
            if (name === '<global>')
            {
                saveRegion();
                global = {};
                group = {};
            }    
            else if (name === '<group>')
            {
                saveRegion();
                group = {};
            }
            else if (name === '<region>')
            {
                saveRegion();
            }
        }
    }
};

interface Import{
    importLanguage?: string;  // Import language for audio file import (see documentation for possible values).
    importLocation?: Object;  // ID (GUID) or path used as root relative object paths.
    audioFile: string;        //	Path to media file to import.
    audioFileBase64?: string;  //	Base64 encoded WAV audio file data to import with its target file path relative to the Originals folder, separated by a vertical bar. E.g. 'MySound.wav|UklGRu...'.
    originalsSubFolder?: string;   //	Specifies the originals sub-folder in which to place the imported audio file. This folder is relative to the originals folder in which the file would normally be imported. Example: if importing an SFX, then the audio file will be imported to the folder Originals\SFX\orignalsPath.
    objectPath: string;	//The path and name of the object(s) to be created. The path uses backslashes and can either be absolute or relative.
    objectType?: string;   //	Specifies the type of the object to create when importing an audio file.
    notes?: string;    //	The "Notes" field of the created object.
    audioSourceNotes?: string; //	The "Notes" field of the created audio source object.
    switchAssignation?: string;    //	Defines a Switch Group or State Group that will be associated to a Switch Container, within the Actor-Mixer Hierarchy only. Also defines which Switch Container's child will be assigned to which Switch or State from the associated group. Refer to Tab Delimited Import in the Wwise Help documentation for more information.
    event?: string;    //	Defines the path and name of an Event to be created for the imported object. Refer to Tab Delimited Import in the Wwise Help documentation for more information.
    dialogueEvent?: string;    //	Defines the path and name of a Dialogue Event to be created for the imported object. Refer to Tab Delimited Import in the Wwise Help documentation for more information    
}

async function main() {
    let file: string = 'D:\\Projets\\sfz\\Patch_Arena_sfz_Bowed_Vibraphone\\sfz Bowed Vibraphone.sfz';

    try {
        let sfz = await promisify(fs.readFile)(file, "utf8");

        let parser = new Parser(grammar);
        let parseResult = parser.parse(sfz);

        console.error(`Successfully Compiled`);

        // Connect to WAAPI
        // Ensure you enabled WAAPI in Wwise's User Preferences
        var connection = await waapi.connect('ws://localhost:8080/waapi');

        // Obtain information about Wwise
        var wwiseInfo = await connection.call(ak.wwise.core.getInfo, {});
        console.log(`Connected to ${wwiseInfo.displayName} ${wwiseInfo.version.displayName}`);  
        
        var imports:Import[] = [];

        let importArgs = {
            importOperation: "useExisting",
            default: {
                importLanguage: "SFX"
            },
            imports: imports
        };        

        // Import!
        var wwiseInfo = await connection.call(ak.wwise.core.audio.import_, importArgs);

        await connection.disconnect();

    } catch (e) {
        console.error(e.message);
        return;
    }

    process.exit();
 }

main();