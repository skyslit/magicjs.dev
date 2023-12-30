#!/usr/bin/env node
import { buildApp } from './build';
import { init } from './init';
import commandLineArgs from 'command-line-args';
import { publish } from './publish';
import { addFeature } from './add-feature';

process.on('SIGINT', function () {
    console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
    // some other closing procedures go here
    process.exit(0);
});

const optionDefinitions = [
    { name: 'start', alias: 's', type: Boolean },
    { name: 'runtimeUrl', type: String },
    { name: 'build', alias: 'b', type: Boolean },
    { name: 'init', alias: 'i', type: Boolean },
    { name: 'publish', alias: 'p', type: Boolean },
    { name: 'feature', type: String },
    { name: 'secretKey', type: String },
    { name: 'add-feature', type: Boolean },
    { name: 'package', type: String },
    { name: 'name', type: String },
]

const options = commandLineArgs(optionDefinitions);

if (options.start === true) {
    const runtimeUrl = options.runtimeUrl;
    buildApp(true, runtimeUrl);
} else if (options.build === true) {
    buildApp(false);
} else if (options.init === true) {
    init();
} else if (options.publish === true) {
    const feature = options.feature;
    const secretKey = options.secretKey;

    if (!feature) {
        throw new Error(`Feature is required`);
    }

    if (!secretKey) {
        throw new Error(`secretKey is required`);
    }

    publish(feature, secretKey);
} else if (options['add-feature'] === true) {
    const name = options.name;
    const packageId = options.package;

    if (!name) {
        throw new Error(`name is required`);
    }

    if (!packageId) {
        throw new Error(`package is required`);
    }

    addFeature(name, packageId)
} else {
    console.log('No supported command found');
}
