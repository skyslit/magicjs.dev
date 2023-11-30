#!/usr/bin/env node
import { buildApp } from './build';
import { init } from './init';
import commandLineArgs from 'command-line-args';

const optionDefinitions = [
    { name: 'start', alias: 's', type: Boolean },
    { name: 'build', alias: 'b', type: Boolean },
    { name: 'init', alias: 'i', type: Boolean }
]

const options = commandLineArgs(optionDefinitions);

if (options.start === true) {
    buildApp(true);
} else if (options.build === true) {
    buildApp(false);
} else if (options.init === true) {
    init();
} else {
    console.log('No supported command found');
}
